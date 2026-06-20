import { initialBlocks } from '@ts-minecraft/block/domain/blocks.config'
import {
  CACTUS_COLLISION_SHAPE,
  FULL_BLOCK_COLLISION_SHAPE,
  PRESSURE_PLATE_COLLISION_SHAPE,
  SLAB_COLLISION_SHAPE,
  type BlockCollisionShape,
} from './aabb-collision'
import { CHUNK_SIZE, CHUNK_HEIGHT, INDEX_TO_BLOCK_TYPE, blockTypeToIndex } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'

const CHUNK_LOCAL_MASK = CHUNK_SIZE - 1
export const DEFAULT_BLOCK_FRICTION = 0.6

// Blocks that should not collide with the player (transparent/passable).
// Uses a native Set per codebase policy for hot-path collision checks.
// NOTE: LEAVES are intentionally NOT here — in Minecraft leaves are SOLID (you can
// stand on them and they block movement). Listing them let the player fall straight
// through tree canopies ('木の葉にあたり判定がないのですり抜ける'). Only genuinely
// non-colliding blocks (fluids, torches) belong here.
const PASSABLE_BLOCK_IDS: ReadonlySet<number> = new Set([
  blockTypeToIndex('WATER'),
  blockTypeToIndex('LAVA'),
  blockTypeToIndex('TORCH'),
  blockTypeToIndex('LADDER'),
  blockTypeToIndex('COBWEB'),
  blockTypeToIndex('SAPLING'),
  blockTypeToIndex('DANDELION'),
  blockTypeToIndex('POPPY'),
  blockTypeToIndex('BROWN_MUSHROOM'),
  blockTypeToIndex('RED_MUSHROOM'),
  blockTypeToIndex('TALL_GRASS'),
  blockTypeToIndex('FERN'),
  blockTypeToIndex('SUGAR_CANE'),
  blockTypeToIndex('LILY_PAD'),
])

// Hoisted to module scope: computed once at module load, not per frame.
const WATER_ID = blockTypeToIndex('WATER')
const LADDER_ID = blockTypeToIndex('LADDER')
const COBWEB_ID = blockTypeToIndex('COBWEB')
const CACTUS_ID = blockTypeToIndex('CACTUS')
const PRESSURE_PLATE_ID = blockTypeToIndex('PRESSURE_PLATE')
const BEDROCK_ID = blockTypeToIndex('BEDROCK')
const SLAB_BLOCK_IDS: ReadonlySet<number> = new Set([
  blockTypeToIndex('PURPUR_SLAB'),
  blockTypeToIndex('STONE_SLAB'),
])

const BLOCK_FRICTION_BY_ID: ReadonlyArray<number> = INDEX_TO_BLOCK_TYPE.map((type) =>
  initialBlocks.find((block) => block.type === type)?.properties.friction ?? DEFAULT_BLOCK_FRICTION
)

// Hoisted to module scope: array allocated once, not per frame.
export const OFFSETS_3x3 = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1], [ 0, 0], [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
] as const

const blockIdAt = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): number | null => {
  const ly = Math.floor(wy)
  if (ly < 0) return BEDROCK_ID
  if (ly >= CHUNK_HEIGHT) return null
  const bx = Math.floor(wx)
  const bz = Math.floor(wz)
  const cx = Math.floor(bx / CHUNK_SIZE)
  const cz = Math.floor(bz / CHUNK_SIZE)
  const dx = cx - playerCx
  const dz = cz - playerCz
  if (dx < -1 || dx > 1 || dz < -1 || dz > 1) return null
  const chunk = chunkCache[(dx + 1) * 3 + (dz + 1)]
  if (chunk == null) return null
  const lx = bx & CHUNK_LOCAL_MASK
  const lz = bz & CHUNK_LOCAL_MASK
  return chunk.blocks[chunkBlockIndexUnchecked(lx, ly, lz)] as number
}

export const isBlockSolid = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => {
  const blockId = blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz)
  if (blockId === null) return false
  return blockId !== 0 && !PASSABLE_BLOCK_IDS.has(blockId)
}

export const getBlockCollisionShapeAt = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number
): BlockCollisionShape | null => {
  const blockId = blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz)
  if (blockId === null || blockId === 0 || PASSABLE_BLOCK_IDS.has(blockId)) return null
  if (blockId === CACTUS_ID) return CACTUS_COLLISION_SHAPE
  if (blockId === PRESSURE_PLATE_ID) return PRESSURE_PLATE_COLLISION_SHAPE
  if (SLAB_BLOCK_IDS.has(blockId)) return SLAB_COLLISION_SHAPE
  return FULL_BLOCK_COLLISION_SHAPE
}

const isBlockTypeAt = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
  expectedBlockId: number,
): boolean => {
  return blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz) === expectedBlockId
}

export const getBlockFrictionAt = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): number => {
  const blockId = blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz)
  if (blockId === null) return DEFAULT_BLOCK_FRICTION
  return BLOCK_FRICTION_BY_ID[blockId] ?? DEFAULT_BLOCK_FRICTION
}

export const isInWater = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, WATER_ID)

export const isInLadder = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, LADDER_ID)

export const isInCobweb = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, COBWEB_ID)
