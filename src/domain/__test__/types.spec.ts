import { describe } from '@effect/vitest'
import * as T from '../types'
import { testReversibility } from '@test/test-utils'

describe('Type Schemas', () => {
  testReversibility('ComputationTaskSchema', T.ComputationTaskSchema)
  testReversibility('RemoveChunkRenderCommandSchema', T.RemoveChunkRenderCommandSchema)
})
