import { describe, it, expect } from '@effect/vitest'
import { EntityIdSchema, toEntityId } from '../../core/entities/entity'
import { testReversibility } from '@test/test-utils'
import { ParseError } from 'effect/ParseResult'

describe('Entity', () => {
  describe('EntityIdSchema', () => {
    testReversibility('EntityIdSchema', EntityIdSchema)
  })

  describe('toEntityId', () => {
    it('should correctly brand a number as EntityId', () => {
      expect(toEntityId(1)).toBe(1)
      expect(toEntityId(100.5)).toBe(100.5) // S.Number accepts floats
    })

    it('should throw a ParseError for non-number inputs', () => {
      expect(() => toEntityId('1')).toThrow(ParseError)
      expect(() => toEntityId(null)).toThrow(ParseError)
      expect(() => toEntityId(undefined)).toThrow(ParseError)
      expect(() => toEntityId({})).toThrow(ParseError)
    })
  })
})
