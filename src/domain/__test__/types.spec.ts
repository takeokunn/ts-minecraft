import * as S from 'effect/Schema'
import { describe, assert, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import * as T from '../types'
import { Effect } from 'effect'
import { arbitrary } from '@effect/schema/Arbitrary'

describe('Type Schemas', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Effect.gen(function* (_) {
        const arb = arbitrary(schema)
        const property = fc.property(arb(fc), (value) => {
          const encode = S.encodeSync(schema)
          const decode = S.decodeSync(schema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        })
        yield* _(Effect.promise(() => fc.assert(property)))
      }))
  }

  testReversibility('ChunkMeshSchema', T.ChunkMeshSchema)
  testReversibility('ChunkGenerationResultSchema', T.ChunkGenerationResultSchema)
  testReversibility('ComputationTaskSchema', T.ComputationTaskSchema)
  testReversibility('UpsertChunkRenderCommandSchema', T.UpsertChunkRenderCommandSchema)
  testReversibility('RemoveChunkRenderCommandSchema', T.RemoveChunkRenderCommandSchema)
  testReversibility('RenderCommandSchema', T.RenderCommandSchema)
})