import { describe, it, expect } from 'vitest'
import { HashSet, Schema } from 'effect'
import { BlockTypeSchema, ItemTypeSchema } from '@ts-minecraft/core'
import { getInventoryDropForBlock, rollLeafDrops, LEAF_APPLE_DROP_CHANCE, LEAF_STICK_DROP_CHANCE, NON_PLACEABLE_ITEM_TYPES } from '../application/block-service.config'

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
})

// R69: leaf bonus drops — the only survival source of APPLE.
describe('rollLeafDrops — vanilla oak leaf bonus drops', () => {
  it('drops an apple when the roll is below the apple chance (1/200)', () => {
    const drops = rollLeafDrops(LEAF_APPLE_DROP_CHANCE - 0.0001, 1)
    expect(drops.apple).toBe(1)
    expect(drops.sticks).toBe(0)
  })

  it('drops no apple when the roll is at or above the apple chance', () => {
    expect(rollLeafDrops(LEAF_APPLE_DROP_CHANCE, 1).apple).toBe(0)
    expect(rollLeafDrops(0.5, 1).apple).toBe(0)
  })

  it('drops sticks when the stick roll is below the stick chance (2%)', () => {
    const drops = rollLeafDrops(1, LEAF_STICK_DROP_CHANCE - 0.0001)
    expect(drops.sticks).toBe(1)
    expect(drops.apple).toBe(0)
  })

  it('drops no sticks when the stick roll is at or above the stick chance', () => {
    expect(rollLeafDrops(1, LEAF_STICK_DROP_CHANCE).sticks).toBe(0)
  })

  it('can drop both apple and sticks when both rolls succeed', () => {
    const drops = rollLeafDrops(0, 0)
    expect(drops.apple).toBe(1)
    expect(drops.sticks).toBe(1)
  })

  it('vanilla rates: apple 1/200 = 0.005, stick 2% = 0.02', () => {
    expect(LEAF_APPLE_DROP_CHANCE).toBe(0.005)
    expect(LEAF_STICK_DROP_CHANCE).toBe(0.02)
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
