import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  WorldId,
  PlayerId,
  BlockId,
  PhysicsBodyId,
  RecipeId,
} from './ids'

const invokeWithInvalidInput = (make: (value: string) => unknown, value: unknown) => () =>
  (make as (value: unknown) => unknown)(value)

describe('ids', () => {
  describe('WorldId', () => {
    it('make returns a branded WorldId', () => {
      expect(WorldId.make('world-1')).toBe('world-1')
    })

    it('accepts empty string', () => {
      expect(WorldId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(invokeWithInvalidInput(WorldId.make, null)).toThrow()
    })

    it('throws on number input', () => {
      expect(invokeWithInvalidInput(WorldId.make, 42)).toThrow()
    })
  })

  describe('PlayerId', () => {
    it('make returns a branded PlayerId', () => {
      expect(PlayerId.make('player-1')).toBe('player-1')
    })

    it('accepts empty string', () => {
      expect(PlayerId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(invokeWithInvalidInput(PlayerId.make, null)).toThrow()
    })

    it('throws on number input', () => {
      expect(invokeWithInvalidInput(PlayerId.make, 0)).toThrow()
    })
  })

  describe('BlockId', () => {
    it('make returns a branded BlockId', () => {
      expect(BlockId.make('block-stone')).toBe('block-stone')
    })

    it('accepts empty string', () => {
      expect(BlockId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(invokeWithInvalidInput(BlockId.make, null)).toThrow()
    })
  })

  describe('PhysicsBodyId', () => {
    it('make returns a branded PhysicsBodyId', () => {
      expect(PhysicsBodyId.make('body-0')).toBe('body-0')
    })

    it('accepts empty string', () => {
      expect(PhysicsBodyId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(invokeWithInvalidInput(PhysicsBodyId.make, null)).toThrow()
    })
  })

  describe('RecipeId', () => {
    it('make returns a branded RecipeId', () => {
      expect(RecipeId.make('recipe-crafting-table')).toBe('recipe-crafting-table')
    })

    it('accepts empty string', () => {
      expect(RecipeId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(invokeWithInvalidInput(RecipeId.make, null)).toThrow()
    })

    it('throws on number input', () => {
      expect(invokeWithInvalidInput(RecipeId.make, 1)).toThrow()
    })
  })
})
