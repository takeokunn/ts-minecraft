import { Effect, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import type { ChunkManagerService } from '@ts-minecraft/world'

const makeColumnReader = (
  chunkOpt: Option.Option<{ readonly blocks: ArrayLike<number> }>,
  lx: number,
  lz: number,
): ((wy: number) => ReturnType<typeof indexToBlockType> | null) => {
  const chunk = Option.getOrNull(chunkOpt)
  return (wy: number) => {
    const by = Math.floor(wy)
    if (by < 0 || by >= CHUNK_HEIGHT || chunk === null) return null
    return indexToBlockType(chunk.blocks[by + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] ?? 0)
  }
}

export const makeColumnReaderAt = (
  chunkManagerService: ChunkManagerService,
  pos: Position,
): Effect.Effect<(wy: number) => ReturnType<typeof indexToBlockType> | null> => {
  const bx = Math.floor(pos.x)
  const bz = Math.floor(pos.z)
  const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return Effect.gen(function* () {
    const chunkOpt = yield* chunkManagerService
      .getChunk({ x: Math.floor(bx / CHUNK_SIZE), z: Math.floor(bz / CHUNK_SIZE) })
      .pipe(Effect.option)
    return makeColumnReader(chunkOpt, lx, lz)
  })
}
