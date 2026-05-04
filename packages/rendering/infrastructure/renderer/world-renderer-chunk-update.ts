import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/kernel'
import { Chunk } from '@ts-minecraft/terrain'
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
 * affected chunk.
 */
export const updateChunkInScene = (
  ctx: UpdateChunkContext,
  chunk: Chunk,
  scene: THREE.Scene,
): Effect.Effect<void, never> => {
  const { meshesRef, waterMeshesRef, chunkMeshService, sceneService, waterMaterial, invalidateSceneCaches } = ctx
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
}
