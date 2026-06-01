import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  INDEX_TO_BLOCK_TYPE,
  BLOCK_TYPE_TO_INDEX,
  blockTypeToIndex,
  indexToBlockType,
} from './block-codec'
import type { BlockType } from './block-type'

describe('block-codec', () => {
  describe('INDEX_TO_BLOCK_TYPE lookup table', () => {
    it('index 0 is AIR', () => {
      expect(INDEX_TO_BLOCK_TYPE[0]).toBe('AIR')
    })

    it('index 1 is DIRT', () => {
      expect(INDEX_TO_BLOCK_TYPE[1]).toBe('DIRT')
    })

    it('index 4 is GRASS', () => {
      expect(INDEX_TO_BLOCK_TYPE[4]).toBe('GRASS')
    })

    it('contains no duplicate block types', () => {
      expect(INDEX_TO_BLOCK_TYPE.length).toBe(new Set(INDEX_TO_BLOCK_TYPE).size)
    })

    it('has exactly 44 entries (world-placeable blocks only, no inventory items)', () => {
      expect(INDEX_TO_BLOCK_TYPE.length).toBe(44)
    })

    it('PLANKS is at index 40', () => {
      expect(INDEX_TO_BLOCK_TYPE[40]).toBe('PLANKS')
    })

    it('CRAFTING_TABLE is at index 41', () => {
      expect(INDEX_TO_BLOCK_TYPE[41]).toBe('CRAFTING_TABLE')
    })

    it('FURNACE is at index 42', () => {
      expect(INDEX_TO_BLOCK_TYPE[42]).toBe('FURNACE')
    })

    it('TORCH is at index 43', () => {
      expect(INDEX_TO_BLOCK_TYPE[43]).toBe('TORCH')
    })

    it('does not contain inventory-only items', () => {
      const inventoryItems = ['STICKS', 'COAL', 'WOODEN_SWORD', 'WOODEN_PICKAXE', 'STONE_PICKAXE',
        'RAW_IRON', 'IRON_INGOT', 'IRON_PICKAXE', 'RAW_GOLD', 'GOLD_INGOT', 'DIAMOND',
        'REDSTONE_DUST', 'LAPIS_LAZULI', 'EMERALD', 'DIAMOND_PICKAXE']
      inventoryItems.forEach((item) => {
        expect(INDEX_TO_BLOCK_TYPE).not.toContain(item)
      })
    })
  })

  describe('BLOCK_TYPE_TO_INDEX lookup table', () => {
    it('AIR maps to index 0', () => {
      expect(BLOCK_TYPE_TO_INDEX['AIR']).toBe(0)
    })

    it('GRASS maps to index 4', () => {
      expect(BLOCK_TYPE_TO_INDEX['GRASS']).toBe(4)
    })

    it('every index in INDEX_TO_BLOCK_TYPE has a reverse mapping', () => {
      INDEX_TO_BLOCK_TYPE.forEach((type, idx) => {
        expect(BLOCK_TYPE_TO_INDEX[type]).toBe(idx)
      })
    })
  })

  describe('blockTypeToIndex', () => {
    it('AIR → 0', () => {
      expect(blockTypeToIndex('AIR')).toBe(0)
    })

    it('DIRT → 1', () => {
      expect(blockTypeToIndex('DIRT')).toBe(1)
    })

    it('GRASS → 4', () => {
      expect(blockTypeToIndex('GRASS')).toBe(4)
    })
  })

  describe('indexToBlockType', () => {
    it('0 → AIR', () => {
      expect(indexToBlockType(0)).toBe('AIR')
    })

    it('1 → DIRT', () => {
      expect(indexToBlockType(1)).toBe('DIRT')
    })

    it('-1 (out-of-bounds) → AIR fallback', () => {
      expect(indexToBlockType(-1)).toBe('AIR')
    })

    it('9999 (out-of-bounds) → AIR fallback', () => {
      expect(indexToBlockType(9999)).toBe('AIR')
    })
  })

  describe('round-trip invariants', () => {
    it('blockTypeToIndex(indexToBlockType(i)) === i for all valid indices', () => {
      INDEX_TO_BLOCK_TYPE.forEach((_type, idx) => {
        expect(blockTypeToIndex(indexToBlockType(idx))).toBe(idx)
      })
    })

    it('indexToBlockType(blockTypeToIndex(t)) === t for all valid block types', () => {
      const types = INDEX_TO_BLOCK_TYPE as ReadonlyArray<BlockType>
      types.forEach((type) => {
        expect(indexToBlockType(blockTypeToIndex(type))).toBe(type)
      })
    })
  })
})
