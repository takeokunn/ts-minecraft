import { blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'

const SURFACE_PLANT_BLOCK_TYPES = new Set<BlockType>([
  'SAPLING',
  'DANDELION',
  'POPPY',
  'BROWN_MUSHROOM',
  'RED_MUSHROOM',
  'TALL_GRASS',
  'FERN',
])

const WATERSIDE_PLANT_BLOCK_TYPES = new Set<BlockType>([
  'SUGAR_CANE',
  'CACTUS',
  'LILY_PAD',
])

const SUPPORT_SENSITIVE_BLOCK_TYPES = new Set<BlockType>([
  'TORCH',
  'REDSTONE_TORCH',
  'REDSTONE_WIRE',
  'PRESSURE_PLATE',
  'WHEAT_CROP',
  ...SURFACE_PLANT_BLOCK_TYPES,
  ...WATERSIDE_PLANT_BLOCK_TYPES,
])

const WATER_BREAKABLE_BLOCK_TYPES = new Set<BlockType>([
  'TORCH',
  'REDSTONE_TORCH',
  'REDSTONE_WIRE',
  'PRESSURE_PLATE',
  'WHEAT_CROP',
  ...SURFACE_PLANT_BLOCK_TYPES,
  'SUGAR_CANE',
  'CACTUS',
])

const NON_SUPPORTING_BLOCK_TYPES = new Set<BlockType>([
  'AIR',
  'WATER',
  'LAVA',
  'TORCH',
  'REDSTONE_TORCH',
  'REDSTONE_WIRE',
  'PRESSURE_PLATE',
  'WHEAT_CROP',
  ...SURFACE_PLANT_BLOCK_TYPES,
  ...WATERSIDE_PLANT_BLOCK_TYPES,
  'SNOW',
])

const SURFACE_PLANT_SUPPORT_BLOCK_TYPES = new Set<BlockType>([
  'DIRT',
  'GRASS',
  'FARMLAND',
])
const SUGAR_CANE_SUPPORT_BLOCK_TYPES = new Set<BlockType>(['DIRT', 'GRASS', 'SAND', 'SUGAR_CANE'])
const CACTUS_SUPPORT_BLOCK_TYPES = new Set<BlockType>(['SAND', 'CACTUS'])

const WATER_BREAKABLE_BLOCK_INDICES = new Set<number>(
  Array.from(WATER_BREAKABLE_BLOCK_TYPES, (blockType) => blockTypeToIndex(blockType)),
)

const SUPPORT_RULE_ENTRIES: ReadonlyArray<
  readonly [BlockType, (blockBelow: BlockType) => boolean]
> = [
  ['WHEAT_CROP', (blockBelow) => blockBelow === 'FARMLAND'],
  ['SUGAR_CANE', (blockBelow) => SUGAR_CANE_SUPPORT_BLOCK_TYPES.has(blockBelow)],
  ['CACTUS', (blockBelow) => CACTUS_SUPPORT_BLOCK_TYPES.has(blockBelow)],
  ['LILY_PAD', (blockBelow) => blockBelow === 'WATER'],
  ...Array.from(SURFACE_PLANT_BLOCK_TYPES, (blockType) => [
    blockType,
    (blockBelow: BlockType) => SURFACE_PLANT_SUPPORT_BLOCK_TYPES.has(blockBelow),
  ] as const),
]

const SUPPORT_RULES = new Map<BlockType, (blockBelow: BlockType) => boolean>(SUPPORT_RULE_ENTRIES)

export const isSupportSensitiveBlock = (blockType: BlockType): boolean =>
  SUPPORT_SENSITIVE_BLOCK_TYPES.has(blockType)

export const canBlockStaySupported = (blockType: BlockType, blockBelow: BlockType): boolean => {
  if (!isSupportSensitiveBlock(blockType)) return true
  const supportRule = SUPPORT_RULES.get(blockType)
  if (supportRule) return supportRule(blockBelow)
  return !NON_SUPPORTING_BLOCK_TYPES.has(blockBelow)
}

export const isWaterBreakableBlockIndex = (blockIndex: number): boolean =>
  WATER_BREAKABLE_BLOCK_INDICES.has(blockIndex)
