import { describe } from '@effect/vitest'
import * as T from '../types'
import { testReversibility } from '@test/test-utils'

describe('Type Schemas', () => {
  testReversibility('ChunkMeshSchema', T.ChunkMeshSchema)
  testReversibility('ChunkGenerationResultSchema', T.ChunkGenerationResultSchema)
  testReversibility('ComputationTaskSchema', T.ComputationTaskSchema)
  testReversibility('UpsertChunkRenderCommandSchema', T.UpsertChunkRenderCommandSchema)
  testReversibility('RemoveChunkRenderCommandSchema', T.RemoveChunkRenderCommandSchema)
  testReversibility('RenderCommandSchema', T.RenderCommandSchema)
})