import { Data, Effect } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, isValidBlockIndex } from '@ts-minecraft/core'
import type { BlockType, BlockTypeIndex, Position } from '@ts-minecraft/core'
import type { ChunkManagerService } from '@ts-minecraft/world'

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export class PhysicsColumnReadError extends Data.TaggedError('PhysicsColumnReadError')<{
  readonly message: string
}> {}

const blockIndexForColumn = (y: number, lx: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const validateChunkBlocks = (blocks: ArrayLike<number>): Effect.Effect<void, PhysicsColumnReadError> => {
  if (blocks.length !== CHUNK_BLOCK_COUNT) {
    return Effect.fail(new PhysicsColumnReadError({
      message: `expected ${CHUNK_BLOCK_COUNT} block ids in chunk storage, received ${blocks.length}`,
    }))
  }
  for (let idx = 0; idx < CHUNK_BLOCK_COUNT; idx++) {
    const blockId = blocks[idx]
    if (blockId === undefined) {
      return Effect.fail(new PhysicsColumnReadError({ message: `block id at index ${idx} is missing` }))
    }
    if (!isValidBlockIndex(blockId)) {
      return Effect.fail(new PhysicsColumnReadError({ message: `block id at index ${idx} is invalid: ${String(blockId)}` }))
    }
  }
  return Effect.void
}

const makeColumnReader = (
  chunk: { readonly blocks: ArrayLike<number> } | null,
  lx: number,
  lz: number,
): ((wy: number) => BlockType | null) => {
  return (wy: number) => {
    const by = Math.floor(wy)
    if (by < 0 || by >= CHUNK_HEIGHT || chunk === null) return null
    const blockId = chunk.blocks[blockIndexForColumn(by, lx, lz)] as BlockTypeIndex
    return indexToBlockType(blockId)
  }
}

export const makeColumnReaderAt = (
  chunkManagerService: ChunkManagerService,
  pos: Position,
): Effect.Effect<(wy: number) => BlockType | null, PhysicsColumnReadError> => {
  const bx = Math.floor(pos.x)
  const bz = Math.floor(pos.z)
  const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return Effect.gen(function* () {
    const chunk = yield* chunkManagerService
      .getChunk({ x: Math.floor(bx / CHUNK_SIZE), z: Math.floor(bz / CHUNK_SIZE) })
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
    if (chunk !== null) yield* validateChunkBlocks(chunk.blocks)
    return makeColumnReader(chunk, lx, lz)
  })
}
