import { describe, it, expect } from 'vitest'
import { HashSet, Schema } from 'effect'
import { BlockTypeSchema, ItemTypeSchema } from '@ts-minecraft/core'
import { blockDropsBaseItem, getBlockDropCount, getInventoryDropForBlock, rollLeafDrops, LEAF_APPLE_DROP_CHANCE, LEAF_STICK_DROP_CHANCE, LEAF_SAPLING_DROP_CHANCE, GRASS_SEED_DROP_CHANCE, isGrassSeedDropBlock, rollGrassSeedDrop, NON_PLACEABLE_ITEM_TYPES } from '../application/block-service.config'

const SELF_DROPPING_DECORATIVE_BLOCKS = ['DANDELION', 'POPPY', 'BROWN_MUSHROOM', 'RED_MUSHROOM'] as const
type SelfDroppingDecorativeBlock = typeof SELF_DROPPING_DECORATIVE_BLOCKS[number]

describe('getInventoryDropForBlock — vanilla drop correctness', () => {
  it('GRASS drops DIRT (not GRASS)', () => {
    expect(getInventoryDropForBlock('GRASS')).toBe('DIRT')
  })

  it('STONE drops COBBLESTONE', () => {
    expect(getInventoryDropForBlock('STONE')).toBe('COBBLESTONE')
  })

  it('FARMLAND drops DIRT', () => {
    expect(getInventoryDropForBlock('FARMLAND')).toBe('DIRT')
  })

  it('DIAMOND_ORE drops DIAMOND', () => {
    expect(getInventoryDropForBlock('DIAMOND_ORE')).toBe('DIAMOND')
  })

  it('REDSTONE_WIRE drops REDSTONE_DUST', () => {
    expect(getInventoryDropForBlock('REDSTONE_WIRE')).toBe('REDSTONE_DUST')
  })

  it('REDSTONE_TORCH drops itself (REDSTONE_TORCH, not REDSTONE_DUST)', () => {
    expect(getInventoryDropForBlock('REDSTONE_TORCH')).toBe('REDSTONE_TORCH')
  })

  it('COBBLESTONE drops itself (no override)', () => {
    expect(getInventoryDropForBlock('COBBLESTONE')).toBe('COBBLESTONE')
  })

  it('DIRT drops itself', () => {
    expect(getInventoryDropForBlock('DIRT')).toBe('DIRT')
  })

  it('GRAVEL drops FLINT (R65)', () => {
    expect(getInventoryDropForBlock('GRAVEL')).toBe('FLINT')
  })

  it('DOOR_OPEN drops the closed DOOR item', () => {
    expect(getInventoryDropForBlock('DOOR_OPEN')).toBe('DOOR')
  })

  it('WATER_CAULDRON drops the empty CAULDRON item', () => {
    expect(getInventoryDropForBlock('WATER_CAULDRON')).toBe('CAULDRON')
  })

  it('GLOWSTONE drops four GLOWSTONE_DUST items', () => {
    expect(getInventoryDropForBlock('GLOWSTONE')).toBe('GLOWSTONE_DUST')
    expect(getBlockDropCount('GLOWSTONE')).toBe(4)
  })

  it('COBWEB drops STRING', () => {
    expect(getInventoryDropForBlock('COBWEB')).toBe('STRING')
  })

  it('SAPLING drops itself (no override)', () => {
    expect(getInventoryDropForBlock('SAPLING')).toBe('SAPLING')
  })

  it.each(SELF_DROPPING_DECORATIVE_BLOCKS)(
    '%s drops itself (no override)',
    (blockType: SelfDroppingDecorativeBlock) => {
      expect(getInventoryDropForBlock(blockType)).toBe(blockType)
    },
  )

  it('SNOW drops four SNOWBALL items', () => {
    expect(getInventoryDropForBlock('SNOW')).toBe('SNOWBALL')
    expect(getBlockDropCount('SNOW')).toBe(4)
  })

  it('ICE has no base drop without Silk Touch', () => {
    expect(blockDropsBaseItem('ICE')).toBe(false)
    expect(blockDropsBaseItem('STONE')).toBe(true)
  })
})

