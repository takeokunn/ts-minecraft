import { Effect, Option } from 'effect'
import { computeBlockLight, computeSkyLight, createLightBuffer, getLightAt, type LightGrids } from '@ts-minecraft/block'
import type { Chunk } from '../domain/chunk'
import { fullChunkAABB } from '../domain/chunk-aabb'
import { propagateBlockLightIncremental } from '../domain/block-light-bfs'
import { propagateSkyLightIncremental } from '../domain/sky-light-bfs'
import type { AABBAccumulator, DirtyVoxel, IncrementalLightResult } from '../domain/light-engine-model'
import { FULL_RECOMPUTE_THRESHOLD, inLightBounds, lightBufferOrFresh, trackTouched } from '../domain/light-engine-utils'

export type { LightGrids } from '@ts-minecraft/block'
export type { BoundaryDirty, DirtyVoxel, IncrementalLightResult } from '../domain/light-engine-model'
export { FULL_RECOMPUTE_THRESHOLD } from '../domain/light-engine-utils'

const computeFreshLight = (chunk: Chunk): LightGrids => {
  const sky = createLightBuffer()
  const block = createLightBuffer()
  computeSkyLight(chunk.blocks, sky)
  computeBlockLight(chunk.blocks, block)
  return { skyLight: sky, blockLight: block }
}

const updateExistingLight = (chunk: Chunk): LightGrids => {
  const sky = lightBufferOrFresh(chunk.skyLight)
  const block = lightBufferOrFresh(chunk.blockLight)
  computeSkyLight(chunk.blocks, sky)
  computeBlockLight(chunk.blocks, block)
  return { skyLight: sky, blockLight: block }
}

const fullRecomputeResult = (chunk: Chunk, sky: Uint8Array, block: Uint8Array): IncrementalLightResult => {
  computeSkyLight(chunk.blocks, sky)
  computeBlockLight(chunk.blocks, block)
  return {
    skyLight: sky,
    blockLight: block,
    boundary: { nx: true, px: true, nz: true, pz: true },
    affectedAABB: Option.some(fullChunkAABB),
  }
}

const propagateIncremental = (chunk: Chunk, dirtyVoxels: ReadonlyArray<DirtyVoxel>): IncrementalLightResult => {
  const sky = lightBufferOrFresh(chunk.skyLight)
  const block = lightBufferOrFresh(chunk.blockLight)
  const boundary = { nx: false, px: false, nz: false, pz: false }
  const valid = dirtyVoxels.filter((d) => inLightBounds(d.lx, d.y, d.lz))

  if (chunk.skyLight === undefined || chunk.blockLight === undefined) {
    return fullRecomputeResult(chunk, sky, block)
  }
  if (valid.length === 0) {
    return { skyLight: sky, blockLight: block, boundary, affectedAABB: Option.none() }
  }
  if (valid.length > FULL_RECOMPUTE_THRESHOLD) {
    return fullRecomputeResult(chunk, sky, block)
  }

  const touched: AABBAccumulator = { aabb: null }
  for (let i = 0; i < valid.length; i++) {
    const d = valid[i]!
    trackTouched(touched, d.lx, d.y, d.lz)
  }
  propagateBlockLightIncremental(chunk.blocks, block, valid, boundary, touched)
  propagateSkyLightIncremental(chunk.blocks, sky, valid, boundary, touched)
  return {
    skyLight: sky,
    blockLight: block,
    boundary,
    affectedAABB: touched.aabb === null ? Option.none() : Option.some(touched.aabb),
  }
}

export class LightEngineService extends Effect.Service<LightEngineService>()(
  '@minecraft/application/LightEngineService',
  {
    effect: Effect.succeed({
      computeLight: (chunk: Chunk): Effect.Effect<LightGrids, never> => Effect.sync(() => computeFreshLight(chunk)),
      updateLight: (chunk: Chunk): Effect.Effect<LightGrids, never> => Effect.sync(() => updateExistingLight(chunk)),
      propagateLightIncremental: (
        chunk: Chunk,
        dirtyVoxels: ReadonlyArray<DirtyVoxel>,
      ): Effect.Effect<IncrementalLightResult, never> => Effect.sync(() => propagateIncremental(chunk, dirtyVoxels)),
      getSkyLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inLightBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.skyLight), {
          onNone: () => 15,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },
      getBlockLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inLightBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.blockLight), {
          onNone: () => 0,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },
    }),
  }
) {}

export const LightEngineLive = LightEngineService.Default
