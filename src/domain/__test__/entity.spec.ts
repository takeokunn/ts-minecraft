import * as S from 'effect/Schema'
import { describe, assert, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { EntityIdSchema, toEntityId } from '../entity'
import { Effect, Gen } from 'effect'

describe('Entity', () => {
  describe('EntityIdSchema', () => {
    it.effect('should be reversible after encoding and decoding', () =>
      Gen.flatMap(fc.gen(EntityIdSchema), (value) =>
        Effect.sync(() => {
          const encode = S.encodeSync(EntityIdSchema)
          const decode = S.decodeSync(EntityIdSchema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ))
  })

  describe('toEntityId', () => {
    it('should correctly brand a number as EntityId', () => {
      expect(toEntityId(1)).toBe(1)
      expect(toEntityId(100.5)).toBe(100.5) // S.Number accepts floats
    })
  })
})