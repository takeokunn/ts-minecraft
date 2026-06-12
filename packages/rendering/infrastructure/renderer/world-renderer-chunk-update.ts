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
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const track = (f: (arr: ReadonlyArray<THREE.Mesh>) => ReadonlyArray<THREE.Mesh>): Effect.Effect<void, never> =>
      trackingRef === null ? Effect.void : Ref.update(trackingRef, f)
    const prevMeshVal = Option.getOrNull(prevMesh)
    if (prevMeshVal === null) {
      const m = Option.getOrNull(nextMesh)
      if (m === null) return
      yield* sceneService.add(scene, m)
      yield* track((arr) => Arr.append(arr, m))
      return
    }
    const newMesh = Option.getOrNull(nextMesh)
    if (newMesh === null) {
      yield* sceneService.remove(scene, prevMeshVal)
      yield* track((arr) => Arr.filter(arr, (mesh) => mesh !== prevMeshVal))
      return
    }
    /* c8 ignore next 7 */
    if (prevMeshVal === newMesh) return
    yield* sceneService.remove(scene, prevMeshVal)
    yield* sceneService.add(scene, newMesh)
    yield* track((arr) => Arr.append(Arr.filter(arr, (mesh) => mesh !== prevMeshVal), newMesh))
  })

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
  return Effect.gen(function* () {
    const meshes = yield* Ref.get(meshesRef)
    const existing = Option.getOrNull(HashMap.get(meshes, key))

    if (existing !== null) {
      // Reuse the existing mesh: update geometry in place, avoiding scene graph mutation.
      // FR-4.2: thread dirtyAABB; preserves existing.lod via positional 5th arg.
      const { waterMesh: nextWaterMesh, transparentSolidMesh: nextTransparentSolidMesh } =
        yield* chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial, undefined, dirtyAABB, existing.transparentSolid)
      const updateWaterScene = syncOptionalMeshInScene(scene, sceneService, waterMeshesRef, existing.water, nextWaterMesh)
      // null tracking ref: transparent-solid meshes must not pollute the water
      // refraction list (they would be wrongly hidden during the pre-pass).
      const updateTransparentSolidScene = syncOptionalMeshInScene(scene, sceneService, null, existing.transparentSolid, nextTransparentSolidMesh)
      yield* updateWaterScene
      yield* updateTransparentSolidScene
      // FR-3.1: preserve the existing chunk's LOD when re-meshing in place.
      yield* Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: existing.opaque, water: nextWaterMesh, transparentSolid: nextTransparentSolidMesh, lod: existing.lod }))
    } else {
      // First time this chunk appears — create and register a new mesh
      const { opaqueMesh, waterMesh, transparentSolidMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
      const waterMeshVal = Option.getOrNull(waterMesh)
      const addWater = waterMeshVal !== null
        ? Effect.gen(function* () {
            yield* sceneService.add(scene, waterMeshVal)
            yield* Ref.update(waterMeshesRef, (arr) => Arr.append(arr, waterMeshVal))
          })
        : Effect.void
      const transparentSolidMeshVal = Option.getOrNull(transparentSolidMesh)
      const addTransparentSolid = transparentSolidMeshVal !== null
        ? sceneService.add(scene, transparentSolidMeshVal)
        : Effect.void
      yield* sceneService.add(scene, opaqueMesh)
      yield* addWater
      yield* addTransparentSolid
      // FR-3.1: default to LOD 0; sync-loop reconciles on next pass via hasLodChanges.
      yield* Ref.update(meshesRef, (map) => HashMap.set(map, key, { opaque: opaqueMesh, water: waterMesh, transparentSolid: transparentSolidMesh, lod: 0 }))
    }

    yield* invalidateSceneCaches()
  })
}
