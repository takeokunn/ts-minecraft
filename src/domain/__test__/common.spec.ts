import * as S from 'effect/Schema'
import { describe, assert, it } from '@effect/vitest'
import * as fc from 'fast-check'
import * as Arbitrary from '@effect/schema/Arbitrary'
import { Vector3FloatSchema, Vector3IntSchema } from '../common'
import { Effect } from 'effect'

describe('Common Schemas', () => {
  describe('Vector Schemas', () => {
    it.effect('Vector3FloatSchema should be reversible', () =>
      Effect.sync(() => {
        const arbitrary = Arbitrary.make(Vector3FloatSchema)
        fc.assert(
          fc.property(arbitrary, (vec) => {
            const encode = S.encodeSync(Vector3FloatSchema)
            const decode = S.decodeSync(Vector3FloatSchema)
            const decoded = decode(encode(vec))
            assert.deepStrictEqual(decoded, vec)
          }),
        )
      }),
    )

    it.effect('Vector3IntSchema should be reversible', () =>
      Effect.sync(() => {
        const arbitrary = Arbitrary.make(Vector3IntSchema)
        fc.assert(
          fc.property(arbitrary, (vec) => {
            const encode = S.encodeSync(Vector3IntSchema)
            const decode = S.decodeSync(Vector3IntSchema)
            const decoded = decode(encode(vec))
            assert.deepStrictEqual(decoded, vec)
          }),
        )
      }),
    )
  })
})