// R69: leaf bonus drops — the only survival source of APPLE.
describe('rollLeafDrops — vanilla oak leaf bonus drops', () => {
  it('drops an apple when the roll is below the apple chance (1/200)', () => {
    const drops = rollLeafDrops(LEAF_APPLE_DROP_CHANCE - 0.0001, 1)
    expect(drops.apple).toBe(1)
    expect(drops.sticks).toBe(0)
    expect(drops.saplings).toBe(0)
  })

  it('drops no apple when the roll is at or above the apple chance', () => {
    expect(rollLeafDrops(LEAF_APPLE_DROP_CHANCE, 1).apple).toBe(0)
    expect(rollLeafDrops(0.5, 1).apple).toBe(0)
  })

  it('drops sticks when the stick roll is below the stick chance (2%)', () => {
    const drops = rollLeafDrops(1, LEAF_STICK_DROP_CHANCE - 0.0001)
    expect(drops.sticks).toBe(1)
    expect(drops.apple).toBe(0)
    expect(drops.saplings).toBe(0)
  })

  it('drops no sticks when the stick roll is at or above the stick chance', () => {
    expect(rollLeafDrops(1, LEAF_STICK_DROP_CHANCE).sticks).toBe(0)
  })

  it('drops saplings when the sapling roll is below the sapling chance (5%)', () => {
    const drops = rollLeafDrops(1, 1, LEAF_SAPLING_DROP_CHANCE - 0.0001)
    expect(drops.saplings).toBe(1)
    expect(drops.apple).toBe(0)
    expect(drops.sticks).toBe(0)
  })

  it('drops no saplings when the sapling roll is at or above the sapling chance', () => {
    expect(rollLeafDrops(1, 1, LEAF_SAPLING_DROP_CHANCE).saplings).toBe(0)
  })

  it('can drop apple, sticks, and sapling when all rolls succeed', () => {
    const drops = rollLeafDrops(0, 0, 0)
    expect(drops.apple).toBe(1)
    expect(drops.sticks).toBe(1)
    expect(drops.saplings).toBe(1)
  })

  it('vanilla-style rates: apple 1/200 = 0.005, stick 2% = 0.02, sapling 5% = 0.05', () => {
    expect(LEAF_APPLE_DROP_CHANCE).toBe(0.005)
    expect(LEAF_STICK_DROP_CHANCE).toBe(0.02)
    expect(LEAF_SAPLING_DROP_CHANCE).toBe(0.05)
  })
})

describe('rollGrassSeedDrop — tall grass/fern wheat seed drop', () => {
  it('identifies tall grass and fern as seed-drop plants', () => {
    expect(isGrassSeedDropBlock('TALL_GRASS')).toBe(true)
    expect(isGrassSeedDropBlock('FERN')).toBe(true)
    expect(isGrassSeedDropBlock('DANDELION')).toBe(false)
  })

  it('drops one seed when the roll is below 1/8', () => {
    expect(rollGrassSeedDrop(GRASS_SEED_DROP_CHANCE - 0.0001)).toBe(1)
    expect(rollGrassSeedDrop(0)).toBe(1)
  })

  it('drops no seed when the roll is at or above 1/8', () => {
    expect(rollGrassSeedDrop(GRASS_SEED_DROP_CHANCE)).toBe(0)
    expect(rollGrassSeedDrop(0.5)).toBe(0)
  })

  it('uses the vanilla 1/8 chance', () => {
    expect(GRASS_SEED_DROP_CHANCE).toBe(0.125)
  })
})

// Completeness guard: every ItemType that is NOT also a BlockType must be listed in
// NON_PLACEABLE_ITEM_TYPES. Without this, new items added to ItemTypeSchema silently fall
// through to the Schema.decodeUnknownEither(BlockTypeSchema) gate in placeBlock, producing
// a weaker error message and unclear placement intent.
describe('NON_PLACEABLE_ITEM_TYPES completeness guard', () => {
  it('every pure ItemType (not a BlockType) is explicitly listed as non-placeable', () => {
    const allItemTypes = ItemTypeSchema.literals as ReadonlyArray<string>
    const allBlockTypes = new Set(BlockTypeSchema.literals as ReadonlyArray<string>)
    for (const itemType of allItemTypes) {
      if (!allBlockTypes.has(itemType)) {
        expect(
          HashSet.has(NON_PLACEABLE_ITEM_TYPES, itemType as Schema.Schema.Type<typeof ItemTypeSchema>),
          `ItemType '${itemType}' is not a BlockType and must appear in NON_PLACEABLE_ITEM_TYPES`,
        ).toBe(true)
      }
    }
  })
})
