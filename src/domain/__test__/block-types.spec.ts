import * as S from "/schema/Schema"
import * as Arbitrary from 'effect/Arbitrary'
import { describe, assert, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { BlockTypeSchema, blockTypeNames } from '../block-types'
import { Effect } from 'effect'

describe('BlockTypeSchema', () => {
  it.effect('should have the correct number of block types', () =>
    Effect.sync(() => {
      assert.lengthOf(blockTypeNames, 12)
    }),
  )

  it.effect('should have literals equal to blockTypeNames', () =>
    Effect.sync(() => {
      assert.deepStrictEqual(BlockTypeSchema.literals, blockTypeNames)
    }),
  )

  it.effect('should be reversible after encoding and decoding', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(Arbitrary.make(BlockTypeSchema), async (value) => {
          const encode = S.encodeSync(BlockTypeSchema)
          const decode = S.decodeSync(BlockTypeSchema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ),
    ),
  )
})
