import { Option } from 'effect'
import { computeBlockLight, computeSkyLight, createLightBuffer, type LightGrids } from '@ts-minecraft/block/domain/light'
import type { Chunk } from './chunk'
import { fullChunkAABB } from './chunk-aabb'
import { propagateBlockLightIncremental } from './block-light-bfs'
import { propagateSkyLightIncremental } from './sky-light-bfs'
import type { AABBAccumulator, DirtyVoxel, IncrementalLightResult, BoundaryDirty, MutableBoundaryDirty } from './light-engine-model'
import { FULL_RECOMPUTE_THRESHOLD, inLightBounds, lightBufferOrFresh, trackTouched } from './light-engine-utils'

export type { LightGrids } from '@ts-minecraft/block/domain/light'

export const computeFreshLight = (chunk: Chunk): LightGrids => {
  const sky = createLightBuffer()
  const block = createLightBuffer()
  computeSkyLight(chunk.blocks, sky)
  computeBlockLight(chunk.blocks, block)
  return { skyLight: sky, blockLight: block }
}

export const updateExistingLight = (chunk: Chunk): LightGrids => {
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

const createBoundary = (): BoundaryDirty => ({ nx: false, px: false, nz: false, pz: false })

export const propagateIncremental = (
  chunk: Chunk,
  dirtyVoxels: ReadonlyArray<DirtyVoxel>,
): IncrementalLightResult => {
  const sky = lightBufferOrFresh(chunk.skyLight)
  const block = lightBufferOrFresh(chunk.blockLight)
  const boundary: MutableBoundaryDirty = createBoundary()
  const valid: Array<DirtyVoxel> = []
  for (const d of dirtyVoxels) {
    if (inLightBounds(d.lx, d.y, d.lz)) valid.push(d)
  }

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
