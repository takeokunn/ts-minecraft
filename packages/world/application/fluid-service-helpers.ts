import { HashMap, Option } from 'effect'
import { AIR_INDEX, chunkCoordsForPosition, getBlockIndex } from '@ts-minecraft/block'
import type { FluidType } from '@ts-minecraft/block'
import { ChunkCacheKey, type Position } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { isWaterBreakableBlockIndex } from '../domain/block-support'

export type LoadedChunkCache = HashMap.HashMap<ChunkCacheKey, Chunk>

export const cacheFromChunks = (chunks: ReadonlyArray<Chunk>): LoadedChunkCache => {
  let cache = HashMap.empty<ChunkCacheKey, Chunk>()
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!
    cache = HashMap.set(cache, ChunkCacheKey.make(chunk.coord), chunk)
  }
  return cache
}

export const canFluidReplaceAt = (
  loaded: LoadedChunkCache,
  position: Position,
  fluidType: FluidType,
): boolean => {
  const chunk = Option.getOrNull(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))))
  if (chunk === null) return false
  const idx = getBlockIndex(position)
  if (idx < 0) return false
  const blockIndex = chunk.blocks[idx]!
  return blockIndex === AIR_INDEX || (fluidType === 'water' && isWaterBreakableBlockIndex(blockIndex))
}

export const blockAt = (loaded: LoadedChunkCache, position: Position): Option.Option<number> =>
  Option.flatMap(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))), (chunk) => {
    const idx = getBlockIndex(position)
    return idx >= 0 ? Option.some(chunk.blocks[idx]!) : Option.none()
  })
