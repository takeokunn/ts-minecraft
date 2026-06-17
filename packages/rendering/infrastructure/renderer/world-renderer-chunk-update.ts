import { Effect, HashMap, Option, Ref } from 'effect'
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

type TrackedMeshes = ReadonlyArray<THREE.Mesh>

const appendTrackedMesh = (
  meshes: TrackedMeshes,
  mesh: THREE.Mesh,
): TrackedMeshes => {
  const nextMeshes = meshes.slice()
  nextMeshes.push(mesh)
  return nextMeshes
}

const removeTrackedMesh = (
  meshes: TrackedMeshes,
  mesh: THREE.Mesh,
): TrackedMeshes => {
  const index = meshes.indexOf(mesh)
  if (index === -1) return meshes
  const nextMeshes = meshes.slice()
  nextMeshes.splice(index, 1)
  return nextMeshes
}

const replaceTrackedMesh = (
  meshes: TrackedMeshes,
  prevMesh: THREE.Mesh,
  nextMesh: THREE.Mesh,
): TrackedMeshes => {
  const index = meshes.indexOf(prevMesh)
  if (index === -1) return appendTrackedMesh(meshes, nextMesh)
  const nextMeshes = meshes.slice()
  nextMeshes[index] = nextMesh
  return nextMeshes
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
  return Effect.gen(function* () {
    const meshes = yield* Ref.get(meshesRef)
    const initialWaterMeshes = yield* Ref.get(waterMeshesRef)
    let nextMeshes = meshes
    let nextWaterMeshes = initialWaterMeshes
    let waterMeshesChanged = false
    let meshesChanged = false

    const existing = Option.getOrNull(HashMap.get(meshes, key))

    if (existing !== null) {
      // Reuse the existing mesh: update geometry in place, avoiding scene graph mutation.
      // FR-4.2: thread dirtyAABB; preserves existing.lod via positional 5th arg.
      const { waterMesh: nextWaterMesh, transparentSolidMesh: nextTransparentSolidMesh } =
        yield* chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial, undefined, dirtyAABB, existing.transparentSolid)

      const prevWaterMesh = Option.getOrNull(existing.water)
      const nextWaterMeshVal = Option.getOrNull(nextWaterMesh)
      if (prevWaterMesh === null) {
        if (nextWaterMeshVal !== null) {
          yield* sceneService.add(scene, nextWaterMeshVal)
          nextWaterMeshes = appendTrackedMesh(nextWaterMeshes, nextWaterMeshVal)
          waterMeshesChanged = true
        }
      } else if (nextWaterMeshVal === null) {
        yield* sceneService.remove(scene, prevWaterMesh)
        nextWaterMeshes = removeTrackedMesh(nextWaterMeshes, prevWaterMesh)
        waterMeshesChanged = true
      } else if (prevWaterMesh !== nextWaterMeshVal) {
        yield* sceneService.remove(scene, prevWaterMesh)
        yield* sceneService.add(scene, nextWaterMeshVal)
        nextWaterMeshes = replaceTrackedMesh(nextWaterMeshes, prevWaterMesh, nextWaterMeshVal)
        waterMeshesChanged = true
      }

      // null tracking ref: transparent-solid meshes must not pollute the water
      // refraction list (they would be wrongly hidden during the pre-pass).
      const prevTransparentSolidMesh = Option.getOrNull(existing.transparentSolid)
      const nextTransparentSolidMeshVal = Option.getOrNull(nextTransparentSolidMesh)
      if (prevTransparentSolidMesh === null) {
        if (nextTransparentSolidMeshVal !== null) {
          yield* sceneService.add(scene, nextTransparentSolidMeshVal)
        }
      } else if (nextTransparentSolidMeshVal === null) {
        yield* sceneService.remove(scene, prevTransparentSolidMesh)
      } else if (prevTransparentSolidMesh !== nextTransparentSolidMeshVal) {
        yield* sceneService.remove(scene, prevTransparentSolidMesh)
        yield* sceneService.add(scene, nextTransparentSolidMeshVal)
      }

      // FR-3.1: preserve the existing chunk's LOD when re-meshing in place.
      nextMeshes = HashMap.set(nextMeshes, key, {
        opaque: existing.opaque,
        water: nextWaterMesh,
        transparentSolid: nextTransparentSolidMesh,
        lod: existing.lod,
      })
      meshesChanged = true
    } else {
      // First time this chunk appears — create and register a new mesh
      const { opaqueMesh, waterMesh, transparentSolidMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
      const waterMeshVal = Option.getOrNull(waterMesh)
      if (waterMeshVal !== null) {
        yield* sceneService.add(scene, waterMeshVal)
        nextWaterMeshes = appendTrackedMesh(nextWaterMeshes, waterMeshVal)
        waterMeshesChanged = true
      }

      const transparentSolidMeshVal = Option.getOrNull(transparentSolidMesh)
      if (transparentSolidMeshVal !== null) {
        yield* sceneService.add(scene, transparentSolidMeshVal)
      }

      yield* sceneService.add(scene, opaqueMesh)
      // FR-3.1: default to LOD 0; sync-loop reconciles on next pass via hasLodChanges.
      nextMeshes = HashMap.set(nextMeshes, key, {
        opaque: opaqueMesh,
        water: waterMesh,
        transparentSolid: transparentSolidMesh,
        lod: 0,
      })
      meshesChanged = true
    }

    if (waterMeshesChanged) {
      yield* Ref.set(waterMeshesRef, nextWaterMeshes)
    }
    if (meshesChanged) {
      yield* Ref.set(meshesRef, nextMeshes)
    }
    yield* invalidateSceneCaches()
  })
}
