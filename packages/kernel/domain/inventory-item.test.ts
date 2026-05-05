import { describe, it, expect } from 'vitest'
import { Either, Schema } from 'effect'
import { InventoryItemSchema } from './inventory-item'

describe('InventoryItemSchema', () => {
  it('accepts BlockType member "STONE"', () => {
    const result = Schema.decodeUnknownEither(InventoryItemSchema)('STONE')
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts BlockType member "DIAMOND_ORE"', () => {
    const result = Schema.decodeUnknownEither(InventoryItemSchema)('DIAMOND_ORE')
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts BlockType member "TORCH"', () => {
    const result = Schema.decodeUnknownEither(InventoryItemSchema)('TORCH')
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts ItemType member "COAL"', () => {
    const result = Schema.decodeUnknownEither(InventoryItemSchema)('COAL')
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts ItemType member "DIAMOND_PICKAXE"', () => {
    const result = Schema.decodeUnknownEither(InventoryItemSchema)('DIAMOND_PICKAXE')
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects unknown string "UNKNOWN_ITEM"', () => {
    const result = Schema.decodeUnknownEither(InventoryItemSchema)('UNKNOWN_ITEM')
    expect(Either.isLeft(result)).toBe(true)
  })
})
