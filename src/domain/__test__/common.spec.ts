import * as S from 'effect/Schema'
import { describe, assert, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import * as C from '../common'
import { Effect, Gen } from 'effect'

describe('Common Schemas', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Gen.flatMap(fc.gen(schema), (value) =>
        Effect.sync(() => {
          const encode = S.encodeSync(schema)
          const decode = S.decodeSync(schema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ))
  }

  describe('Schema Reversibility', () => {
    testReversibility('Float', C.Float)
    testReversibility('Int', C.Int)
    testReversibility('Vector3FloatSchema', C.Vector3FloatSchema)
    testReversibility('Vector2FloatSchema', C.Vector2FloatSchema)
    testReversibility('Vector3IntSchema', C.Vector3IntSchema)
    testReversibility('ChunkX', C.ChunkX)
    testReversibility('ChunkZ', C.ChunkZ)
  })

  describe('toFloat', () => {
    it('should correctly brand a number as Float', () => {
      expect(C.toFloat(1.5)).toBe(1.5)
      expect(C.toFloat(-10)).toBe(-10)
    })
  })

  describe('toInt', () => {
    it('should correctly brand an integer as Int', () => {
      expect(C.toInt(42)).toBe(42)
    })

    it('should throw an error for non-integers', () => {
      expect(() => C.toInt(3.14)).toThrow()
    })
  })

  describe('toChunkX', () => {
    it('should correctly brand an integer as ChunkX', () => {
      expect(C.toChunkX(10)).toBe(10)
    })

    it('should throw an error for non-integers', () => {
      expect(() => C.toChunkX(1.2)).toThrow()
    })
  })

  describe('toChunkZ', () => {
    it('should correctly brand an integer as ChunkZ', () => {
      expect(C.toChunkZ(-5)).toBe(-5)
    })

    it('should throw an error for non-integers', () => {
      expect(() => C.toChunkZ(10.5)).toThrow()
    })
  })
})
