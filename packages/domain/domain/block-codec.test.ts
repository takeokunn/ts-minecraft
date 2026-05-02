import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { INDEX_TO_BLOCK_TYPE, BLOCK_TYPE_TO_INDEX, blockTypeToIndex, indexToBlockType } from './block-codec'
import type { BlockType } from './block'

describe('block-codec', () => {
  describe('INDEX_TO_BLOCK_TYPE', () => {
    it('starts with AIR at index 0', () => {
      expect(INDEX_TO_BLOCK_TYPE[0]).toBe('AIR')
    })

    it('has DIRT at index 1', () => {
      expect(INDEX_TO_BLOCK_TYPE[1]).toBe('DIRT')
    })

    it('has 59 entries (one per BlockType)', () => {
      expect(INDEX_TO_BLOCK_TYPE.length).toBe(59)
    })

    it('contains no duplicates', () => {
      const seen = new Set(INDEX_TO_BLOCK_TYPE)
      expect(seen.size).toBe(INDEX_TO_BLOCK_TYPE.length)
    })
  })

  describe('BLOCK_TYPE_TO_INDEX', () => {
    it('maps AIR to 0', () => {
      expect(BLOCK_TYPE_TO_INDEX['AIR']).toBe(0)
    })

    it('maps DIRT to 1', () => {
      expect(BLOCK_TYPE_TO_INDEX['DIRT']).toBe(1)
    })

    it('is the inverse of INDEX_TO_BLOCK_TYPE', () => {
      Arr.forEach(INDEX_TO_BLOCK_TYPE as BlockType[], (type, i) => {
        expect(BLOCK_TYPE_TO_INDEX[type]).toBe(i)
      })
    })
  })

  describe('blockTypeToIndex', () => {
    it('returns 0 for AIR', () => {
      expect(blockTypeToIndex('AIR')).toBe(0)
    })

    it('returns the same value as BLOCK_TYPE_TO_INDEX lookup', () => {
      const types: BlockType[] = ['STONE', 'DIRT', 'WATER', 'DIAMOND_ORE', 'DIAMOND_PICKAXE']
      Arr.forEach(types, (type) => {
        expect(blockTypeToIndex(type)).toBe(BLOCK_TYPE_TO_INDEX[type])
      })
    })
  })

  describe('indexToBlockType', () => {
    it('returns AIR for index 0', () => {
      expect(indexToBlockType(0)).toBe('AIR')
    })

    it('returns AIR for out-of-range index (999)', () => {
      expect(indexToBlockType(999)).toBe('AIR')
    })

    it('returns AIR for negative index (-1)', () => {
      expect(indexToBlockType(-1)).toBe('AIR')
    })

    it('round-trips all valid indices back to their type', () => {
      Arr.forEach(INDEX_TO_BLOCK_TYPE as BlockType[], (type, i) => {
        expect(indexToBlockType(i)).toBe(type)
      })
    })
  })
})
