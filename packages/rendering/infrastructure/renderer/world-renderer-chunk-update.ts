import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/kernel'
import { Chunk, type ChunkAABB } from '@ts-minecraft/terrain'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import { SceneService } from '../scene/scene-service'
import { type ChunkMeshes } from './world-renderer-types'
import { chunkKey } from './world-renderer-utils'

export type UpdateChunkContext = {
  readonly meshesRef: Ref.Ref<HashMap.HashMap<ChunkCacheKey, ChunkMeshes>>
  readonly waterMeshesRef: Ref.Ref<ReadonlyArray<THREE.Mesh>>
  readonly chunkMeshService: ChunkMeshService
  readonly sceneService: SceneService
  readonly waterMaterial: THREE.ShaderMaterial
  readonly invalidateSceneCaches: () => Effect.Effect<void, never>
}

/**
 * Re-meshes a single chunk in place; call after block break/place for the
 * affected chunk. FR-4.2: optionally accepts the chunk's accumulated dirty
 * AABB (from `ChunkManagerService.drainRenderDirtyChunkEntries`) and forwards
 * it to the meshing pipeline. Currently informational — FR-4.1 will consume
 * it to restrict greedy meshing to the changed slices.
 */
export const updateChunkInScene = (
  ctx: UpdateChunkContext,
  chunk: Chunk,
  scene: THREE.Scene,
  dirtyAABB?: ChunkAABB,
): Effect.Effect<void, never> => {
  const { meshesRef, waterMeshesRef, chunkMeshService, sceneService, waterMaterial, invalidateSceneCaches } = ctx
  const key = chunkKey(chunk.coord)
  return Ref.get(meshesRef).pipe(
    Effect.flatMap((meshes) => Option.match(HashMap.get(meshes, key), {
      onSome: (existing) =>
        // Reuse the existing mesh: update geometry in place, avoiding scene graph mutation.
        // FR-4.2: thread dirtyAABB; preserves existing.lod via positional 5th arg.
        chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial, undefined, dirtyAABB).pipe(
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
                  /* c8 ignore next 6 */
                  ? Effect.void
                  : Effect.all([
                    sceneService.remove(scene, oldWaterMesh),
                    sceneService.add(scene, newWaterMesh),
                    Ref.update(waterMeshesRef, (waterMeshes) => Arr.append(Arr.filter(waterMeshes, (mesh) => mesh !== oldWaterMesh), newWaterMesh)),
                  ], { concurrency: 'unbounded', discard: true }),
              }),
            })

            return updateWaterScene.pipe(
              // FR-3.1: preserve the existing chunk's LOD when re-meshing in
              // place (block break / place doesn't change distance band).
              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: existing.opaque, water: nextWaterMesh, lod: existing.lod }))),
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
              // FR-3.1: when a chunk first appears via the dirty-update path
              // (e.g. far-side block edit before the sync-loop gets to it),
              // default to LOD 0. The sync-loop will reconcile the LOD on
              // its next pass via the `hasLodChanges` detector.
              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: opaqueMesh, water: waterMesh, lod: 0 }))),
              Effect.andThen(invalidateSceneCaches())
            )
          )
        ),
    }))
  )
}
