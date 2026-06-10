import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { Chunk, type ChunkAABB } from '@ts-minecraft/world'
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
 * Adds/removes an optional mesh from the scene, mirroring the change into an
 * optional tracking list. `trackingRef` is the water-mesh list used by the
 * refraction pre-pass; pass `null` for meshes that must NOT join that list
 * (e.g. transparent-solid GLASS/LEAVES, which are not water and whose geometry
 * is already disposed by ChunkMeshService.updateChunkMesh).
 */
const syncOptionalMeshInScene = (
  scene: THREE.Scene,
  sceneService: SceneService,
  trackingRef: Ref.Ref<ReadonlyArray<THREE.Mesh>> | null,
  prevMesh: Option.Option<THREE.Mesh>,
  nextMesh: Option.Option<THREE.Mesh>,
): Effect.Effect<void, never> => {
  const track = (f: (arr: ReadonlyArray<THREE.Mesh>) => ReadonlyArray<THREE.Mesh>): Effect.Effect<void, never> =>
    trackingRef === null ? Effect.void : Ref.update(trackingRef, f)
  return Option.match(prevMesh, {
    onNone: () => Option.match(nextMesh, {
      onNone: () => Effect.void,
      onSome: (m) => sceneService.add(scene, m).pipe(
        Effect.andThen(track((arr) => Arr.append(arr, m)))
      ),
    }),
    onSome: (oldMesh) => Option.match(nextMesh, {
      onNone: () => sceneService.remove(scene, oldMesh).pipe(
        Effect.andThen(track((arr) => Arr.filter(arr, (mesh) => mesh !== oldMesh)))
      ),
      onSome: (newMesh) => oldMesh === newMesh
        /* c8 ignore next 6 */
        ? Effect.void
        : Effect.all([
          sceneService.remove(scene, oldMesh),
          sceneService.add(scene, newMesh),
          track((arr) => Arr.append(Arr.filter(arr, (mesh) => mesh !== oldMesh), newMesh)),
        ], { concurrency: 'unbounded', discard: true }),
    }),
  })
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
        chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial, undefined, dirtyAABB, existing.transparentSolid).pipe(
          Effect.flatMap(({ waterMesh: nextWaterMesh, transparentSolidMesh: nextTransparentSolidMesh }) => {
            const updateWaterScene = syncOptionalMeshInScene(scene, sceneService, waterMeshesRef, existing.water, nextWaterMesh)
            // null tracking ref: transparent-solid meshes must not pollute the water
            // refraction list (they would be wrongly hidden during the pre-pass).
            const updateTransparentSolidScene = syncOptionalMeshInScene(scene, sceneService, null, existing.transparentSolid, nextTransparentSolidMesh)

            return Effect.all([updateWaterScene, updateTransparentSolidScene], { concurrency: 'unbounded', discard: true }).pipe(
              // FR-3.1: preserve the existing chunk's LOD when re-meshing in
              // place (block break / place doesn't change distance band).
              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: existing.opaque, water: nextWaterMesh, transparentSolid: nextTransparentSolidMesh, lod: existing.lod }))),
              Effect.andThen(invalidateSceneCaches())
            )
          })
        ),
      onNone: () =>
        // First time this chunk appears — create and register a new mesh
        chunkMeshService.createChunkMesh(chunk, waterMaterial).pipe(
          Effect.flatMap(({ opaqueMesh, waterMesh, transparentSolidMesh }) =>
              Effect.all([
                sceneService.add(scene, opaqueMesh),
                Option.match(waterMesh, {
                onNone: () => Effect.void,
                onSome: (m) =>
                  sceneService.add(scene, m).pipe(
                    Effect.andThen(Ref.update(waterMeshesRef, (waterMeshes) => Arr.append(waterMeshes, m)))
                  ),
              }),
                Option.match(transparentSolidMesh, {
                  onNone: () => Effect.void,
                  onSome: (m) => sceneService.add(scene, m),
                }),
              ], { concurrency: 'unbounded', discard: true }).pipe(
              // FR-3.1: when a chunk first appears via the dirty-update path
              // (e.g. far-side block edit before the sync-loop gets to it),
              // default to LOD 0. The sync-loop will reconcile the LOD on
              // its next pass via the `hasLodChanges` detector.
              Effect.andThen(Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: opaqueMesh, water: waterMesh, transparentSolid: transparentSolidMesh, lod: 0 }))),
              Effect.andThen(invalidateSceneCaches())
            )
          )
        ),
    }))
  )
}
