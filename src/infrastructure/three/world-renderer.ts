import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import { Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { ChunkMeshService } from './meshing/chunk-mesh'
import { SceneService } from './scene/scene-service'
import { createWaterMaterial } from './water-material'

/**
 * Key for chunk mesh tracking
 */
const chunkKey = (coord: ChunkCoord): string => `${coord.x},${coord.z}`

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
    scoped: Effect.gen(function* () {
      const chunkMeshService = yield* ChunkMeshService
      const sceneService = yield* SceneService
      const meshesRef = yield* Ref.make(HashMap.empty<string, ChunkMeshes>())
      // Stable water mesh list for SSRPass.selects — only replaced (new array reference) when
      // chunks are added/removed. SSRPass setter short-circuits when reference is identical,
      // preventing per-frame shader recompilation (60 Hz) that would otherwise occur.
      const waterMeshesRef = yield* Ref.make<ReadonlyArray<THREE.Mesh>>([])

      // Refraction render target — GPU resource, disposed on scope close
      const refractionRT = yield* Effect.acquireRelease(
        Effect.sync(() =>
          new THREE.WebGLRenderTarget(800, 600, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
          })
        ),
        (rt) => Effect.sync(() => rt.dispose())
      )

      // Water ShaderMaterial — GPU resource, disposed on scope close
      const waterMaterial = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createWaterMaterial(
            refractionRT.texture,
            800,
            600
          )
        ),
        (mat) => Effect.sync(() => mat.dispose())
      )

      // Pre-allocated objects for frustum culling and refraction pre-pass — reused every frame to avoid GC pressure
      const { _frustum, _projMatrix, _box, _minVec, _maxVec, _savedWaterVisibility } = yield* Effect.sync(() => ({
        _frustum: new THREE.Frustum(),
        _projMatrix: new THREE.Matrix4(),
        _box: new THREE.Box3(),
        _minVec: new THREE.Vector3(),
        _maxVec: new THREE.Vector3(),
        _savedWaterVisibility: new Map<THREE.Mesh, boolean>(),
      }))

      return {
        /**
         * Sync scene with loaded chunks:
         * - Add meshes for newly loaded chunks not yet in scene
         * - Remove and dispose meshes for chunks no longer loaded
         */
        syncChunksToScene: (loadedChunks: ReadonlyArray<Chunk>, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)

            // Early-exit phase 1: check for new chunks — no Set allocation needed.
            const hasNewChunks = Arr.some(loadedChunks, (c) => !HashMap.has(meshes, chunkKey(c.coord)))

            // Early-exit phase 2: detect removals cheaply.
            const hasRemovedChunks = !hasNewChunks && loadedChunks.length < HashMap.size(meshes)

            if (!hasNewChunks && !hasRemovedChunks) {
              return
            }

            // Allocate loadedKeys Set only after confirming work is needed
            const loadedKeySet = HashSet.fromIterable(Arr.map(loadedChunks, (c) => chunkKey(c.coord)))

            // Add meshes for newly loaded chunks not yet in scene
            const nextMeshesAfterAdd = yield* Effect.reduce(
              loadedChunks,
              meshes,
              (acc, chunk) => {
                const key = chunkKey(chunk.coord)
                if (HashMap.has(acc, key)) return Effect.succeed(acc)
                return Effect.gen(function* () {
                  const { opaqueMesh, waterMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
                  yield* sceneService.add(scene, opaqueMesh)
                  yield* Option.match(waterMesh, {
                    onNone: () => Effect.void,
                    onSome: (m) => sceneService.add(scene, m),
                  })
                  return HashMap.set(acc, key, { opaque: opaqueMesh, water: waterMesh })
                })
              }
            )

            // Remove meshes for chunks no longer loaded (iterate original snapshot)
            const nextMeshes = yield* Effect.reduce(
              Arr.fromIterable(meshes),
              nextMeshesAfterAdd,
              (acc, [key, chunkMeshes]) => {
                if (HashSet.has(loadedKeySet, key)) return Effect.succeed(acc)
                return Effect.gen(function* () {
                  yield* sceneService.remove(scene, chunkMeshes.opaque)
                  yield* Effect.sync(() => disposeMesh(chunkMeshes.opaque))
                  yield* Option.match(chunkMeshes.water, {
                    onNone: () => Effect.void,
                    onSome: (m) => Effect.gen(function* () {
                      yield* sceneService.remove(scene, m)
                      yield* Effect.sync(() => disposeMesh(m))
                    }),
                  })
                  return HashMap.remove(acc, key)
                })
              }
            )

            yield* Ref.set(meshesRef, nextMeshes)

            // Rebuild stable water mesh list for SSRPass.selects
            const nextWaterMeshes = Arr.filterMap(Arr.fromIterable(HashMap.values(nextMeshes)), (cm) => cm.water)
            yield* Ref.set(waterMeshesRef, nextWaterMeshes)
          }),

        /**
         * Update (re-mesh) a single chunk that has been modified.
         * Call this after block break/place for the affected chunk.
         */
        updateChunkInScene: (chunk: Chunk, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const key = chunkKey(chunk.coord)
            const meshes = yield* Ref.get(meshesRef)

            yield* Option.match(HashMap.get(meshes, key), {
              onSome: (existing) =>
                // Reuse the existing mesh: update geometry in place, avoiding scene graph mutation
                chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk),
              onNone: () => Effect.gen(function* () {
                // First time this chunk appears — create and register a new mesh
                const { opaqueMesh, waterMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
                yield* sceneService.add(scene, opaqueMesh)
                yield* Option.match(waterMesh, {
                  onNone: () => Effect.void,
                  onSome: (m) => sceneService.add(scene, m),
                })
                yield* Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: opaqueMesh, water: waterMesh }))
              }),
            })
          }),

        /**
         * Apply frustum culling: toggle mesh.visible for all tracked chunk meshes.
         * Does NOT add/remove objects from scene (avoids scene graph mutation overhead).
         */
        applyFrustumCulling: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            // camera.updateMatrixWorld() is intentionally called here even though Three.js
            // also calls it during renderer.render(). This method runs BEFORE render() in the
            // frame pipeline, so the camera world matrix may be stale (camera.position was
            // just updated in step 8). Without this call, frustum culling would use last
            // frame's matrix, causing one-frame-behind popping artifacts.
            yield* Effect.sync(() => {
              camera.updateMatrixWorld()
              _projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
              _frustum.setFromProjectionMatrix(_projMatrix)
            })

            const meshes = yield* Ref.get(meshesRef)

            yield* Effect.sync(() => {
              Arr.forEach(Arr.fromIterable(HashMap.values(meshes)), (chunkMeshes) => {
                Option.map(
                  Option.fromNullable(chunkMeshes.opaque.userData['chunkCoord'] as ChunkCoord | null),
                  (coord) => {
                    _minVec.set(coord.x * CHUNK_SIZE, 0, coord.z * CHUNK_SIZE)
                    _maxVec.set(coord.x * CHUNK_SIZE + CHUNK_SIZE, CHUNK_HEIGHT, coord.z * CHUNK_SIZE + CHUNK_SIZE)
                    _box.set(_minVec, _maxVec)
                    const visible = _frustum.intersectsBox(_box)
                    chunkMeshes.opaque.visible = visible
                    Option.map(chunkMeshes.water, (m) => { m.visible = visible })
                  }
                )
              })
            })
          }),

        /**
         * Remove all chunk meshes from scene and dispose resources
         */
        clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)
            yield* Effect.forEach(
              Arr.fromIterable(HashMap.values(meshes)),
              (chunkMeshes) => Effect.gen(function* () {
                yield* sceneService.remove(scene, chunkMeshes.opaque)
                yield* Effect.sync(() => disposeMesh(chunkMeshes.opaque))
                yield* Option.match(chunkMeshes.water, {
                  onNone: () => Effect.void,
                  onSome: (m) => Effect.gen(function* () {
                    yield* sceneService.remove(scene, m)
                    yield* Effect.sync(() => disposeMesh(m))
                  }),
                })
              }),
              { concurrency: 1 }
            )
            yield* Ref.set(meshesRef, HashMap.empty())
          }),

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
            const meshes = yield* Ref.get(meshesRef)

            // Save current visibility and hide water meshes for the refraction render
            yield* Effect.sync(() => {
              _savedWaterVisibility.clear()
              Arr.forEach(Arr.fromIterable(HashMap.values(meshes)), (chunkMeshes) => {
                Option.map(chunkMeshes.water, (m) => {
                  _savedWaterVisibility.set(m, m.visible)
                  m.visible = false
                })
              })
            })

            yield* Effect.sync(() => {
              renderer.setRenderTarget(refractionRT)
              renderer.render(scene, camera)
              renderer.setRenderTarget(null)
            })

            // Restore saved visibility state (preserves frustum culling result)
            yield* Effect.sync(() => {
              for (const [mesh, wasVisible] of _savedWaterVisibility) {
                mesh.visible = wasVisible
              }
            })
          }),

        /**
         * Update water shader uniforms each frame.
         */
        updateWaterUniforms: (
          time: number,
          cameraPosition: THREE.Vector3,
          width: number,
          height: number
        ): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const uniforms = waterMaterial.uniforms
            Option.map(Option.fromNullable(uniforms['uTime']), (u) => { u.value = time })
            Option.map(Option.fromNullable(uniforms['uCameraPosition']), (u) => { (u.value as THREE.Vector3).copy(cameraPosition) })
            Option.map(Option.fromNullable(uniforms['uResolution']), (u) => { (u.value as THREE.Vector2).set(width, height) })
          }),

        /**
         * Resize refraction render target when canvas resizes.
         */
        resizeRefractionRT: (width: number, height: number): Effect.Effect<void, never> =>
          Effect.sync(() => {
            refractionRT.setSize(width, height)
          }),

        /**
         * Get all currently tracked water meshes for SSR pass selects.
         * Returns only non-null water meshes that are currently visible.
         */
        getWaterMeshes: (): Effect.Effect<ReadonlyArray<THREE.Mesh>, never> =>
          Ref.get(waterMeshesRef),
      }
    }),
    dependencies: [ChunkMeshService.Default, SceneService.Default],
  }
) {}
export const WorldRendererServiceLive = WorldRendererService.Default
