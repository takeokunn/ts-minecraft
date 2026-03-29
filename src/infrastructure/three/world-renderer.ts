import { Array as Arr, Effect, HashMap, HashSet, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { ChunkCacheKey } from '@/shared/kernel'
import { MAX_SHADOW_HALF_EXTENT } from '@/shared/rendering-constants'
import { ChunkMeshService } from './meshing/chunk-mesh'
import { SceneService } from './scene/scene-service'
import { createWaterMaterial } from './water-material'

/**
 * Maximum number of chunk mesh creations per syncChunksToScene call.
 * Limits GPU/CPU work per frame when many chunks become dirty simultaneously,
 * spreading mesh builds across subsequent frames to avoid frame spikes.
 * Only throttles creation/update — removal of stale chunks is always immediate.
 */
export const MAX_CHUNK_UPDATES_PER_FRAME = 4

/**
 * Key for chunk mesh tracking — uses the shared ChunkCacheKey brand so this
 * HashMap<ChunkCacheKey, ChunkMeshes> is type-compatible with chunk-manager-service maps.
 */
const chunkKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)

// Keep the refraction pass lower-resolution than the main canvas to cut GPU fill cost.
const REFRACTION_RT_WIDTH = 400
const REFRACTION_RT_HEIGHT = 300

// Only dispose geometry; materials may be shared across chunk meshes
const disposeMesh = (mesh: THREE.Mesh): void => {
  mesh.geometry.dispose()
}

interface ChunkMeshes {
  opaque: THREE.Mesh
  water: Option.Option<THREE.Mesh>
}

/**
 * Service for synchronizing chunk state with Three.js scene
 */
