import { Array as Arr, Effect, HashMap, HashSet, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import { ChunkCacheKey } from '@ts-minecraft/kernel'
import { MAX_SHADOW_HALF_EXTENT } from '@ts-minecraft/kernel'
import { ChunkMeshService } from '../infrastructure/meshing/chunk-mesh'
import { SceneService } from '../infrastructure/scene/scene-service'
import { createWaterMaterial } from '../infrastructure/water-material'

/**
 * Hard safety cap on chunk mesh creations per syncChunksToScene call.
 * The primary throttle is now `WORLD_RENDERER_TIME_BUDGET_MS`; this cap only
 * exists so a degenerate single-mesh-takes-100ms case doesn't loop forever.
 * Raised from 4 to 8 to mirror MAX_DIRTY_CHUNK_UPDATES_PER_FRAME — the time
 * budget is the real throttle and 8 typical meshes at ~1ms each comfortably
 * fit under WORLD_RENDERER_TIME_BUDGET_MS.
 * Only throttles creation — removal of stale chunks is always immediate.
 */
export const MAX_CHUNK_UPDATES_PER_FRAME = 8

/**
 * Time budget (ms) for chunk mesh creation per syncChunksToScene call.
 * Drains the new-chunks queue one mesh at a time and breaks once the elapsed
 * wall-clock exceeds this budget. Mirrors `DIRTY_CHUNK_FLUSH_TIME_BUDGET_MS`
 * in frame-maintenance — the two pipelines target the same per-frame budget.
 * At cold-start with RD=2 (25 chunks) this turns the 4-per-frame drip into
 * "as many as fit in this frame's idle window".
 */
export const WORLD_RENDERER_TIME_BUDGET_MS = 4

const CHUNK_SYNC_CONCURRENCY = typeof Worker === 'undefined' ? 1 : 2

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

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

type ChunkMeshes = {
  opaque: THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
    }
  }
  water: Option.Option<THREE.Mesh & {
    readonly userData: THREE.Mesh['userData'] & {
      readonly chunkCoord?: ChunkCoord
    }
  }>
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
      // Cache key for frustum culling — invalidated whenever chunk meshes change.
      Ref.make({ x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN, p0: NaN, p5: NaN, p10: NaN, p14: NaN }),
      Ref.make(0),
      // Pre-allocated objects for frustum culling and refraction pre-pass — reused every frame to avoid GC pressure
      Effect.sync(() => ({
        _frustum: new THREE.Frustum(),
        _projMatrix: new THREE.Matrix4(),
        _box: new THREE.Box3(),
        _minVec: new THREE.Vector3(),
        _maxVec: new THREE.Vector3(),
        _savedWaterVisibility: MutableRef.make(new Map<THREE.Mesh, boolean>()),
        // Water mesh cache — only return new reference when the mesh set actually changes
        _waterMeshCache: MutableRef.make<ReadonlyArray<THREE.Mesh>>([]),
        // Refraction cache — reused until camera pose or scene version changes
        _lastRefractionState: MutableRef.make({
          version: -1,
          x: NaN,
          y: NaN,
          z: NaN,
          qx: NaN,
          qy: NaN,
          qz: NaN,
          qw: NaN,
        }),
      })),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([chunkMeshService, sceneService, meshesRef, waterMeshesRef, lastFrustumPoseRef, sceneVersionRef, preAlloc]) =>
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
              const { _frustum, _projMatrix, _box, _minVec, _maxVec, _savedWaterVisibility, _waterMeshCache, _lastRefractionState } = preAlloc
              const invalidateFrustumCache = () =>
                Ref.set(lastFrustumPoseRef, { x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN, p0: NaN, p5: NaN, p10: NaN, p14: NaN })
              const invalidateSceneCaches = () =>
                Effect.all([
                  invalidateFrustumCache(),
                  Ref.update(sceneVersionRef, (version) => version + 1),
                ], { concurrency: 'unbounded', discard: true })
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
                    // Throttle: drain one chunk at a time, checking elapsed wall-clock
                    // time after each. Stop when WORLD_RENDERER_TIME_BUDGET_MS is reached
                    // OR MAX_CHUNK_UPDATES_PER_FRAME (hard safety cap) is hit. Remaining
                    // chunks are picked up next frame. Mirrors the dirty-chunk drain in
                    // frame-maintenance.ts (same time-budget pattern).
                    //
                    // CHUNK_SYNC_CONCURRENCY is preserved as concurrency: 1 here for
                    // correctness — we need to check the time budget AFTER each
                    // createChunkMesh, which only works if the inner pipeline is
                    // sequential. The previous concurrency: CHUNK_SYNC_CONCURRENCY (=2)
                    // batched the work and would overshoot the budget by up to one full
                    // mesh build. Per-frame impact is negligible because meshing is
                    // mostly main-thread sync work anyway.
                    const startMs = nowMs()
                    const hardCap = Math.min(MAX_CHUNK_UPDATES_PER_FRAME, newChunks.length)
                    const meshedChunks: Array<readonly [ChunkCacheKey, { opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh> }]> = []
                    let processed = 0
                    for (let i = 0; i < hardCap; i++) {
                      const chunk = newChunks[i]
                      if (chunk === undefined) break
                      const chunkMeshes = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
                      meshedChunks.push([chunkKey(chunk.coord), chunkMeshes] as const)
                      processed = i + 1
                      if (nowMs() - startMs >= WORLD_RENDERER_TIME_BUDGET_MS) break
                    }
                    // allNewChunksMeshed is `false` if either the time budget OR the hard
                    // cap stopped us short of draining the entire newChunks queue.
                    const allNewChunksMeshed = processed >= newChunks.length

                    const nextMeshesAfterAdd = yield* Effect.all(
                      Arr.map(meshedChunks, ([key, { opaqueMesh, waterMesh }]) =>
                        Effect.all([
                          sceneService.add(scene, opaqueMesh),
                          Option.match(waterMesh, {
                            onNone: () => Effect.void,
                            onSome: (m) => sceneService.add(scene, m),
                          }),
                        ], { concurrency: 'unbounded', discard: true }).pipe(
                          Effect.as([key, { opaque: opaqueMesh, water: waterMesh }] as const)
                        )
                      ),
                      { concurrency: CHUNK_SYNC_CONCURRENCY }
                    ).pipe(
                      Effect.map((added) =>
                        Arr.reduce(added, meshes, (acc, [key, chunkMeshes]) => HashMap.set(acc, key, chunkMeshes))
                      )
                    )

                    // Remove meshes for chunks no longer loaded (iterate original snapshot)
                    const removalPairs = Arr.filterMap(
                      Arr.fromIterable(meshes),
                      ([key, chunkMeshes]) => HashSet.has(loadedKeySet, key) ? Option.none() : Option.some([key, chunkMeshes] as const)
                    )

                    const removedKeys = yield* Effect.all(
                      Arr.map(removalPairs, ([key, chunkMeshes]) =>
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
                        ], { concurrency: 'unbounded', discard: true }).pipe(
                          Effect.as(key)
                        )
                      ),
                      { concurrency: CHUNK_SYNC_CONCURRENCY }
                    )

                    const nextMeshes = Arr.reduce(removedKeys, nextMeshesAfterAdd, (acc, key) => HashMap.remove(acc, key))

                    // Rebuild stable water mesh list
                    const nextWaterMeshes = Arr.filterMap(Arr.fromIterable(HashMap.values(nextMeshes)), (cm) => cm.water)
                    yield* Effect.all([
                      Ref.set(meshesRef, nextMeshes),
                      Ref.set(waterMeshesRef, nextWaterMeshes),
                      invalidateSceneCaches(),
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
                        chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial).pipe(
                          Effect.flatMap((nextWaterMesh) => {
                            const updateWaterScene = Option.match(existing.water, {
                              onNone: () => Option.match(nextWaterMesh, {
                                onNone: () => Effect.void,
                                onSome: (m) => sceneService.add(scene, m).pipe(
                                  Effect.andThen(Ref.update(waterMeshesRef, (waterMeshes) => Arr.append(waterMeshes, m)))
                                ),
                              }),
                              onSome: (oldWaterMesh) => Option.match(nextWaterMesh, {
                                onNone: () => sceneService.remove(scene, oldWaterMesh).pipe(
                                  Effect.andThen(Ref.update(waterMeshesRef, (waterMeshes) => Arr.filter(waterMeshes, (mesh) => mesh !== oldWaterMesh)))
                                ),
                                onSome: (newWaterMesh) => oldWaterMesh === newWaterMesh
                                  ? Effect.void
                                  : Effect.all([
                                    sceneService.remove(scene, oldWaterMesh),
                                    sceneService.add(scene, newWaterMesh),
                                    Ref.update(waterMeshesRef, (waterMeshes) => Arr.append(Arr.filter(waterMeshes, (mesh) => mesh !== oldWaterMesh), newWaterMesh)),
                                  ], { concurrency: 'unbounded', discard: true }),
                              }),
                            })

                            return updateWaterScene.pipe(
                              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: existing.opaque, water: nextWaterMesh }))),
                              Effect.andThen(invalidateSceneCaches())
                            )
                          })
                        ),
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
                              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: opaqueMesh, water: waterMesh }))),
                              Effect.andThen(invalidateSceneCaches())
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
                      Ref.get(lastFrustumPoseRef).pipe(
                        Effect.flatMap((lastPose) => Effect.gen(function* () {
                          // Compare camera state against lastPose inline first; only allocate
                          // a new pose object when something actually changed. The hot-path
                          // (camera idle) returns immediately with zero allocations.
                          const cx = camera.position.x
                          const cy = camera.position.y
                          const cz = camera.position.z
                          const qx = camera.quaternion.x
                          const qy = camera.quaternion.y
                          const qz = camera.quaternion.z
                          const qw = camera.quaternion.w
                          const p0 = camera.projectionMatrix.elements[0]
                          const p5 = camera.projectionMatrix.elements[5]
                          const p10 = camera.projectionMatrix.elements[10]
                          const p14 = camera.projectionMatrix.elements[14]

                          if (
                            lastPose.x === cx &&
                            lastPose.y === cy &&
                            lastPose.z === cz &&
                            lastPose.qx === qx &&
                            lastPose.qy === qy &&
                            lastPose.qz === qz &&
                            lastPose.qw === qw &&
                            lastPose.p0 === p0 &&
                            lastPose.p5 === p5 &&
                            lastPose.p10 === p10 &&
                            lastPose.p14 === p14
                          ) {
                            return
                          }

                          camera.updateMatrixWorld()
                          _projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
                          _frustum.setFromProjectionMatrix(_projMatrix)

                          // Performance boundary: imperative loop avoids ~500-900 allocations/frame
                          // from Arr.fromIterable + Option.fromNullable + Option.match per chunk
                          for (const chunkMeshes of HashMap.values(meshes)) {
                            const coord = chunkMeshes.opaque.userData.chunkCoord
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

                          yield* Ref.set(lastFrustumPoseRef, { x: cx, y: cy, z: cz, qx, qy, qz, qw, p0, p5, p10, p14 })
                        }))
                      )
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
                      invalidateSceneCaches(),
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
                  Effect.gen(function* () {
                    const waterMeshes = yield* Ref.get(waterMeshesRef)
                    if (waterMeshes.length === 0) return
                    // Skip refraction render when no water meshes are visible (all frustum-culled)
                    if (!Arr.some(waterMeshes, (m) => m.visible)) return

                    const currentSceneVersion = yield* Ref.get(sceneVersionRef)
                    const currentPose = {
                      x: camera.position.x,
                      y: camera.position.y,
                      z: camera.position.z,
                      qx: camera.quaternion.x,
                      qy: camera.quaternion.y,
                      qz: camera.quaternion.z,
                      qw: camera.quaternion.w,
                    }
                    const lastRefractionState = MutableRef.get(_lastRefractionState)
                    if (
                      lastRefractionState.version === currentSceneVersion &&
                      lastRefractionState.x === currentPose.x &&
                      lastRefractionState.y === currentPose.y &&
                      lastRefractionState.z === currentPose.z &&
                      lastRefractionState.qx === currentPose.qx &&
                      lastRefractionState.qy === currentPose.qy &&
                      lastRefractionState.qz === currentPose.qz &&
                      lastRefractionState.qw === currentPose.qw
                    ) {
                      return
                    }

                    const savedWaterVisibility = MutableRef.get(_savedWaterVisibility)
                    yield* Effect.sync(() => {
                      savedWaterVisibility.clear()
                      Arr.forEach(waterMeshes, (mesh) => {
                        savedWaterVisibility.set(mesh, mesh.visible)
                        mesh.visible = false
                      })

                      // Sync refraction camera with main camera's position/rotation (cheap copy, no projection recompute)
                      refractionCamera.position.copy(camera.position)
                      refractionCamera.quaternion.copy(camera.quaternion)
                      refractionCamera.updateMatrixWorld()
                    })

                    const savedAutoUpdate = renderer.shadowMap.autoUpdate
                    renderer.shadowMap.autoUpdate = false
                    renderer.shadowMap.needsUpdate = false
                    renderer.setRenderTarget(refractionRT)

                    yield* Effect.ensuring(
                      Effect.sync(() => {
                        renderer.render(scene, refractionCamera)
                      }),
                      Effect.sync(() => {
                        renderer.setRenderTarget(null)
                        renderer.shadowMap.autoUpdate = savedAutoUpdate
                        // Restore saved visibility state (preserves frustum culling result)
                        for (const [mesh, wasVisible] of savedWaterVisibility) {
                          mesh.visible = wasVisible
                        }
                      })
                    )

                    MutableRef.set(_lastRefractionState, { version: currentSceneVersion, ...currentPose })
                  }),

                /**
                 * Update water shader uniforms each frame.
                 */
                updateWaterUniforms: (
                  time: number,
                  cameraPosition: THREE.Vector3,
                ): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    const uniforms = waterMaterial.uniforms
                    uniforms.uTime.value = time
                    uniforms.uCameraPosition.value.copy(cameraPosition)
                  }),

                /**
                 * Mark refraction texture as valid (called once after first refraction pre-pass).
                 */
                setRefractionValid: (valid: boolean): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    waterMaterial.uniforms.uRefractionValid.value = valid
                  }),

                /**
                 * Update water resolution uniform — called only on resize (not per-frame).
                 */
                updateWaterResolution: (width: number, height: number): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    waterMaterial.uniforms.uResolution.value.set(width, height)
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

                /**
                 * Monotonic scene version used to gate repeated frame-loop work.
                 */
                getSceneVersion: (): Effect.Effect<number, never> => Ref.get(sceneVersionRef),
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
