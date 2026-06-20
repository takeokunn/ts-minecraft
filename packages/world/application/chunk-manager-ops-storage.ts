import { Effect, Option } from 'effect'
import { ChunkCoord, CHUNK_HEIGHT, CHUNK_SIZE, type WorldId } from '@ts-minecraft/core'
import { createFluidBuffer } from '@ts-minecraft/block/domain/fluid'
import { computeMaxY, type Chunk } from '../domain/chunk'
import { StorageError } from '../domain/errors'
import type { ChunkManagerError } from './chunk-manager-constants'
import { storedChunkPayload, type ChunkCacheEntry } from './chunk-manager-cache'
import type { LightGrids } from './light-engine-service'
import type { ChunkOpsContext } from './chunk-manager-ops'

const expectedChunkBufferLength = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const buildChunkFromStoredPayload = (
  coord: ChunkCoord,
  payload: ReturnType<typeof storedChunkPayload>,
): Chunk => {
  const { blocks, fluid } = payload
  return {
    coord,
    blocks,
    fluid: Option.fromNullable(fluid),
    maxY: computeMaxY(blocks),
  }
}

export const saveChunkToStorage = (
  ctx: ChunkOpsContext,
  fallbackWorldId: WorldId,
  entry: ChunkCacheEntry
): Effect.Effect<void, StorageError> =>
  ctx.storageService.saveChunk(entry.worldId ?? fallbackWorldId, entry.chunk.coord, {
    blocks: entry.chunk.blocks,
    fluid: Option.getOrElse(entry.chunk.fluid, createFluidBuffer),
  })

export const loadStoredChunk = (
  ctx: Pick<ChunkOpsContext, 'storageService' | 'lightEngine'>,
  worldId: WorldId,
  coord: ChunkCoord
): Effect.Effect<Option.Option<Chunk>, ChunkManagerError> =>
  Effect.gen(function* () {
    const stored = Option.getOrNull(yield* ctx.storageService.loadChunk(worldId, coord))
    if (stored === null) return Option.none()

    const payload = storedChunkPayload(stored)
    if (payload.blocks.byteLength !== expectedChunkBufferLength) {
      yield* Effect.logWarning(`Chunk (${coord.x},${coord.z}) has invalid buffer length ${payload.blocks.byteLength} (expected ${expectedChunkBufferLength}); regenerating`)
      return Option.none()
    }

    const baseChunk = buildChunkFromStoredPayload(coord, payload)
    const grids: LightGrids = yield* ctx.lightEngine.updateLight(baseChunk)
    return Option.some({ ...baseChunk, skyLight: grids.skyLight, blockLight: grids.blockLight })
  })
