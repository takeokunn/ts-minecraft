import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import { expect } from 'vitest'
import {
  INDEX_TO_BLOCK_TYPE,
  BLOCK_TYPE_TO_INDEX,
  blockTypeToIndex,
  decodeBlockType,
  isValidBlockIndex,
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

    it('has exactly 95 entries (world-placeable blocks including nether, farming, redstone, furniture, crafting stations, End dimension, End expansion, storage, doors, glowstone, ladder, cobweb, sapling, flowers, mushrooms, grasses, waterside plants, ice, pressure plate, basic slab, basic stair, anvil, cauldron, and fire)', () => {
      expect(INDEX_TO_BLOCK_TYPE.length).toBe(95)
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

    it('REDSTONE_WIRE is at index 48', () => {
      expect(INDEX_TO_BLOCK_TYPE[48]).toBe('REDSTONE_WIRE')
    })

    it('REPEATER is at index 52', () => {
      expect(INDEX_TO_BLOCK_TYPE[52]).toBe('REPEATER')
    })

    it('CHEST is appended at index 72', () => {
      expect(INDEX_TO_BLOCK_TYPE[72]).toBe('CHEST')
      expect(blockTypeToIndex('CHEST')).toBe(72)
    })

    it('DOOR block states are appended at indices 73-74', () => {
      expect(INDEX_TO_BLOCK_TYPE[73]).toBe('DOOR')
      expect(INDEX_TO_BLOCK_TYPE[74]).toBe('DOOR_OPEN')
      expect(blockTypeToIndex('DOOR')).toBe(73)
      expect(blockTypeToIndex('DOOR_OPEN')).toBe(74)
    })

    it('GLOWSTONE, LADDER, COBWEB, SAPLING, flowers, mushrooms, grasses, waterside plants, ice, and pressure plate are appended at indices 75-89', () => {
      expect(INDEX_TO_BLOCK_TYPE[75]).toBe('GLOWSTONE')
      expect(INDEX_TO_BLOCK_TYPE[76]).toBe('LADDER')
      expect(INDEX_TO_BLOCK_TYPE[77]).toBe('COBWEB')
      expect(INDEX_TO_BLOCK_TYPE[78]).toBe('SAPLING')
      expect(INDEX_TO_BLOCK_TYPE[79]).toBe('DANDELION')
      expect(INDEX_TO_BLOCK_TYPE[80]).toBe('POPPY')
      expect(INDEX_TO_BLOCK_TYPE[81]).toBe('BROWN_MUSHROOM')
      expect(INDEX_TO_BLOCK_TYPE[82]).toBe('RED_MUSHROOM')
      expect(INDEX_TO_BLOCK_TYPE[83]).toBe('TALL_GRASS')
      expect(INDEX_TO_BLOCK_TYPE[84]).toBe('FERN')
      expect(INDEX_TO_BLOCK_TYPE[85]).toBe('SUGAR_CANE')
      expect(INDEX_TO_BLOCK_TYPE[86]).toBe('CACTUS')
      expect(INDEX_TO_BLOCK_TYPE[87]).toBe('LILY_PAD')
      expect(INDEX_TO_BLOCK_TYPE[88]).toBe('ICE')
      expect(INDEX_TO_BLOCK_TYPE[89]).toBe('PRESSURE_PLATE')
      expect(blockTypeToIndex('GLOWSTONE')).toBe(75)
      expect(blockTypeToIndex('LADDER')).toBe(76)
      expect(blockTypeToIndex('COBWEB')).toBe(77)
      expect(blockTypeToIndex('SAPLING')).toBe(78)
      expect(blockTypeToIndex('DANDELION')).toBe(79)
      expect(blockTypeToIndex('POPPY')).toBe(80)
      expect(blockTypeToIndex('BROWN_MUSHROOM')).toBe(81)
      expect(blockTypeToIndex('RED_MUSHROOM')).toBe(82)
      expect(blockTypeToIndex('TALL_GRASS')).toBe(83)
      expect(blockTypeToIndex('FERN')).toBe(84)
      expect(blockTypeToIndex('SUGAR_CANE')).toBe(85)
      expect(blockTypeToIndex('CACTUS')).toBe(86)
      expect(blockTypeToIndex('LILY_PAD')).toBe(87)
      expect(blockTypeToIndex('ICE')).toBe(88)
      expect(blockTypeToIndex('PRESSURE_PLATE')).toBe(89)
    })

    it('STONE_SLAB, OAK_STAIRS, ANVIL, CAULDRON, and FIRE are appended at indices 90-94', () => {
      expect(INDEX_TO_BLOCK_TYPE[90]).toBe('STONE_SLAB')
      expect(INDEX_TO_BLOCK_TYPE[91]).toBe('OAK_STAIRS')
      expect(INDEX_TO_BLOCK_TYPE[92]).toBe('ANVIL')
      expect(INDEX_TO_BLOCK_TYPE[93]).toBe('CAULDRON')
      expect(INDEX_TO_BLOCK_TYPE[94]).toBe('FIRE')
      expect(blockTypeToIndex('STONE_SLAB')).toBe(90)
      expect(blockTypeToIndex('OAK_STAIRS')).toBe(91)
      expect(blockTypeToIndex('ANVIL')).toBe(92)
      expect(blockTypeToIndex('CAULDRON')).toBe(93)
      expect(blockTypeToIndex('FIRE')).toBe(94)
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
      expect(indexToBlockType(blockTypeToIndex('AIR'))).toBe('AIR')
    })

    it('1 → DIRT', () => {
      expect(indexToBlockType(blockTypeToIndex('DIRT'))).toBe('DIRT')
    })

    it('does not decode negative out-of-bounds indices', () => {
      expect(Option.isNone(decodeBlockType(-1))).toBe(true)
    })

    it('does not decode high out-of-bounds indices', () => {
      expect(Option.isNone(decodeBlockType(9999))).toBe(true)
    })

    it('does not decode fractional indices', () => {
      expect(Option.isNone(decodeBlockType(1.5))).toBe(true)
    })

    it('exposes a predicate for storage-boundary checks', () => {
      expect(isValidBlockIndex(0)).toBe(true)
      expect(isValidBlockIndex(INDEX_TO_BLOCK_TYPE.length - 1)).toBe(true)
      expect(isValidBlockIndex(-1)).toBe(false)
      expect(isValidBlockIndex(INDEX_TO_BLOCK_TYPE.length)).toBe(false)
      expect(isValidBlockIndex(1.5)).toBe(false)
    })
  })

  describe('round-trip invariants', () => {
    it('blockTypeToIndex(indexToBlockType(i)) === i for all valid indices', () => {
      INDEX_TO_BLOCK_TYPE.forEach((_type, idx) => {
        if (!isValidBlockIndex(idx)) expect.fail(`Expected valid block index ${idx}`)
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
