import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { ItemTypeSchema } from './item-type'

describe('ItemTypeSchema', () => {
  const LEGACY_VALID_ITEMS = [
    'STICKS',
    'COAL',
    'WOODEN_SWORD',
    'WOODEN_PICKAXE',
    'STONE_PICKAXE',
    'RAW_IRON',
    'IRON_INGOT',
    'IRON_PICKAXE',
    'RAW_GOLD',
    'GOLD_INGOT',
    'DIAMOND',
    'REDSTONE_DUST',
    'GLOWSTONE_DUST',
    'LAPIS_LAZULI',
    'EMERALD',
    'DIAMOND_PICKAXE',
    'ROTTEN_FLESH',
  ] as const

  it['each'](LEGACY_VALID_ITEMS)('accepts "%s"', (item: (typeof LEGACY_VALID_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects a BlockType like "STONE" (not in ItemType)', () => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)('STONE')
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects an unknown string', () => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)('UNKNOWN_ITEM')
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('ItemTypeSchema — swords (all tiers)', () => {
  const SWORD_ITEMS = [
    'WOODEN_SWORD',
    'STONE_SWORD',
    'IRON_SWORD',
    'DIAMOND_SWORD',
  ] as const

  it['each'](SWORD_ITEMS)('accepts sword "%s"', (item: (typeof SWORD_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — food items (Phase 11)', () => {
  const FOOD_ITEMS = [
    'APPLE',
    'BREAD',
    'CARROT',
    'RAW_PORKCHOP',
    'COOKED_PORKCHOP',
    'RAW_MUTTON',
    'COOKED_MUTTON',
    'RAW_CHICKEN',
    'COOKED_CHICKEN',
    'COOKED_BEEF',
    'GOLDEN_APPLE',
    'ROTTEN_FLESH',
  ] as const

  it['each'](FOOD_ITEMS)('accepts food item "%s"', (item: (typeof FOOD_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — fish items', () => {
  const FISH_ITEMS = [
    'RAW_COD',
    'COOKED_COD',
    'RAW_SALMON',
    'COOKED_SALMON',
    'TROPICAL_FISH',
    'PUFFERFISH',
  ] as const

  it['each'](FISH_ITEMS)('accepts fish item "%s"', (item: (typeof FISH_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — mob drops', () => {
  const MOB_DROPS = [
    'RAW_BEEF',
    'LEATHER',
    'WOOL',
    'GUNPOWDER',
    'BONE',
    'ARROW',
    'SNOWBALL',
    'FEATHER',
    'INK_SAC',
    'STRING',
    'SPIDER_EYE',
    'ENDER_PEARL',
  ] as const

  it['each'](MOB_DROPS)('accepts mob drop "%s"', (item: (typeof MOB_DROPS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — crafting components', () => {
  const CRAFTING_COMPONENTS = ['BOOK'] as const

  it['each'](CRAFTING_COMPONENTS)('accepts crafting component "%s"', (item: (typeof CRAFTING_COMPONENTS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — armor items', () => {
  const LEATHER_ARMOR = [
    'LEATHER_HELMET',
    'LEATHER_CHESTPLATE',
    'LEATHER_LEGGINGS',
    'LEATHER_BOOTS',
  ] as const

  const IRON_ARMOR = [
    'IRON_HELMET',
    'IRON_CHESTPLATE',
    'IRON_LEGGINGS',
    'IRON_BOOTS',
  ] as const

  const GOLD_ARMOR = [
    'GOLD_HELMET',
    'GOLD_CHESTPLATE',
    'GOLD_LEGGINGS',
    'GOLD_BOOTS',
  ] as const

  const DIAMOND_ARMOR = [
    'DIAMOND_HELMET',
    'DIAMOND_CHESTPLATE',
    'DIAMOND_LEGGINGS',
    'DIAMOND_BOOTS',
  ] as const

  it['each'](LEATHER_ARMOR)('accepts leather armor "%s"', (item: (typeof LEATHER_ARMOR)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })

  it['each'](IRON_ARMOR)('accepts iron armor "%s"', (item: (typeof IRON_ARMOR)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })

  it['each'](GOLD_ARMOR)('accepts gold armor "%s"', (item: (typeof GOLD_ARMOR)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })

  it['each'](DIAMOND_ARMOR)('accepts diamond armor "%s"', (item: (typeof DIAMOND_ARMOR)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — axe tools', () => {
  const AXE_ITEMS = [
    'WOODEN_AXE',
    'STONE_AXE',
    'IRON_AXE',
    'DIAMOND_AXE',
  ] as const

  it['each'](AXE_ITEMS)('accepts axe tool "%s"', (item: (typeof AXE_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — hoe tools', () => {
  const HOE_ITEMS = [
    'WOODEN_HOE',
    'STONE_HOE',
    'IRON_HOE',
    'DIAMOND_HOE',
  ] as const

  it['each'](HOE_ITEMS)('accepts hoe tool "%s"', (item: (typeof HOE_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — ranged and utility items', () => {
  const RANGED_UTILITY = ['BOW', 'FISHING_ROD', 'SHIELD'] as const

  it['each'](RANGED_UTILITY)('accepts ranged/utility item "%s"', (item: (typeof RANGED_UTILITY)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})

describe('ItemTypeSchema — farming items', () => {
  const FARMING_ITEMS = ['WHEAT', 'WHEAT_SEEDS', 'BONE_MEAL'] as const

  it['each'](FARMING_ITEMS)('accepts farming item "%s"', (item: (typeof FARMING_ITEMS)[number]) => {
    const result = Schema.decodeUnknownEither(ItemTypeSchema)(item)
    expect(Either.isRight(result)).toBe(true)
  })
})
