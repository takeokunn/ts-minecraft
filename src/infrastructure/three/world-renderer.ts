import { Effect, Ref } from 'effect'
import * as THREE from 'three'
import { Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { ChunkMeshService } from './meshing/chunk-mesh'
import { SceneService } from './scene/scene-service'

/**
 * Key for chunk mesh tracking
 */
const chunkKey = (coord: ChunkCoord): string => `${coord.x},${coord.z}`

// Only dispose geometry; materials may be shared across chunk meshes
const disposeMesh = (mesh: THREE.Mesh): void => {
  mesh.geometry.dispose()
}

/**
 * Service for synchronizing chunk state with Three.js scene
 */
export class WorldRendererService extends Effect.Service<WorldRendererService>()(
  '@minecraft/infrastructure/WorldRendererService',
  {
    effect: Effect.gen(function* () {
      const chunkMeshService = yield* ChunkMeshService
      const sceneService = yield* SceneService
      const meshesRef = yield* Ref.make<Map<string, THREE.Mesh>>(new Map())

      // Pre-allocated objects for frustum culling — reused every frame to avoid GC pressure
      const _frustum = new THREE.Frustum()
      const _projMatrix = new THREE.Matrix4()
      const _box = new THREE.Box3()
      const _minVec = new THREE.Vector3()
      const _maxVec = new THREE.Vector3()

      return {
        /**
         * Sync scene with loaded chunks:
         * - Add meshes for newly loaded chunks not yet in scene
         * - Remove and dispose meshes for chunks no longer loaded
         */
        syncChunksToScene: (loadedChunks: ReadonlyArray<Chunk>, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const loadedKeys = new Set(loadedChunks.map((c) => chunkKey(c.coord)))
            const meshes = yield* Ref.get(meshesRef)

            // Early-exit: check if there are any changes before cloning the Map
            const hasNewChunks = loadedChunks.some((c) => !meshes.has(chunkKey(c.coord)))
            const hasRemovedChunks = Array.from(meshes.keys()).some((k) => !loadedKeys.has(k))
            if (!hasNewChunks && !hasRemovedChunks) {
              return
            }

            const nextMeshes = new Map(meshes)

            // Add meshes for newly loaded chunks not yet in scene
            for (const chunk of loadedChunks) {
              const key = chunkKey(chunk.coord)
              if (!nextMeshes.has(key)) {
                const mesh = yield* chunkMeshService.createChunkMesh(chunk)
                yield* sceneService.add(scene, mesh)
                nextMeshes.set(key, mesh)
              }
            }

            // Remove meshes for chunks no longer loaded
            for (const [key, mesh] of meshes) {
              if (!loadedKeys.has(key)) {
                yield* sceneService.remove(scene, mesh)
                disposeMesh(mesh)
                nextMeshes.delete(key)
              }
            }

            yield* Ref.set(meshesRef, nextMeshes)
          }),

        /**
         * Update (re-mesh) a single chunk that has been modified.
         * Call this after block break/place for the affected chunk.
         */
        updateChunkInScene: (chunk: Chunk, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const key = chunkKey(chunk.coord)
            const meshes = yield* Ref.get(meshesRef)

            // Remove and dispose old mesh if present
            const oldMesh = meshes.get(key)
            if (oldMesh !== undefined) {
              yield* sceneService.remove(scene, oldMesh)
              disposeMesh(oldMesh)
            }

            // Create and add new mesh
            const newMesh = yield* chunkMeshService.createChunkMesh(chunk)
            yield* sceneService.add(scene, newMesh)

            yield* Ref.update(meshesRef, (map) => {
              const next = new Map(map)
              next.set(key, newMesh)
              return next
            })
          }),

        /**
         * Apply frustum culling: toggle mesh.visible for all tracked chunk meshes.
         * Does NOT add/remove objects from scene (avoids scene graph mutation overhead).
         */
        applyFrustumCulling: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            camera.updateMatrixWorld()
            _projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
            _frustum.setFromProjectionMatrix(_projMatrix)

            const meshes = yield* Ref.get(meshesRef)

            for (const mesh of meshes.values()) {
              const coord = mesh.userData['chunkCoord'] as ChunkCoord | undefined
              if (coord === undefined) {
                continue
              }
              const wx = coord.x * CHUNK_SIZE
              const wz = coord.z * CHUNK_SIZE
              _minVec.set(wx, 0, wz)
              _maxVec.set(wx + CHUNK_SIZE, CHUNK_HEIGHT, wz + CHUNK_SIZE)
              _box.set(_minVec, _maxVec)
              mesh.visible = _frustum.intersectsBox(_box)
            }
          }),

        /**
         * Remove all chunk meshes from scene and dispose resources
         */
        clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)
            for (const mesh of meshes.values()) {
              yield* sceneService.remove(scene, mesh)
              disposeMesh(mesh)
            }
            yield* Ref.set(meshesRef, new Map())
          }),
      }
    }),
    dependencies: [ChunkMeshService.Default, SceneService.Default],
  }
) {}
export const WorldRendererServiceLive = WorldRendererService.Default