export class WorldRendererService extends Effect.Service<WorldRendererService>()(
  '@minecraft/infrastructure/three/WorldRendererService',
  {
    scoped: Effect.all([
      ChunkMeshService,
      SceneService,
      Ref.make(HashMap.empty<ChunkCacheKey, ChunkMeshes>()),
      // Stable water mesh list — only replaced (new array reference) when
      // chunks are added/removed.
      Ref.make<ReadonlyArray<THREE.Mesh>>([]),
      // Pre-allocated objects for frustum culling and refraction pre-pass — reused every frame to avoid GC pressure
      Effect.sync(() => ({
        _frustum: new THREE.Frustum(),
        _projMatrix: new THREE.Matrix4(),
        _box: new THREE.Box3(),
        _minVec: new THREE.Vector3(),
        _maxVec: new THREE.Vector3(),
        _savedWaterVisibility: new Map<THREE.Mesh, boolean>(),
        // Water mesh cache — only return new reference when the mesh set actually changes
        _waterMeshCache: MutableRef.make<ReadonlyArray<THREE.Mesh>>([]),
      })),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([chunkMeshService, sceneService, meshesRef, waterMeshesRef, preAlloc]) =>
        // Dedicated refraction camera — cloned once, far=128 permanently.
        // Per-frame doRefractionPrePass copies position/quaternion (cheap matrix copy)
        // instead of mutating the main camera's far plane and calling updateProjectionMatrix() twice.
        Effect.sync(() => {
          const refractionCamera = new THREE.PerspectiveCamera()
          refractionCamera.fov = 75
          refractionCamera.near = 0.1
          refractionCamera.far = 128
          refractionCamera.updateProjectionMatrix()
          return refractionCamera
        }).pipe(Effect.flatMap((refractionCamera) =>
        // Refraction render target — GPU resource, disposed on scope close
        Effect.acquireRelease(
          Effect.sync(() =>
            new THREE.WebGLRenderTarget(REFRACTION_RT_WIDTH, REFRACTION_RT_HEIGHT, {
              minFilter: THREE.LinearFilter,
              magFilter: THREE.LinearFilter,
              format: THREE.RGBAFormat,
            })
          ),
          (rt) => Effect.sync(() => rt.dispose())
        ).pipe(
          Effect.flatMap((refractionRT) =>
            // Water ShaderMaterial — GPU resource, disposed on scope close
            Effect.acquireRelease(
              Effect.sync(() =>
                createWaterMaterial(
                  refractionRT.texture,
                  800,
                  600
                )
              ),
              (mat) => Effect.sync(() => mat.dispose())
            ).pipe(
              Effect.map((waterMaterial) => {
              const { _frustum, _projMatrix, _box, _minVec, _maxVec, _savedWaterVisibility, _waterMeshCache } = preAlloc
              return {
                /**
                 * Sync scene with loaded chunks:
                 * - Add meshes for newly loaded chunks not yet in scene (throttled to MAX_CHUNK_UPDATES_PER_FRAME)
                 * - Remove and dispose meshes for chunks no longer loaded (always immediate)
                 *
                 * Returns `true` when all loaded chunks have meshes (fully synced),
                 * `false` when some new chunks were deferred to subsequent frames.
                 */
                syncChunksToScene: (loadedChunks: ReadonlyArray<Chunk>, scene: THREE.Scene): Effect.Effect<boolean, never> =>
                  Effect.gen(function* () {
                    const meshes = yield* Ref.get(meshesRef)

                    // Early-exit phase 1: check for new chunks — no Set allocation needed.
                    const newChunks = Arr.filter(loadedChunks, (c) => !HashMap.has(meshes, chunkKey(c.coord)))
                    const hasNewChunks = newChunks.length > 0

                    // Early-exit phase 2: detect removals cheaply.
                    const hasRemovedChunks = !hasNewChunks && loadedChunks.length < HashMap.size(meshes)

                    if (!hasNewChunks && !hasRemovedChunks) {
                      return true
                    }

                    // Allocate loadedKeys Set only after confirming work is needed
                    const loadedKeySet = HashSet.fromIterable(Arr.map(loadedChunks, (c) => chunkKey(c.coord)))

                    // Add meshes for newly loaded chunks not yet in scene.
                    // Throttle: process at most MAX_CHUNK_UPDATES_PER_FRAME new chunks per call
                    // to avoid frame spikes when many chunks become dirty simultaneously.
                    // Remaining new chunks will be picked up in subsequent frames.
                    const chunksToMesh = Arr.take(newChunks, MAX_CHUNK_UPDATES_PER_FRAME)
                    const allNewChunksMeshed = newChunks.length <= MAX_CHUNK_UPDATES_PER_FRAME
                    const nextMeshesAfterAdd = yield* Effect.reduce(
                      chunksToMesh,
                      meshes,
                      (acc, chunk) => {
                        const key = chunkKey(chunk.coord)
                        return chunkMeshService.createChunkMesh(chunk, waterMaterial).pipe(
                          Effect.flatMap(({ opaqueMesh, waterMesh }) =>
                            Effect.all([
                              sceneService.add(scene, opaqueMesh),
                              Option.match(waterMesh, {
                                onNone: () => Effect.void,
                                onSome: (m) => sceneService.add(scene, m),
                              }),
                            ], { concurrency: 'unbounded', discard: true }).pipe(
                              Effect.as(HashMap.set(acc, key, { opaque: opaqueMesh, water: waterMesh }))
                            )
                          )
                        )
                      }
                    )

                    // Remove meshes for chunks no longer loaded (iterate original snapshot)
                    const nextMeshes = yield* Effect.reduce(
                      Arr.fromIterable(meshes),
                      nextMeshesAfterAdd,
                      (acc, [key, chunkMeshes]) => {
                        if (HashSet.has(loadedKeySet, key)) return Effect.succeed(acc)
                        return Effect.all([
                          sceneService.remove(scene, chunkMeshes.opaque).pipe(
                            Effect.andThen(Effect.sync(() => disposeMesh(chunkMeshes.opaque)))
                          ),
                          Option.match(chunkMeshes.water, {
                            onNone: () => Effect.void,
                            onSome: (m) =>
                              sceneService.remove(scene, m).pipe(
                                Effect.andThen(Effect.sync(() => disposeMesh(m)))
                              ),
                          }),
                        ], { concurrency: 'unbounded', discard: true }).pipe(
                          Effect.as(HashMap.remove(acc, key))
                        )
                      }
                    )

                    // Rebuild stable water mesh list
                    const nextWaterMeshes = Arr.filterMap(Arr.fromIterable(HashMap.values(nextMeshes)), (cm) => cm.water)
                    yield* Effect.all([
                      Ref.set(meshesRef, nextMeshes),
                      Ref.set(waterMeshesRef, nextWaterMeshes),
                    ], { concurrency: 'unbounded', discard: true })

                    return allNewChunksMeshed
                  }),

                /**
                 * Update (re-mesh) a single chunk that has been modified.
                 * Call this after block break/place for the affected chunk.
                 */
                updateChunkInScene: (chunk: Chunk, scene: THREE.Scene): Effect.Effect<void, never> => {
                  const key = chunkKey(chunk.coord)
                  return Ref.get(meshesRef).pipe(
                    Effect.flatMap((meshes) => Option.match(HashMap.get(meshes, key), {
                      onSome: (existing) =>
                        // Reuse the existing mesh: update geometry in place, avoiding scene graph mutation
                        chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk),
                      onNone: () =>
                        // First time this chunk appears — create and register a new mesh
                        chunkMeshService.createChunkMesh(chunk, waterMaterial).pipe(
                          Effect.flatMap(({ opaqueMesh, waterMesh }) =>
                            Effect.all([
                              sceneService.add(scene, opaqueMesh),
                              Option.match(waterMesh, {
                                onNone: () => Effect.void,
                                onSome: (m) =>
                                  sceneService.add(scene, m).pipe(
                                    Effect.andThen(Ref.update(waterMeshesRef, (waterMeshes) => Arr.append(waterMeshes, m)))
                                  ),
                              }),
                            ], { concurrency: 'unbounded', discard: true }).pipe(
                              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: opaqueMesh, water: waterMesh })))
                            )
                          )
                        ),
                    }))
                  )
                },

                /**
                 * Apply frustum culling: toggle mesh.visible for all tracked chunk meshes.
                 * Does NOT add/remove objects from scene (avoids scene graph mutation overhead).
                 */
                applyFrustumCulling: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
                  // camera.updateMatrixWorld() is intentionally called here even though Three.js
                  // also calls it during renderer.render(). This method runs BEFORE render() in the
                  // frame pipeline, so the camera world matrix may be stale (camera.position was
                  // just updated in step 8). Without this call, frustum culling would use last
                  // frame's matrix, causing one-frame-behind popping artifacts.
                  Ref.get(meshesRef).pipe(
                    Effect.flatMap((meshes) =>
                      Effect.sync(() => {
                        camera.updateMatrixWorld()
                        _projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
                        _frustum.setFromProjectionMatrix(_projMatrix)

                        // Performance boundary: imperative loop avoids ~500-900 allocations/frame
                        // from Arr.fromIterable + Option.fromNullable + Option.match per chunk
                        for (const chunkMeshes of HashMap.values(meshes)) {
                          const coord = chunkMeshes.opaque.userData['chunkCoord'] as ChunkCoord | undefined
                          if (coord == null) continue

                          _minVec.set(coord.x * CHUNK_SIZE, 0, coord.z * CHUNK_SIZE)
                          _maxVec.set(coord.x * CHUNK_SIZE + CHUNK_SIZE, CHUNK_HEIGHT, coord.z * CHUNK_SIZE + CHUNK_SIZE)
                          _box.set(_minVec, _maxVec)

                          const visible = _frustum.intersectsBox(_box)
                          chunkMeshes.opaque.visible = visible
                          // Shadow distance culling: disable castShadow for chunks beyond shadow reach.
                          // Shadow map has finite resolution — distant shadows are sub-texel and waste GPU fill.
                          const SHADOW_CULL_DIST_SQ = MAX_SHADOW_HALF_EXTENT * MAX_SHADOW_HALF_EXTENT
                          const dx = coord.x * CHUNK_SIZE + CHUNK_SIZE * 0.5 - camera.position.x
                          const dz = coord.z * CHUNK_SIZE + CHUNK_SIZE * 0.5 - camera.position.z
                          chunkMeshes.opaque.castShadow = visible && (dx * dx + dz * dz) < SHADOW_CULL_DIST_SQ
                          // Performance boundary: direct _tag check avoids Option.match closure allocation per chunk
                          if (chunkMeshes.water._tag === 'Some') {
                            chunkMeshes.water.value.visible = visible
                          }
                        }
                      })
                    )
                  ),

                /**
                 * Remove all chunk meshes from scene and dispose resources
                 */
                clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
                  Ref.get(meshesRef).pipe(
                    Effect.flatMap((meshes) =>
                      Effect.forEach(
                        Arr.fromIterable(HashMap.values(meshes)),
                        (chunkMeshes) =>
                          Effect.all([
                            sceneService.remove(scene, chunkMeshes.opaque).pipe(
                              Effect.andThen(Effect.sync(() => disposeMesh(chunkMeshes.opaque)))
                            ),
                            Option.match(chunkMeshes.water, {
                              onNone: () => Effect.void,
                              onSome: (m) =>
                                sceneService.remove(scene, m).pipe(
                                  Effect.andThen(Effect.sync(() => disposeMesh(m)))
                                ),
                            }),
                          ], { concurrency: 'unbounded', discard: true }),
                        { concurrency: 1 }
                      )
                    ),
                    Effect.andThen(Effect.all([
                      Ref.set(meshesRef, HashMap.empty()),
                      Ref.set(waterMeshesRef, []),
                    ], { concurrency: 'unbounded', discard: true }))
                  ),

                /**
                 * Refraction pre-pass: render scene without water meshes into refractionRT.
                 * Call this every frame BEFORE the main render.
                 */
                doRefractionPrePass: (
                  renderer: THREE.WebGLRenderer,
                  scene: THREE.Scene,
                  camera: THREE.Camera
                ): Effect.Effect<void, never> =>
                  Ref.get(waterMeshesRef).pipe(
                    Effect.flatMap((waterMeshes) => {
                      if (waterMeshes.length === 0) return Effect.void
                      // Skip refraction render when no water meshes are visible (all frustum-culled)
                      if (!Arr.some(waterMeshes, (m) => m.visible)) return Effect.void
                      // Save current visibility and hide water meshes for the refraction render
                      return Effect.sync(() => {
                        _savedWaterVisibility.clear()
                        Arr.forEach(waterMeshes, (mesh) => {
                          _savedWaterVisibility.set(mesh, mesh.visible)
                          mesh.visible = false
                        })
                      }).pipe(
                        // Suppress shadow pass during refraction render — at low resolution,
                        // shadow detail is invisible through water distortion. Saves one full shadow pass.
                        // try/finally ensures shadow autoUpdate is restored even on WebGL context loss.
                        Effect.andThen(Effect.sync(() => {
                          // Sync refraction camera with main camera's position/rotation (cheap copy, no projection recompute)
                          refractionCamera.position.copy(camera.position)
                          refractionCamera.quaternion.copy(camera.quaternion)
                          refractionCamera.updateMatrixWorld()
                          const savedAutoUpdate = renderer.shadowMap.autoUpdate
                          renderer.shadowMap.autoUpdate = false
                          renderer.shadowMap.needsUpdate = false
                          renderer.setRenderTarget(refractionRT)
                          try {
                            renderer.render(scene, refractionCamera)
                          } finally {
                            renderer.setRenderTarget(null)
                            renderer.shadowMap.autoUpdate = savedAutoUpdate
                            // Restore saved visibility state (preserves frustum culling result)
                            for (const [mesh, wasVisible] of _savedWaterVisibility) {
                              mesh.visible = wasVisible
                            }
                          }
                        }))
                      )
                    })
                  ),

                /**
                 * Update water shader uniforms each frame.
                 */
                updateWaterUniforms: (
                  time: number,
                  cameraPosition: THREE.Vector3,
                ): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    const uniforms = waterMaterial.uniforms
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    uniforms['uTime']!.value = time
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    ;(uniforms['uCameraPosition']!.value as THREE.Vector3).copy(cameraPosition)
                  }),

                /**
                 * Mark refraction texture as valid (called once after first refraction pre-pass).
                 */
                setRefractionValid: (valid: boolean): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    waterMaterial.uniforms['uRefractionValid']!.value = valid
                  }),

                /**
                 * Update water resolution uniform — called only on resize (not per-frame).
                 */
                updateWaterResolution: (width: number, height: number): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    ;(waterMaterial.uniforms['uResolution']!.value as THREE.Vector2).set(width, height)
                  }),

                /**
                 * Resize refraction render target when canvas resizes.
                 */
                resizeRefractionRT: (width: number, height: number): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    refractionRT.setSize(width, height)
                  }),

                /**
                 * Sync refraction camera aspect ratio with main camera on resize.
                 * Only calls updateProjectionMatrix once per resize (not per frame).
                 */
                resizeRefractionCamera: (aspect: number): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    refractionCamera.aspect = aspect
                    refractionCamera.updateProjectionMatrix()
                  }),

                /**
                 * Get all currently tracked water meshes.
                 * Returns a reference-stable array: same reference is returned when the
                 * water mesh set has not changed (by length + individual mesh identity),
                 * so callers can skip downstream work via `===` check.
                 */
                getWaterMeshes: (): Effect.Effect<ReadonlyArray<THREE.Mesh>, never> =>
                  Ref.get(waterMeshesRef).pipe(
                    Effect.map((current) => {
                      const cached = MutableRef.get(_waterMeshCache)
                      if (
                        current.length === cached.length &&
                        Arr.every(current, (mesh, i) => mesh === cached[i])
                      ) {
                        return cached
                      }
                      MutableRef.set(_waterMeshCache, current)
                      return current
                    })
                  ),
              }
              })
            )
          )
        ))
        )
      )
    ),
    dependencies: [ChunkMeshService.Default, SceneService.Default],
  }
) {}
export const WorldRendererServiceLive = WorldRendererService.Default
