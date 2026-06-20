import { Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { type Chunk, type ChunkManagerService, chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { VillagePlacementBlockReadError } from './village-placement-surface-error'

const VILLAGE_NON_GROUND_IDS: ReadonlySet<number> = new Set([
  blockTypeToIndex('AIR'),
  blockTypeToIndex('WATER'),
  blockTypeToIndex('LAVA'),
  blockTypeToIndex('LEAVES'),
  blockTypeToIndex('WOOD'),
])

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export type VillageSurfaceResolver = (wx: number, wz: number) => Effect.Effect<number, VillagePlacementBlockReadError>

export const readVillageBlockId = (
  blocks: ArrayLike<number>,
  idx: number,
): Effect.Effect<number, VillagePlacementBlockReadError> => {
  if (blocks.length !== CHUNK_BLOCK_COUNT) {
    return Effect.fail(new VillagePlacementBlockReadError({
      message: `Village placement requires a complete chunk block buffer: expected ${CHUNK_BLOCK_COUNT}, got ${blocks.length}`,
    }))
  }
  if (idx < 0 || idx >= CHUNK_BLOCK_COUNT) {
    return Effect.fail(new VillagePlacementBlockReadError({
      message: `Village placement block index is outside chunk bounds: ${idx}`,
    }))
  }
  const blockId = blocks[idx]
  if (blockId === undefined) {
    return Effect.fail(new VillagePlacementBlockReadError({
      message: `Village placement chunk block buffer has no value at index ${idx}`,
    }))
  }
  return Effect.succeed(blockId)
}

const toChunkCoord = (worldCoord: number): number => Math.floor(worldCoord / CHUNK_SIZE)
const toLocalCoord = (worldCoord: number): number => ((worldCoord % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

const topGroundY = (
  blocks: ArrayLike<number>,
  lx: number,
  lz: number,
): Effect.Effect<number, VillagePlacementBlockReadError> =>
  Effect.gen(function* () {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const blockId = yield* readVillageBlockId(blocks, chunkBlockIndexUnchecked(lx, y, lz))
      if (!VILLAGE_NON_GROUND_IDS.has(blockId)) return y
    }
    return -1
  })

export const makeVillageSurfaceResolver = (
  chunkManagerService: Pick<ChunkManagerService, 'getChunk'>,
): VillageSurfaceResolver => {
  const chunkByKey = new Map<string, Chunk | null>()

  return (wx, wz) =>
    Effect.gen(function* () {
      const ccx = toChunkCoord(wx)
      const ccz = toChunkCoord(wz)
      const key = `${ccx},${ccz}`
      let chunk = chunkByKey.get(key)
      if (chunk === undefined) {
        chunk = yield* chunkManagerService.getChunk({ x: ccx, z: ccz }).pipe(
          Effect.catchAll(() => Effect.succeed(null)),
        )
        chunkByKey.set(key, chunk)
      }
      if (chunk === null) return -1
      const lx = toLocalCoord(wx)
      const lz = toLocalCoord(wz)
      return yield* topGroundY(chunk.blocks, lx, lz)
    })
}
