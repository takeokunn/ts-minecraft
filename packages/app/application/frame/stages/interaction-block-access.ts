import { Data, Effect, HashMap, MutableRef, Option } from 'effect'
import type { Chunk } from '@ts-minecraft/world'
import { CHUNK_HEIGHT, CHUNK_SIZE, indexToBlockType, isValidBlockIndex } from '@ts-minecraft/core'
import type { BlockType, BlockTypeIndex } from '@ts-minecraft/core'
import type { DirtyChunkEntry } from '@ts-minecraft/app/frame/frame-maintenance-dirty'
import type { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export class InteractionBlockReadError extends Data.TaggedError('InteractionBlockReadError')<{
  readonly message: string
}> {}

export const blockIndexForWorldPosition = (pos: {
  readonly x: number
  readonly y: number
  readonly z: number
}): number => {
  const lx = ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return pos.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
}

export const readChunkBlockId = (
  blocks: ArrayLike<number>,
  idx: number,
): Effect.Effect<BlockTypeIndex, InteractionBlockReadError> => {
  if (blocks.length !== CHUNK_BLOCK_COUNT) {
    return Effect.fail(new InteractionBlockReadError({
      message: `expected ${CHUNK_BLOCK_COUNT} block ids in chunk storage, received ${blocks.length}`,
    }))
  }
  if (idx < 0 || idx >= CHUNK_BLOCK_COUNT) {
    return Effect.fail(new InteractionBlockReadError({ message: `block index ${idx} is outside chunk storage` }))
  }
  const blockId = blocks[idx]
  if (!isValidBlockIndex(blockId)) {
    return Effect.fail(new InteractionBlockReadError({ message: `block id at index ${idx} is invalid: ${String(blockId)}` }))
  }
  return Effect.succeed(blockId)
}

export const buildChunkCache = (
  results: ReadonlyArray<Option.Option<{ readonly coord: { x: number; z: number }; readonly chunk: Chunk }>>,
): Map<string, Chunk> => {
  const cache = new Map<string, Chunk>()
  for (const r of results) {
    const val = Option.getOrNull(r)
    if (val !== null) cache.set(`${val.coord.x},${val.coord.z}`, val.chunk)
  }
  return cache
}

export const readBlockTypeAt = (
  chunkManagerService: ChunkManagerService,
  pos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<BlockType, unknown> => {
  if (pos.y < 0 || pos.y >= CHUNK_HEIGHT) {
    return Effect.succeed('AIR' as BlockType)
  }

  const { x: cx, z: cz } = worldToChunkCoord(pos)
  const idx = blockIndexForWorldPosition(pos)
  return Effect.gen(function* () {
    const chunk = yield* chunkManagerService.getChunk({ x: cx, z: cz })
    const blockId = yield* readChunkBlockId(chunk.blocks, idx)
    return indexToBlockType(blockId)
  })
}

export const markChunkDirtyAt = (
  chunkManagerService: ChunkManagerService,
  dirtyChunksRef: MutableRef.MutableRef<HashMap.HashMap<string, DirtyChunkEntry>>,
  pos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<void, never> => {
  const { x: cx, z: cz } = worldToChunkCoord(pos)
  return Effect.gen(function* () {
    const updated = yield* chunkManagerService.getChunk({ x: cx, z: cz })
    MutableRef.set(
      dirtyChunksRef,
      HashMap.set(MutableRef.get(dirtyChunksRef), `${cx},${cz}`, { chunk: updated, dirtyAABB: Option.none() }),
    )
  }).pipe(Effect.catchAll(() => Effect.void))
}

export const buildBlockAtFromCache = (
  chunkCache: Map<string, Chunk>,
  requiredCoords: ReadonlyArray<{ readonly x: number; readonly z: number }> = [],
): Effect.Effect<((x: number, y: number, z: number) => BlockType), InteractionBlockReadError> =>
  Effect.gen(function* () {
    for (const coord of requiredCoords) {
      const key = `${coord.x},${coord.z}`
      if (!chunkCache.has(key)) {
        return yield* Effect.fail(new InteractionBlockReadError({
          message: `chunk ${key} is missing from the block cache`,
        }))
      }
    }

    for (const [key, chunk] of chunkCache) {
      if (chunk.blocks.length !== CHUNK_BLOCK_COUNT) {
        return yield* Effect.fail(new InteractionBlockReadError({
          message: `chunk ${key} has ${chunk.blocks.length} block ids; expected ${CHUNK_BLOCK_COUNT}`,
        }))
      }
      for (let idx = 0; idx < CHUNK_BLOCK_COUNT; idx++) {
        const blockId = chunk.blocks[idx]
        if (!isValidBlockIndex(blockId)) {
          return yield* Effect.fail(new InteractionBlockReadError({
            message: `chunk ${key} has invalid block id at index ${idx}: ${String(blockId)}`,
          }))
        }
      }
    }

    return (x, y, z) => {
      if (y < 0 || y >= CHUNK_HEIGHT) return 'AIR'
      const cx = Math.floor(x / CHUNK_SIZE)
      const cz = Math.floor(z / CHUNK_SIZE)
      const chunk = chunkCache.get(`${cx},${cz}`)!
      const blockId = chunk.blocks[blockIndexForWorldPosition({ x, y, z })] as BlockTypeIndex
      return indexToBlockType(blockId)
    }
  })
