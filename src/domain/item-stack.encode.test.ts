import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Array as Arr, Either, Option, Schema } from 'effect'
import { ItemStack } from './item-stack'

// ItemStack uses Schema.Class, so the encoded form equals the plain object representation.
// Schema.encode(ItemStack.schema()) produces the "encoded" (plain) value from an ItemStack instance.

describe('ItemStack Schema.Class encode round-trip', () => {
  it('encodes an ItemStack to its plain object representation', () => {
    const stack = new ItemStack({ blockType: 'STONE', count: 32 })
    const encoded = Schema.encodeSync(ItemStack)(stack)
    expect(encoded.blockType).toBe('STONE')
    expect(encoded.count).toBe(32)
  })

  it('round-trips encode then decode back to identical values', () => {
    const original = new ItemStack({ blockType: 'DIRT', count: 10 })
    const encoded = Schema.encodeSync(ItemStack)(original)
    const decoded = Schema.decodeUnknownSync(ItemStack)(encoded)
    expect(decoded.blockType).toBe(original.blockType)
    expect(decoded.count).toBe(original.count)
  })

  it('round-trips for all valid block types', () => {
    const blockTypes = [
      'AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS',
      'SAND', 'WATER', 'LEAVES', 'GLASS',
      'SNOW', 'GRAVEL', 'COBBLESTONE',
    ] as const

    Arr.forEach(blockTypes, (blockType) => {
      const stack = new ItemStack({ blockType, count: 1 })
      const encoded = Schema.encodeSync(ItemStack)(stack)
      const decoded = Schema.decodeUnknownSync(ItemStack)(encoded)
      expect(decoded.blockType).toBe(blockType)
      expect(decoded.count).toBe(1)
    })
  })

  it('round-trips with count at minimum boundary (1)', () => {
    const stack = new ItemStack({ blockType: 'WOOD', count: 1 })
    const encoded = Schema.encodeSync(ItemStack)(stack)
    const decoded = Schema.decodeUnknownSync(ItemStack)(encoded)
    expect(decoded.count).toBe(1)
  })

  it('round-trips with count at maximum boundary (64)', () => {
    const stack = new ItemStack({ blockType: 'WOOD', count: 64 })
    const encoded = Schema.encodeSync(ItemStack)(stack)
    const decoded = Schema.decodeUnknownSync(ItemStack)(encoded)
    expect(decoded.count).toBe(64)
  })

  it('decode rejects count below minimum (0)', () => {
    expect(() =>
      Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: 0 })
    ).toThrow()
  })

  it('decode rejects count above maximum (65)', () => {
    expect(() =>
      Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE', count: 65 })
    ).toThrow()
  })

  it('decode rejects invalid blockType', () => {
    expect(() =>
      Schema.decodeUnknownSync(ItemStack)({ blockType: 'BEDROCK', count: 1 })
    ).toThrow()
  })

  it('decode rejects missing blockType field', () => {
    expect(() =>
      Schema.decodeUnknownSync(ItemStack)({ count: 10 })
    ).toThrow()
  })

  it('decode rejects missing count field', () => {
    expect(() =>
      Schema.decodeUnknownSync(ItemStack)({ blockType: 'STONE' })
    ).toThrow()
  })

  it('encodes ItemStack instance and decoded object have same structure', () => {
    const stack = new ItemStack({ blockType: 'GRASS', count: 5 })
    const encoded = Schema.encodeSync(ItemStack)(stack)
    expect(typeof encoded).toBe('object')
    expect(encoded).toHaveProperty('blockType')
    expect(encoded).toHaveProperty('count')
  })

  it('Effect.either encode succeeds for valid ItemStack', () => {
    const stack = new ItemStack({ blockType: 'SAND', count: 16 })
    const result = Schema.encodeUnknownEither(ItemStack)(stack)
    expect(Either.isRight(result)).toBe(true)
    const encoded = Option.getOrThrow(Either.getRight(result))
    expect(encoded.count).toBe(16)
    expect(encoded.blockType).toBe('SAND')
  })
})
