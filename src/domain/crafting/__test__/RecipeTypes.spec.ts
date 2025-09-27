import { Schema } from '@effect/schema'
import { describe, expect, it } from 'vitest'
import {
  CraftingGrid,
  CraftingItemStack,
  CraftingRecipe,
  CraftingResult,
  createEmptyCraftingGrid,
  CustomItemMatcher,
  ExactItemMatcher,
  GridHeight,
  GridHeightSchema,
  GridWidth,
  GridWidthSchema,
  isCustomItemMatcher,
  isExactItemMatcher,
  isShapedRecipe,
  isShapelessRecipe,
  isTagItemMatcher,
  ItemMatcher,
  ItemStackCount,
  ItemStackCountSchema,
  RecipeCategory,
  RecipeId,
  RecipeIdSchema,
  ShapedRecipe,
  ShapelessRecipe,
  TagItemMatcher,
} from '../types/RecipeTypes'

describe('RecipeTypes', () => {
  describe('Brand Types', () => {
    describe('RecipeId', () => {
      it('should create valid RecipeId', () => {
        const id = RecipeId('test_recipe')
        expect(id).toBe('test_recipe')
      })

      it('should validate RecipeId schema', () => {
        const validId = 'valid_recipe'
        const result = Schema.decodeUnknownSync(RecipeIdSchema)(validId)
        expect(result).toBe(validId)
      })

      it('should reject empty RecipeId', () => {
        expect(() => {
          Schema.decodeUnknownSync(RecipeIdSchema)('')
        }).toThrow()
      })
    })

    describe('ItemStackCount', () => {
      it('should create valid ItemStackCount', () => {
        const count = ItemStackCount(5)
        expect(count).toBe(5)
      })

      it('should validate ItemStackCount within range', () => {
        const result = Schema.decodeUnknownSync(ItemStackCountSchema)(32)
        expect(result).toBe(32)
      })

      it('should reject invalid ItemStackCount', () => {
        // Negative number
        expect(() => {
          Schema.decodeUnknownSync(ItemStackCountSchema)(-1)
        }).toThrow()

        // Over 64
        expect(() => {
          Schema.decodeUnknownSync(ItemStackCountSchema)(65)
        }).toThrow()

        // Non-integer
        expect(() => {
          Schema.decodeUnknownSync(ItemStackCountSchema)(1.5)
        }).toThrow()
      })
    })

    describe('GridWidth', () => {
      it('should create valid GridWidth', () => {
        const width = GridWidth(3)
        expect(width).toBe(3)
      })

      it('should validate GridWidth within range', () => {
        const result = Schema.decodeUnknownSync(GridWidthSchema)(2)
        expect(result).toBe(2)
      })

      it('should reject invalid GridWidth', () => {
        // Zero
        expect(() => {
          Schema.decodeUnknownSync(GridWidthSchema)(0)
        }).toThrow()

        // Over 3
        expect(() => {
          Schema.decodeUnknownSync(GridWidthSchema)(4)
        }).toThrow()
      })
    })

    describe('GridHeight', () => {
      it('should create valid GridHeight', () => {
        const height = GridHeight(2)
        expect(height).toBe(2)
      })

      it('should validate GridHeight within range', () => {
        const result = Schema.decodeUnknownSync(GridHeightSchema)(3)
        expect(result).toBe(3)
      })

      it('should reject invalid GridHeight', () => {
        // Zero
        expect(() => {
          Schema.decodeUnknownSync(GridHeightSchema)(0)
        }).toThrow()

        // Over 3
        expect(() => {
          Schema.decodeUnknownSync(GridHeightSchema)(4)
        }).toThrow()
      })
    })
  })

  describe('ItemMatcher', () => {
    describe('ExactItemMatcher', () => {
      it('should create valid exact matcher', () => {
        const matcher: ExactItemMatcher = {
          _tag: 'exact',
          itemId: 'diamond',
        }

        const decoded = Schema.decodeUnknownSync(ItemMatcher)(matcher)
        expect(decoded).toEqual(matcher)
      })
    })

    describe('TagItemMatcher', () => {
      it('should create valid tag matcher', () => {
        const matcher: TagItemMatcher = {
          _tag: 'tag',
          tag: 'planks',
        }

        const decoded = Schema.decodeUnknownSync(ItemMatcher)(matcher)
        expect(decoded).toEqual(matcher)
      })
    })

    describe('CustomItemMatcher', () => {
      it('should create valid custom matcher', () => {
        const predicate = (item: CraftingItemStack) => item.itemId === 'special'
        const matcher: CustomItemMatcher = {
          _tag: 'custom',
          predicate,
        }

        const decoded = Schema.decodeUnknownSync(ItemMatcher)(matcher)
        expect(decoded._tag).toBe('custom')
        if (decoded._tag === 'custom') {
          expect(decoded.predicate).toBe(predicate)
        }
      })
    })

    describe('Type Guards', () => {
      it('should correctly identify exact matcher', () => {
        const exact: ItemMatcher = { _tag: 'exact', itemId: 'stone' }
        const tag: ItemMatcher = { _tag: 'tag', tag: 'wood' }

        expect(isExactItemMatcher(exact)).toBe(true)
        expect(isExactItemMatcher(tag)).toBe(false)
      })

      it('should correctly identify tag matcher', () => {
        const tag: ItemMatcher = { _tag: 'tag', tag: 'wood' }
        const exact: ItemMatcher = { _tag: 'exact', itemId: 'stone' }

        expect(isTagItemMatcher(tag)).toBe(true)
        expect(isTagItemMatcher(exact)).toBe(false)
      })

      it('should correctly identify custom matcher', () => {
        const custom: ItemMatcher = { _tag: 'custom', predicate: () => true }
        const exact: ItemMatcher = { _tag: 'exact', itemId: 'stone' }

        expect(isCustomItemMatcher(custom)).toBe(true)
        expect(isCustomItemMatcher(exact)).toBe(false)
      })
    })
  })

  describe('RecipeCategory', () => {
    it('should validate all recipe categories', () => {
      const categories: RecipeCategory[] = [
        { _tag: 'crafting' },
        { _tag: 'smelting' },
        { _tag: 'smithing' },
        { _tag: 'stonecutting' },
      ]

      categories.forEach((category) => {
        const decoded = Schema.decodeUnknownSync(RecipeCategory)(category)
        expect(decoded).toEqual(category)
      })
    })
  })

  describe('CraftingRecipe', () => {
    describe('ShapedRecipe', () => {
      it('should create valid shaped recipe', () => {
        const recipe: ShapedRecipe = {
          _tag: 'shaped',
          id: RecipeId('test_shaped'),
          pattern: [
            ['W', 'W'],
            ['W', 'W'],
          ],
          ingredients: {
            W: { _tag: 'exact', itemId: 'wood' },
          },
          result: {
            itemId: 'crafting_table',
            count: ItemStackCount(1),
          },
          category: { _tag: 'crafting' },
        }

        const decoded = Schema.decodeUnknownSync(ShapedRecipe)(recipe)
        expect(decoded).toEqual(recipe)
      })

      it('should handle optional cells in pattern', () => {
        const recipe: ShapedRecipe = {
          _tag: 'shaped',
          id: RecipeId('test_l_shape'),
          pattern: [
            ['S', null],
            ['S', 'S'],
          ],
          ingredients: {
            S: { _tag: 'exact', itemId: 'stick' },
          },
          result: {
            itemId: 'hoe',
            count: ItemStackCount(1),
          },
          category: { _tag: 'crafting' },
        }

        const decoded = Schema.decodeUnknownSync(ShapedRecipe)(recipe)
        expect(decoded.pattern[0]?.[1]).toBeNull()
      })
    })

    describe('ShapelessRecipe', () => {
      it('should create valid shapeless recipe', () => {
        const recipe: ShapelessRecipe = {
          _tag: 'shapeless',
          id: RecipeId('test_shapeless'),
          ingredients: [
            { _tag: 'exact', itemId: 'sugar' },
            { _tag: 'exact', itemId: 'egg' },
            { _tag: 'exact', itemId: 'flour' },
          ],
          result: {
            itemId: 'cake',
            count: ItemStackCount(1),
          },
          category: { _tag: 'crafting' },
        }

        const decoded = Schema.decodeUnknownSync(ShapelessRecipe)(recipe)
        expect(decoded).toEqual(recipe)
      })
    })

    describe('Type Guards', () => {
      it('should correctly identify shaped recipe', () => {
        const shaped: CraftingRecipe = {
          _tag: 'shaped',
          id: RecipeId('shaped'),
          pattern: [['W']],
          ingredients: { W: { _tag: 'exact', itemId: 'wood' } },
          result: { itemId: 'stick', count: ItemStackCount(4) },
          category: { _tag: 'crafting' },
        }

        const shapeless: CraftingRecipe = {
          _tag: 'shapeless',
          id: RecipeId('shapeless'),
          ingredients: [{ _tag: 'exact', itemId: 'wood' }],
          result: { itemId: 'button', count: ItemStackCount(1) },
          category: { _tag: 'crafting' },
        }

        expect(isShapedRecipe(shaped)).toBe(true)
        expect(isShapedRecipe(shapeless)).toBe(false)
      })

      it('should correctly identify shapeless recipe', () => {
        const shapeless: CraftingRecipe = {
          _tag: 'shapeless',
          id: RecipeId('shapeless'),
          ingredients: [{ _tag: 'exact', itemId: 'wood' }],
          result: { itemId: 'button', count: ItemStackCount(1) },
          category: { _tag: 'crafting' },
        }

        const shaped: CraftingRecipe = {
          _tag: 'shaped',
          id: RecipeId('shaped'),
          pattern: [['W']],
          ingredients: { W: { _tag: 'exact', itemId: 'wood' } },
          result: { itemId: 'stick', count: ItemStackCount(4) },
          category: { _tag: 'crafting' },
        }

        expect(isShapelessRecipe(shapeless)).toBe(true)
        expect(isShapelessRecipe(shaped)).toBe(false)
      })
    })
  })

  describe('CraftingGrid', () => {
    it('should create valid crafting grid', () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [{ itemId: 'wood', count: ItemStackCount(1) }, null, null],
          [null, null, null],
          [null, null, null],
        ],
      }

      const decoded = Schema.decodeUnknownSync(CraftingGrid)(grid)
      expect(decoded).toEqual(grid)
    })

    it('should create empty crafting grid', () => {
      const grid = createEmptyCraftingGrid(GridWidth(2), GridHeight(2))

      expect(grid._tag).toBe('CraftingGrid')
      expect(grid.width).toBe(2)
      expect(grid.height).toBe(2)
      expect(grid.slots).toHaveLength(2)
      expect(grid.slots[0]).toHaveLength(2)
      expect(grid.slots[0]?.[0]).toBeNull()
    })

    it('should handle item stacks with metadata', () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(1),
        height: GridHeight(1),
        slots: [
          [
            {
              itemId: 'enchanted_book',
              count: ItemStackCount(1),
              metadata: {
                enchantment: 'sharpness',
                level: 5,
              },
            },
          ],
        ],
      }

      const decoded = Schema.decodeUnknownSync(CraftingGrid)(grid)
      expect(decoded.slots[0]?.[0]?.metadata).toEqual({
        enchantment: 'sharpness',
        level: 5,
      })
    })
  })

  describe('CraftingResult', () => {
    it('should create successful crafting result', () => {
      const result: CraftingResult = {
        _tag: 'CraftingResult',
        success: true,
        result: {
          itemId: 'diamond_sword',
          count: ItemStackCount(1),
        },
        consumedItems: [
          { itemId: 'diamond', count: ItemStackCount(2) },
          { itemId: 'stick', count: ItemStackCount(1) },
        ],
        remainingGrid: createEmptyCraftingGrid(GridWidth(3), GridHeight(3)),
        usedRecipe: {
          _tag: 'shaped',
          id: RecipeId('diamond_sword'),
          pattern: [
            [null, 'D', null],
            [null, 'D', null],
            [null, 'S', null],
          ],
          ingredients: {
            D: { _tag: 'exact', itemId: 'diamond' },
            S: { _tag: 'exact', itemId: 'stick' },
          },
          result: {
            itemId: 'diamond_sword',
            count: ItemStackCount(1),
          },
          category: { _tag: 'crafting' },
        },
      }

      const decoded = Schema.decodeUnknownSync(CraftingResult)(result)
      expect(decoded.success).toBe(true)
      expect(decoded.result?.itemId).toBe('diamond_sword')
    })

    it('should create failed crafting result', () => {
      const result: CraftingResult = {
        _tag: 'CraftingResult',
        success: false,
        result: undefined,
        consumedItems: [],
        remainingGrid: createEmptyCraftingGrid(GridWidth(3), GridHeight(3)),
        usedRecipe: undefined,
      }

      const decoded = Schema.decodeUnknownSync(CraftingResult)(result)
      expect(decoded.success).toBe(false)
      expect(decoded.result).toBeUndefined()
      expect(decoded.usedRecipe).toBeUndefined()
    })
  })
})
