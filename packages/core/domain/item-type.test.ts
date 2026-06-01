import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { ItemTypeSchema } from './item-type'

describe('ItemTypeSchema', () => {
  const validItems = [
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
    'LAPIS_LAZULI',
    'EMERALD',
    'DIAMOND_PICKAXE',
    'ROTTEN_FLESH',
  ] as const

  it['each'](validItems)('accepts "%s"', (item: (typeof validItems)[number]) => {
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
