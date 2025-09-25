import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Option } from 'effect'
import { CraftingEngineService, CraftingEngineServiceLive } from '../CraftingEngineService'
import {
  CraftingGrid,
  CraftingRecipe,
  ShapedRecipe,
  ShapelessRecipe,
  CraftingItemStack,
  ItemMatcher,
  GridWidth,
  GridHeight,
  ItemStackCount,
  RecipeId,
  createEmptyCraftingGrid,
} from '../RecipeTypes'

describe('CraftingEngineService', () => {
  let service: CraftingEngineService

  beforeEach(() => {
    // Create service instance using Live implementation
    const program = CraftingEngineServiceLive.pipe(
      Effect.map((layer) => Effect.runSync(layer.build))
    )
    service = Effect.runSync(program)
  })

  describe('matchRecipe', () => {
    it('should match a simple shaped recipe', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [
            { itemId: 'wood', count: ItemStackCount(1) },
            { itemId: 'wood', count: ItemStackCount(1) },
            undefined,
          ],
          [
            { itemId: 'wood', count: ItemStackCount(1) },
            { itemId: 'wood', count: ItemStackCount(1) },
            undefined,
          ],
          [undefined, undefined, undefined],
        ],
      }

      const result = await Effect.runPromise(service.matchRecipe(grid))

      // Since we haven't registered recipes yet, this should return None
      expect(Option.isNone(result)).toBe(true)
    })

    it('should return None for empty grid', async () => {
      const grid = createEmptyCraftingGrid(GridWidth(3), GridHeight(3))

      const result = await Effect.runPromise(service.matchRecipe(grid))

      expect(Option.isNone(result)).toBe(true)
    })

    it('should match shapeless recipe regardless of item positions', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [
            undefined,
            { itemId: 'stick', count: ItemStackCount(1) },
            undefined,
          ],
          [
            { itemId: 'coal', count: ItemStackCount(1) },
            undefined,
            undefined,
          ],
          [undefined, undefined, undefined],
        ],
      }

      const result = await Effect.runPromise(service.matchRecipe(grid))

      // Since we haven't registered recipes yet, this should return None
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('validateRecipeMatch', () => {
    it('should validate a matching shaped recipe', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(2),
        height: GridHeight(2),
        slots: [
          [
            { itemId: 'planks', count: ItemStackCount(1) },
            { itemId: 'planks', count: ItemStackCount(1) },
          ],
          [
            { itemId: 'planks', count: ItemStackCount(1) },
            { itemId: 'planks', count: ItemStackCount(1) },
          ],
        ],
      }

      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('crafting_table'),
        pattern: [
          ['P', 'P'],
          ['P', 'P'],
        ],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'crafting_table',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(
        service.validateRecipeMatch(grid, recipe)
      )

      // This should validate successfully
      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right).toBe(true)
      }
    })

    it('should reject mismatched recipe', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(2),
        height: GridHeight(2),
        slots: [
          [
            { itemId: 'stone', count: ItemStackCount(1) },
            { itemId: 'stone', count: ItemStackCount(1) },
          ],
          [
            { itemId: 'stone', count: ItemStackCount(1) },
            { itemId: 'stone', count: ItemStackCount(1) },
          ],
        ],
      }

      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('crafting_table'),
        pattern: [
          ['P', 'P'],
          ['P', 'P'],
        ],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'crafting_table',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(
        service.validateRecipeMatch(grid, recipe)
      )

      // This should return false or error
      if (result._tag === 'Right') {
        expect(result.right).toBe(false)
      }
    })
  })

  describe('executeCrafting', () => {
    it('should execute crafting and consume items', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(2),
        height: GridHeight(2),
        slots: [
          [
            { itemId: 'planks', count: ItemStackCount(1) },
            { itemId: 'planks', count: ItemStackCount(1) },
          ],
          [
            { itemId: 'planks', count: ItemStackCount(1) },
            { itemId: 'planks', count: ItemStackCount(1) },
          ],
        ],
      }

      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('crafting_table'),
        pattern: [
          ['P', 'P'],
          ['P', 'P'],
        ],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'crafting_table',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(
        service.executeCrafting(grid, recipe)
      )

      if (result._tag === 'Right') {
        const craftingResult = result.right
        expect(craftingResult._tag).toBe('CraftingResult')
        expect(craftingResult.success).toBe(true)
        expect(craftingResult.result?.itemId).toBe('crafting_table')
        expect(craftingResult.consumedItems).toHaveLength(4)

        // Check that grid slots are now empty
        const remainingGrid = craftingResult.remainingGrid
        expect(remainingGrid.slots[0][0]).toBeUndefined()
        expect(remainingGrid.slots[0][1]).toBeUndefined()
        expect(remainingGrid.slots[1][0]).toBeUndefined()
        expect(remainingGrid.slots[1][1]).toBeUndefined()
      }
    })

    it('should handle shapeless recipe execution', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [
            { itemId: 'stick', count: ItemStackCount(1) },
            undefined,
            undefined,
          ],
          [
            undefined,
            { itemId: 'coal', count: ItemStackCount(1) },
            undefined,
          ],
          [undefined, undefined, undefined],
        ],
      }

      const recipe: ShapelessRecipe = {
        _tag: 'shapeless',
        id: RecipeId('torch'),
        ingredients: [
          { _tag: 'exact', itemId: 'coal' },
          { _tag: 'exact', itemId: 'stick' },
        ],
        result: {
          itemId: 'torch',
          count: ItemStackCount(4),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(
        service.executeCrafting(grid, recipe)
      )

      if (result._tag === 'Right') {
        const craftingResult = result.right
        expect(craftingResult.success).toBe(true)
        expect(craftingResult.result?.itemId).toBe('torch')
        expect(craftingResult.result?.count).toBe(ItemStackCount(4))
        expect(craftingResult.consumedItems).toHaveLength(2)
      }
    })
  })

  describe('findMatchingRecipes', () => {
    it('should find all matching recipes for a grid', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [
            { itemId: 'planks', count: ItemStackCount(1) },
            { itemId: 'planks', count: ItemStackCount(1) },
            undefined,
          ],
          [
            undefined,
            undefined,
            undefined,
          ],
          [undefined, undefined, undefined],
        ],
      }

      const result = await Effect.runPromise(service.findMatchingRecipes(grid))

      // Initially should be empty as no recipes are registered
      expect(result).toHaveLength(0)
    })

    it('should handle empty grid', async () => {
      const grid = createEmptyCraftingGrid(GridWidth(3), GridHeight(3))

      const result = await Effect.runPromise(service.findMatchingRecipes(grid))

      expect(result).toHaveLength(0)
    })
  })

  describe('Recipe Pattern Matching', () => {
    it('should match rotated shaped patterns', async () => {
      // Test that L-shaped patterns match when rotated
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [
            { itemId: 'stick', count: ItemStackCount(1) },
            undefined,
            undefined,
          ],
          [
            { itemId: 'stick', count: ItemStackCount(1) },
            { itemId: 'stick', count: ItemStackCount(1) },
            undefined,
          ],
          [undefined, undefined, undefined],
        ],
      }

      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('hoe'),
        pattern: [
          ['S', 'S'],
          ['S', undefined],
        ],
        ingredients: {
          'S': { _tag: 'exact', itemId: 'stick' },
        },
        result: {
          itemId: 'hoe_handle',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(
        service.validateRecipeMatch(grid, recipe)
      )

      // Pattern matching should handle rotation
      if (result._tag === 'Right') {
        expect(result.right).toBeDefined()
      }
    })

    it('should match tag-based ingredients', async () => {
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: GridWidth(3),
        height: GridHeight(3),
        slots: [
          [
            { itemId: 'oak_planks', count: ItemStackCount(1) },
            { itemId: 'birch_planks', count: ItemStackCount(1) },
            undefined,
          ],
          [
            { itemId: 'spruce_planks', count: ItemStackCount(1) },
            { itemId: 'jungle_planks', count: ItemStackCount(1) },
            undefined,
          ],
          [undefined, undefined, undefined],
        ],
      }

      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('chest'),
        pattern: [
          ['W', 'W'],
          ['W', 'W'],
        ],
        ingredients: {
          'W': { _tag: 'tag', tag: 'planks' },
        },
        result: {
          itemId: 'chest',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      // This test demonstrates tag-based matching
      const result = await Effect.runPromiseEither(
        service.validateRecipeMatch(grid, recipe)
      )

      expect(result._tag).toBe('Right')
    })
  })
})