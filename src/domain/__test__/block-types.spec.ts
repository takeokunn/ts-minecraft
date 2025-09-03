import { describe, it, assert } from '@effect/vitest'
import { BlockTypeSchema, blockTypeNames } from '../block-types'

describe('block-types', () => {
  it('should have the correct number of block types', () => {
    assert.lengthOf(blockTypeNames, 12)
  })

  it('should have literals equal to blockTypeNames', () => {
    assert.deepStrictEqual(BlockTypeSchema.literals, blockTypeNames)
  })
})
