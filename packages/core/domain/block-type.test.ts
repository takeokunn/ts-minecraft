import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { BlockTypeSchema } from './block-type'

describe('BlockTypeSchema', () => {
  describe('accepts all world-placeable block types', () => {
    const NATURAL_BLOCKS = [
      'AIR',
      'DIRT',
      'STONE',
      'WOOD',
      'GRASS',
      'SAND',
      'GRAVEL',
      'SNOW',
    ] as const

    it['each'](NATURAL_BLOCKS)('accepts natural block "%s"', (block: (typeof NATURAL_BLOCKS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const FLUID_BLOCKS = ['WATER', 'LAVA'] as const

    it['each'](FLUID_BLOCKS)('accepts fluid block "%s"', (block: (typeof FLUID_BLOCKS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const TRANSPARENT_BLOCKS = ['LEAVES', 'GLASS'] as const

    it['each'](TRANSPARENT_BLOCKS)('accepts transparent block "%s"', (block: (typeof TRANSPARENT_BLOCKS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const DEEPSLATE_VARIANTS = ['DEEPSLATE', 'DEEPSLATE_COAL_ORE', 'DEEPSLATE_IRON_ORE', 'DEEPSLATE_GOLD_ORE', 'DEEPSLATE_DIAMOND_ORE', 'DEEPSLATE_REDSTONE_ORE', 'DEEPSLATE_LAPIS_ORE', 'DEEPSLATE_EMERALD_ORE'] as const

    it['each'](DEEPSLATE_VARIANTS)('accepts deepslate variant "%s"', (block: (typeof DEEPSLATE_VARIANTS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const ORE_BLOCKS = ['COAL_ORE', 'IRON_ORE', 'GOLD_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE', 'EMERALD_ORE'] as const

    it['each'](ORE_BLOCKS)('accepts ore block "%s"', (block: (typeof ORE_BLOCKS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const MINERAL_BLOCKS = ['COAL_BLOCK', 'IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'REDSTONE_BLOCK', 'LAPIS_BLOCK', 'EMERALD_BLOCK'] as const

    it['each'](MINERAL_BLOCKS)('accepts mineral block "%s"', (block: (typeof MINERAL_BLOCKS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const CRAFTING_BLOCKS = ['PLANKS', 'CRAFTING_TABLE', 'FURNACE', 'TORCH'] as const

    it['each'](CRAFTING_BLOCKS)('accepts crafting/utility block "%s"', (block: (typeof CRAFTING_BLOCKS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })

    const STONE_VARIANTS = ['COBBLESTONE', 'GRANITE', 'DIORITE', 'ANDESITE', 'BEDROCK', 'OBSIDIAN'] as const

    it['each'](STONE_VARIANTS)('accepts stone variant "%s"', (block: (typeof STONE_VARIANTS)[number]) => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(block)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe('rejects invalid values', () => {
    it('rejects an inventory-only item "STICKS"', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)('STICKS')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects an inventory-only item "DIAMOND_PICKAXE"', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)('DIAMOND_PICKAXE')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects an inventory-only item "WOODEN_SWORD"', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)('WOODEN_SWORD')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects lowercase "stone" (schema is case-sensitive)', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)('stone')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects empty string', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)('')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects a number', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(1)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects null', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)(null)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects an unknown block type string', () => {
      const result = Schema.decodeUnknownEither(BlockTypeSchema)('UNKNOWN_BLOCK')
      expect(Either.isLeft(result)).toBe(true)
    })
  })
})
