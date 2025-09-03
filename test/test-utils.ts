import * as S from 'effect/Schema'
import { it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import * as Arbitrary from 'effect/Arbitrary'

export const testReversibility = (name: string, schema: S.Schema<any, any>) => {
  it.effect(`${name} should be reversible after encoding and decoding`, () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(Arbitrary.make(schema), async (value) => {
          const encode = S.encodeSync(schema)
          const decode = S.decodeSync(schema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ),
    ),
  )
}
