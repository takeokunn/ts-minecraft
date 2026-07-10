import { initialBlocks } from '@ts-minecraft/block/domain/blocks.config'
import type { BlockType } from '@ts-minecraft/core'
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
  0,
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
  blockTypeToIndex('KELP'),
  blockTypeToIndex('SEAGRASS'),
  blockTypeToIndex('RAIL'),
  blockTypeToIndex('POWERED_RAIL'),
])

export const isPassableBlockType = (blockType: BlockType): boolean => PASSABLE_BLOCK_IDS.has(blockTypeToIndex(blockType))

// Hoisted to module scope: computed once at module load, not per frame.
const WATER_ID = blockTypeToIndex('WATER')
const LAVA_ID = blockTypeToIndex('LAVA')
const LADDER_ID = blockTypeToIndex('LADDER')
const RAIL_ID = blockTypeToIndex('RAIL')
const POWERED_RAIL_ID = blockTypeToIndex('POWERED_RAIL')
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

// `radius` selects the square cache layout: 1 -> 3x3 (player physics),
// 3 -> 7x7 (entity physics; must cover the 16-40 block mob spawn band).
export const blockIdAt = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
  radius = 1,
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
  if (dx < -radius || dx > radius || dz < -radius || dz > radius) return null
  const side = radius * 2 + 1
  const chunk = chunkCache[(dx + radius) * side + (dz + radius)]
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

// Mob-physics variant: UNKNOWN terrain (unloaded chunk / outside the cached
// radius) reads as SOLID so far-away mobs freeze in place instead of treating
// the void as air and free-falling to bedrock (they piled up at y=0.9 —
// world floor + mob half height). Above the world stays non-solid.
export const isBlockSolidForMobPhysics = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
  radius: number,
): boolean => {
  if (Math.floor(wy) >= CHUNK_HEIGHT) return false
  const blockId = blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz, radius)
  if (blockId === null) return true
  return blockId !== 0 && !PASSABLE_BLOCK_IDS.has(blockId)
}

export const getBlockCollisionShapeAt = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
  radius = 1,
): BlockCollisionShape | null => {
  const blockId = blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz, radius)
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

export const isInLava = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, LAVA_ID)

export const isInLadder = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, LADDER_ID)

export const isOnRail = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => {
  const id = blockIdAt(wx, wy, wz, chunkCache, playerCx, playerCz)
  return id === RAIL_ID || id === POWERED_RAIL_ID
}

// Powered rails give minecarts an extra speed tier (redstone gating of the
// boost is deferred — see vanilla-parity notes).
export const isOnPoweredRail = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, POWERED_RAIL_ID)

export const isInCobweb = (
  wx: number, wy: number, wz: number,
  chunkCache: ReadonlyArray<{ blocks: Uint8Array } | null>,
  playerCx: number,
  playerCz: number,
): boolean => isBlockTypeAt(wx, wy, wz, chunkCache, playerCx, playerCz, COBWEB_ID)
