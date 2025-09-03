import * as S from 'effect/Schema'
import { describe, it, assert, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Gen } from 'effect'
import { BlockDefinitionSchema, blockDefinitions } from '../block-definitions'
import { blockTypeNames } from '../block-types'

describe('Block Definitions', () => {
  describe('BlockDefinitionSchema', () => {
    it.effect('should be reversible after encoding and decoding', () =>
      Gen.flatMap(fc.gen(BlockDefinitionSchema), (value) =>
        Effect.sync(() => {
          const encode = S.encodeSync(BlockDefinitionSchema)
          const decode = S.decodeSync(BlockDefinitionSchema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ))
  })

  describe('blockDefinitions', () => {
    it('should match the snapshot', () => {
      expect(blockDefinitions).toMatchSnapshot()
    })

    it.effect('should contain all block types', () =>
      Effect.sync(() => {
        for (const name of blockTypeNames) {
          assert.isDefined(blockDefinitions[name])
        }
      }))
  })
})
