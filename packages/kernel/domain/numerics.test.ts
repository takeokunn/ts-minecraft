import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  SlotIndex,
  SlotIndexSchema,
  DeltaTimeSecs,
  DeltaTimeSecsSchema,
  BlockIndex,
  BlockIndexSchema,
} from './numerics'

describe('numerics', () => {
  describe('SlotIndex', () => {
    it('make returns a branded SlotIndex for 0', () => {
      expect(SlotIndex.make(0)).toBe(0)
    })

    it('make returns a branded SlotIndex for positive integer', () => {
      expect(SlotIndex.make(35)).toBe(35)
    })

    it('toNumber returns the underlying number', () => {
      expect(SlotIndex.toNumber(SlotIndex.make(9))).toBe(9)
    })

    it('toNumber round-trips the value', () => {
      const idx = SlotIndex.make(27)
      expect(SlotIndex.toNumber(idx)).toBe(27)
    })

    it('rejects negative integer', () => {
      expect(() => SlotIndex.make(-1)).toThrow()
    })

    it('rejects non-integer float', () => {
      expect(() => SlotIndex.make(1.5)).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => SlotIndex.make(NaN)).toThrow()
    })

    it('rejects non-number input', () => {
      expect(() => Schema.decodeUnknownSync(SlotIndexSchema)('slot')).toThrow()
    })

    it('Schema.is returns true for valid SlotIndex', () => {
      expect(Schema.is(SlotIndexSchema)(SlotIndex.make(0))).toBe(true)
    })
  })

  describe('DeltaTimeSecs', () => {
    it('make returns a branded DeltaTimeSecs for typical 60fps delta', () => {
      expect(DeltaTimeSecs.make(0.016)).toBeCloseTo(0.016)
    })

    it('make accepts 1.0', () => {
      expect(DeltaTimeSecs.make(1.0)).toBe(1.0)
    })

    it('rejects zero (not positive)', () => {
      expect(() => DeltaTimeSecs.make(0)).toThrow()
    })

    it('rejects negative value', () => {
      expect(() => DeltaTimeSecs.make(-0.016)).toThrow()
    })

    it('rejects Infinity (not finite)', () => {
      expect(() => DeltaTimeSecs.make(Infinity)).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => DeltaTimeSecs.make(NaN)).toThrow()
    })

    it('rejects non-number input', () => {
      expect(() => Schema.decodeUnknownSync(DeltaTimeSecsSchema)('16ms')).toThrow()
    })

    it('Schema.is returns true for valid DeltaTimeSecs', () => {
      expect(Schema.is(DeltaTimeSecsSchema)(DeltaTimeSecs.make(0.016))).toBe(true)
    })
  })

  describe('BlockIndex', () => {
    it('make returns a branded BlockIndex for 0', () => {
      expect(BlockIndex.make(0)).toBe(0)
    })

    it('make accepts large positive integer', () => {
      expect(BlockIndex.make(65535)).toBe(65535)
    })

    it('make(65536) throws (exceeds max)', () => {
      expect(() => BlockIndex.make(65536)).toThrow()
    })

    it('rejects negative integer', () => {
      expect(() => BlockIndex.make(-1)).toThrow()
    })

    it('rejects non-integer float', () => {
      expect(() => BlockIndex.make(0.5)).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => BlockIndex.make(NaN)).toThrow()
    })

    it('rejects non-number input', () => {
      expect(() => Schema.decodeUnknownSync(BlockIndexSchema)('idx')).toThrow()
    })

    it('Schema.is returns true for valid BlockIndex', () => {
      expect(Schema.is(BlockIndexSchema)(BlockIndex.make(42))).toBe(true)
    })
  })
})
