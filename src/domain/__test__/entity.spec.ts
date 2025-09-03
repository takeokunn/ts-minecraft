import { describe, it, expect } from '@effect/vitest'
import { EntityIdSchema, toEntityId } from '../entity'
import { testReversibility } from '@test/test-utils'

describe('Entity', () => {
  describe('EntityIdSchema', () => {
    testReversibility('EntityIdSchema', EntityIdSchema)
  })

  describe('toEntityId', () => {
    it('should correctly brand a number as EntityId', () => {
      expect(toEntityId(1)).toBe(1)
      expect(toEntityId(100.5)).toBe(100.5) // S.Number accepts floats
    })
  })
})
