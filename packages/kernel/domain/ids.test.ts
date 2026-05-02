import { describe, it, expect } from 'vitest'
import {
  WorldId,
  PlayerId,
  BlockId,
  PhysicsBodyId,
  ChunkId,
  RecipeId,
} from './ids'

describe('ids', () => {
  describe('WorldId', () => {
    it('make returns a branded WorldId', () => {
      expect(WorldId.make('world-1')).toBe('world-1')
    })

    it('accepts empty string', () => {
      expect(WorldId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(() => WorldId.make(null as unknown as string)).toThrow()
    })

    it('throws on number input', () => {
      expect(() => WorldId.make(42 as unknown as string)).toThrow()
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
      expect(() => PlayerId.make(null as unknown as string)).toThrow()
    })

    it('throws on number input', () => {
      expect(() => PlayerId.make(0 as unknown as string)).toThrow()
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
      expect(() => BlockId.make(null as unknown as string)).toThrow()
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
      expect(() => PhysicsBodyId.make(null as unknown as string)).toThrow()
    })
  })

  describe('ChunkId', () => {
    it('make returns a branded ChunkId', () => {
      expect(ChunkId.make('0,0')).toBe('0,0')
    })

    it('accepts arbitrary string format', () => {
      expect(ChunkId.make('5,-3')).toBe('5,-3')
    })

    it('accepts empty string', () => {
      expect(ChunkId.make('')).toBe('')
    })

    it('throws on null input', () => {
      expect(() => ChunkId.make(null as unknown as string)).toThrow()
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
      expect(() => RecipeId.make(null as unknown as string)).toThrow()
    })

    it('throws on number input', () => {
      expect(() => RecipeId.make(1 as unknown as string)).toThrow()
    })
  })
})
