import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Option, Schema } from 'effect'
import { InventorySaveDataSchema } from './inventory-save-data'

const DIAMOND_MAX_DURABILITY = 1561

describe('InventorySaveDataSchema', () => {
  it('accepts empty slots array', () => {
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [] })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts a slot entry with null (Option.none)', () => {
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [null] })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(Option.isNone(result.right.slots[0]!)).toBe(true)
    }
  })

  it('accepts a valid slot entry with itemType and count 1 (minimum)', () => {
    const entry = { slot: 0, itemType: 'STONE', count: 1, durability: null }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts count 64 (maximum)', () => {
    const entry = { slot: 0, itemType: 'COAL', count: 64, durability: null }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects count 0 (below minimum)', () => {
    const entry = { slot: 0, itemType: 'STONE', count: 0 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects count 65 (above maximum)', () => {
    const entry = { slot: 0, itemType: 'STONE', count: 65 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('round-trips encode/decode', () => {
    const entry = { slot: 2, itemType: 'DIAMOND_PICKAXE', count: 1, durability: null }
    const decodeResult = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(decodeResult)).toBe(true)
    if (Either.isRight(decodeResult)) {
      const encodeResult = Schema.encodeEither(InventorySaveDataSchema)(decodeResult.right)
      expect(Either.isRight(encodeResult)).toBe(true)
    }
  })

  it('accepts a slot entry with explicit durability field (tool with remaining wear)', () => {
    const REMAINING_DURABILITY = 250
    const entry = { slot: 0, itemType: 'IRON_SWORD', count: 1, durability: REMAINING_DURABILITY }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      const decoded = result.right.slots[0]
      expect(Option.isSome(decoded!)).toBe(true)
      expect(Option.getOrThrow(decoded!).durability).toBe(REMAINING_DURABILITY)
    }
  })

  it('accepts a slot entry with durability 0 (tool just broke)', () => {
    const entry = { slot: 1, itemType: 'WOODEN_SWORD', count: 1, durability: 0 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts a slot entry with max diamond-tier durability', () => {
    const entry = { slot: 0, itemType: 'DIAMOND_SWORD', count: 1, durability: DIAMOND_MAX_DURABILITY }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects a slot entry with negative durability', () => {
    const entry = { slot: 0, itemType: 'IRON_PICKAXE', count: 1, durability: -1 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects a slot entry with float durability', () => {
    const entry = { slot: 0, itemType: 'IRON_PICKAXE', count: 1, durability: 1.5 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects omitting durability (slot without durability no longer decodes)', () => {
    const entry = { slot: 0, itemType: 'DIRT', count: 32 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('multiple slots with mixed none/some/durability round-trip correctly', () => {
    const durable = { slot: 0, itemType: 'DIAMOND_SWORD', count: 1, durability: DIAMOND_MAX_DURABILITY }
    const plain = { slot: 1, itemType: 'STONE', count: 64, durability: null }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [durable, null, plain] })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      const slots = result.right.slots
      expect(Option.isSome(slots[0]!)).toBe(true)
      expect(Option.isNone(slots[1]!)).toBe(true)
      expect(Option.isSome(slots[2]!)).toBe(true)
    }
  })
})
