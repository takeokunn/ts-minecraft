import { Either,Schema } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
BlockIndexSchema,
ChunkCacheKey,
ChunkCacheKeySchema,
DeltaTimeSecsSchema,
MaterialCacheKey,
MaterialCacheKeySchema,
MetersPerSec,
RecipeIdSchema,
SlotIndexSchema,
TextureUrl,
TextureUrlSchema
} from './kernel'

describe('shared/kernel (branded types)', () => {
  describe('RecipeId', () => {
    const cases = [
      { input: 'recipe-crafting-table', label: 'crafting table recipe' },
      { input: 'recipe-sword', label: 'sword recipe' },
    ] as const
    it['each'](cases)('creates valid RecipeId: $label', ({ input }: (typeof cases)[number]) => {
      expect(RecipeIdSchema.make(input)).toBe(input)
    })
    it('round-trips through encode/decode', () => {
      const id = RecipeIdSchema.make('recipe-abc')
      expect(Schema.encodeSync(RecipeIdSchema)(id)).toBe('recipe-abc')
    })
    it('validates with Schema.is', () => {
      expect(Schema.is(RecipeIdSchema)(RecipeIdSchema.make('recipe-1'))).toBe(true)
    })
  })

  describe('ChunkCacheKey', () => {
    it('make({x:0, z:0}) produces "0,0"', () => {
      expect(ChunkCacheKey.make({ x: 0, z: 0 })).toBe('0,0')
    })
    it('make({x:5, z:-3}) produces "5,-3"', () => {
      expect(ChunkCacheKey.make({ x: 5, z: -3 })).toBe('5,-3')
    })
    it('validates with Schema.is', () => {
      expect(Schema.is(ChunkCacheKeySchema)(ChunkCacheKey.make({ x: 1, z: 2 }))).toBe(true)
    })
  })

  describe('TextureUrl', () => {
    it('make() accepts relative path', () => {
      expect(TextureUrl.make('/textures/stone.png')).toBe('/textures/stone.png')
    })
    it('make() accepts absolute URL', () => {
      expect(TextureUrl.make('https://cdn.example.com/tex.png')).toBe('https://cdn.example.com/tex.png')
    })
    it('validates with Schema.is', () => {
      expect(Schema.is(TextureUrlSchema)(TextureUrl.make('/t.png'))).toBe(true)
    })
  })

  describe('MaterialCacheKey', () => {
    it('make() with number produces "material-number-N"', () => {
      expect(MaterialCacheKey.make(0xff0000)).toBe('material-number-16711680')
    })
    it('make() with string produces "material-string-S"', () => {
      expect(MaterialCacheKey.make('red')).toBe('material-string-red')
    })
    it('validates with Schema.is', () => {
      expect(Schema.is(MaterialCacheKeySchema)(MaterialCacheKey.make('blue'))).toBe(true)
    })
  })

  describe('MetersPerSec', () => {
    it('make() accepts positive velocity', () => {
      expect(MetersPerSec.make(5.4)).toBeCloseTo(5.4)
    })
    it('make() accepts negative velocity (deceleration)', () => {
      expect(MetersPerSec.make(-3.0)).toBeCloseTo(-3.0)
    })
    it('make() accepts zero (no-movement)', () => {
      expect(MetersPerSec.make(0)).toBe(0)
    })
    it('toNumber() round-trips the value', () => {
      expect(MetersPerSec.toNumber(MetersPerSec.make(2.5))).toBeCloseTo(2.5)
    })
    it('rejects Infinity', () => {
      expect(() => MetersPerSec.make(Infinity)).toThrow()
    })
    it('rejects NaN', () => {
      expect(() => MetersPerSec.make(NaN)).toThrow()
    })
  })

  describe('SlotIndex / DeltaTimeSecs / BlockIndex (Either-based validation)', () => {
    describe('SlotIndex', () => {
      it('valid SlotIndex: 0 (minimum)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(0)
        expect(Either.isRight(result)).toBe(true)
      })

      it('valid SlotIndex: 35 (hotbar max)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(35)
        expect(Either.isRight(result)).toBe(true)
      })

      it('invalid SlotIndex: -1 (negative)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(-1)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid SlotIndex: 1.5 (non-integer)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(1.5)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid SlotIndex: NaN', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(NaN)
        expect(Either.isLeft(result)).toBe(true)
      })
    })

    describe('DeltaTimeSecs', () => {
      it('valid DeltaTimeSecs: 0.016 (60fps)', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(0.016)
        expect(Either.isRight(result)).toBe(true)
      })

      it('valid DeltaTimeSecs: 1/60', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(1 / 60)
        expect(Either.isRight(result)).toBe(true)
      })

      it('invalid DeltaTimeSecs: 0 (not positive)', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(0)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid DeltaTimeSecs: -0.016 (negative)', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(-0.016)
        expect(Either.isLeft(result)).toBe(true)
      })
    })

    describe('BlockIndex', () => {
      it('valid BlockIndex: 0', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(0)
        expect(Either.isRight(result)).toBe(true)
      })

      it('valid BlockIndex: 65535', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(65535)
        expect(Either.isRight(result)).toBe(true)
      })

      it('invalid BlockIndex: -1', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(-1)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid BlockIndex: 0.5 (non-integer)', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(0.5)
        expect(Either.isLeft(result)).toBe(true)
      })
    })
  })
})
