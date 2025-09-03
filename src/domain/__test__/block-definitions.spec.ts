import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { describe, it, assert, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { BlockDefinitionSchema, blockDefinitions } from '../block-definitions'
import { blockTypeNames } from '../block-types'

describe('Block Definitions', () => {
  describe('BlockDefinitionSchema', () => {
    it.effect('should be reversible after encoding and decoding', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(Arbitrary.make(BlockDefinitionSchema), async (value) => {
            const encode = S.encodeSync(BlockDefinitionSchema)
            const decode = S.decodeSync(BlockDefinitionSchema)
            const decodedValue = decode(encode(value))
            assert.deepStrictEqual(decodedValue, value)
          }),
        ),
      ),
    )
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
