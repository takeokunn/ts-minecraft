import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { describe, assert, it } from '@effect/vitest'
import * as fc from 'fast-check'
import * as T from '../types'
import { Effect } from 'effect'

describe('Type Schemas', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Effect.sync(() => {
        const arbitrary = Arbitrary.make(schema)
        fc.assert(
          fc.property(arbitrary, (value) => {
            const encode = S.encodeSync(schema)
            const decode = S.decodeSync(schema)
            const decodedValue = decode(encode(value))
            assert.deepStrictEqual(decodedValue, value)
          }),
        )
      }),
    )
  }

  testReversibility('ChunkGenerationResultSchema', T.ChunkGenerationResultSchema)
  testReversibility('ComputationTaskSchema', T.ComputationTaskSchema)
  testReversibility('UpsertChunkRenderCommandSchema', T.UpsertChunkRenderCommandSchema)
  testReversibility('RemoveChunkRenderCommandSchema', T.RemoveChunkRenderCommandSchema)
  testReversibility('RenderCommandSchema', T.RenderCommandSchema)
})
