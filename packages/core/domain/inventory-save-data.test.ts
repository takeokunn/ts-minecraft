import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Option, Schema } from 'effect'
import { InventorySaveDataSchema } from './inventory-save-data'

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
    const entry = { slot: 0, itemType: 'STONE', count: 1 }
    const result = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts count 64 (maximum)', () => {
    const entry = { slot: 0, itemType: 'COAL', count: 64 }
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
    const entry = { slot: 2, itemType: 'DIAMOND_PICKAXE', count: 1 }
    const decodeResult = Schema.decodeUnknownEither(InventorySaveDataSchema)({ slots: [entry] })
    expect(Either.isRight(decodeResult)).toBe(true)
    if (Either.isRight(decodeResult)) {
      const encodeResult = Schema.encodeEither(InventorySaveDataSchema)(decodeResult.right)
      expect(Either.isRight(encodeResult)).toBe(true)
    }
  })
})
