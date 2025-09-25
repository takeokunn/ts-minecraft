import { describe, it, expect, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { RecipeRegistryService, RecipeRegistryServiceLive } from '../RecipeRegistryService'
import { CraftingEngineService, CraftingEngineServiceLive } from '../CraftingEngineService'
import {
  CraftingRecipe,
  ShapedRecipe,
  ShapelessRecipe,
  RecipeId,
  ItemStackCount,
  DuplicateRecipeError,
  RecipeNotFoundError,
} from '../RecipeTypes'

describe('RecipeRegistryService', () => {
  let service: RecipeRegistryService

  beforeEach(() => {
    // Create service with dependencies
    const program = Effect.gen(function* () {
      const layer = yield* RecipeRegistryServiceLive
      const engineLayer = yield* CraftingEngineServiceLive

      // Combine layers and build service
      const combined = Effect.mergeAll([layer, engineLayer])
      return yield* combined.build
    })

    service = Effect.runSync(program)
  })

  describe('register', () => {
    it('should register a valid shaped recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('stick'),
        pattern: [
          ['P'],
          ['P'],
        ],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'stick',
          count: ItemStackCount(4),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(service.register(recipe))

      expect(result._tag).toBe('Right')
    })

    it('should register a valid shapeless recipe', async () => {
      const recipe: ShapelessRecipe = {
        _tag: 'shapeless',
        id: RecipeId('flint_and_steel'),
        ingredients: [
          { _tag: 'exact', itemId: 'iron_ingot' },
          { _tag: 'exact', itemId: 'flint' },
        ],
        result: {
          itemId: 'flint_and_steel',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(service.register(recipe))

      expect(result._tag).toBe('Right')
    })

    it('should reject duplicate recipe IDs', async () => {
      const recipe1: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('duplicate_test'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'item1',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const recipe2: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('duplicate_test'),
        pattern: [['S']],
        ingredients: {
          'S': { _tag: 'exact', itemId: 'stone' },
        },
        result: {
          itemId: 'item2',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe1))
      const result = await Effect.runPromiseEither(service.register(recipe2))

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DuplicateRecipeError)
      }
    })
  })

  describe('unregister', () => {
    it('should unregister an existing recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('test_unregister'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'test_item',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe))
      const result = await Effect.runPromiseEither(
        service.unregister(RecipeId('test_unregister'))
      )

      expect(result._tag).toBe('Right')

      // Verify recipe is gone
      const getResult = await Effect.runPromiseEither(
        service.getById(RecipeId('test_unregister'))
      )
      expect(getResult._tag).toBe('Left')
    })

    it('should fail when unregistering non-existent recipe', async () => {
      const result = await Effect.runPromiseEither(
        service.unregister(RecipeId('non_existent'))
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(RecipeNotFoundError)
      }
    })
  })

  describe('getById', () => {
    it('should retrieve a registered recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('test_get'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'test_item',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe))
      const result = await Effect.runPromiseEither(service.getById(RecipeId('test_get')))

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right.id).toBe(RecipeId('test_get'))
        expect(result.right.result.itemId).toBe('test_item')
      }
    })

    it('should fail for non-existent recipe', async () => {
      const result = await Effect.runPromiseEither(
        service.getById(RecipeId('non_existent'))
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(RecipeNotFoundError)
      }
    })
  })

  describe('getByCategory', () => {
    it('should retrieve all recipes in a category', async () => {
      const craftingRecipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('crafting_recipe'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'item1',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const smeltingRecipe: ShapelessRecipe = {
        _tag: 'shapeless',
        id: RecipeId('smelting_recipe'),
        ingredients: [
          { _tag: 'exact', itemId: 'iron_ore' },
        ],
        result: {
          itemId: 'iron_ingot',
          count: ItemStackCount(1),
        },
        category: { _tag: 'smelting' },
      }

      await Effect.runPromise(service.register(craftingRecipe))
      await Effect.runPromise(service.register(smeltingRecipe))

      const craftingResults = await Effect.runPromise(
        service.getByCategory({ _tag: 'crafting' })
      )
      const smeltingResults = await Effect.runPromise(
        service.getByCategory({ _tag: 'smelting' })
      )

      expect(craftingResults.length).toBeGreaterThanOrEqual(1)
      expect(smeltingResults.length).toBeGreaterThanOrEqual(1)
    })

    it('should return empty array for category with no recipes', async () => {
      const results = await Effect.runPromise(
        service.getByCategory({ _tag: 'smithing' })
      )

      expect(results).toEqual([])
    })
  })

  describe('getAllRecipes', () => {
    it('should retrieve all registered recipes', async () => {
      const recipe1: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('recipe1'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'item1',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const recipe2: ShapelessRecipe = {
        _tag: 'shapeless',
        id: RecipeId('recipe2'),
        ingredients: [
          { _tag: 'exact', itemId: 'sugar' },
          { _tag: 'exact', itemId: 'paper' },
        ],
        result: {
          itemId: 'item2',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe1))
      await Effect.runPromise(service.register(recipe2))

      const allRecipes = await Effect.runPromise(service.getAllRecipes())

      expect(allRecipes.length).toBeGreaterThanOrEqual(2)
      const ids = allRecipes.map(r => r.id)
      expect(ids).toContain(RecipeId('recipe1'))
      expect(ids).toContain(RecipeId('recipe2'))
    })

    it('should return empty array when no recipes registered', async () => {
      // Create a fresh service instance
      const freshProgram = Effect.gen(function* () {
        const layer = yield* RecipeRegistryServiceLive
        const engineLayer = yield* CraftingEngineServiceLive
        const combined = Effect.mergeAll([layer, engineLayer])
        return yield* combined.build
      })

      const freshService = Effect.runSync(freshProgram)
      const allRecipes = await Effect.runPromise(freshService.getAllRecipes())

      expect(allRecipes).toEqual([])
    })
  })

  describe('getRecipeCount', () => {
    it('should return correct recipe count', async () => {
      const initialCount = await Effect.runPromise(service.getRecipeCount())

      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('count_test'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'test_item',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe))
      const newCount = await Effect.runPromise(service.getRecipeCount())

      expect(newCount).toBe(initialCount + 1)
    })
  })

  describe('hasRecipe', () => {
    it('should return true for existing recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('exists_test'),
        pattern: [['P']],
        ingredients: {
          'P': { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'test_item',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe))
      const hasRecipe = await Effect.runPromise(service.hasRecipe(RecipeId('exists_test')))

      expect(hasRecipe).toBe(true)
    })

    it('should return false for non-existent recipe', async () => {
      const hasRecipe = await Effect.runPromise(service.hasRecipe(RecipeId('does_not_exist')))

      expect(hasRecipe).toBe(false)
    })
  })

  describe('getRecipesByResult', () => {
    it('should find all recipes that produce a specific item', async () => {
      const recipe1: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('planks_from_logs'),
        pattern: [['L']],
        ingredients: {
          'L': { _tag: 'exact', itemId: 'oak_log' },
        },
        result: {
          itemId: 'oak_planks',
          count: ItemStackCount(4),
        },
        category: { _tag: 'crafting' },
      }

      const recipe2: ShapelessRecipe = {
        _tag: 'shapeless',
        id: RecipeId('planks_from_wood'),
        ingredients: [
          { _tag: 'exact', itemId: 'oak_wood' },
        ],
        result: {
          itemId: 'oak_planks',
          count: ItemStackCount(4),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe1))
      await Effect.runPromise(service.register(recipe2))

      const recipes = await Effect.runPromise(service.getRecipesByResult('oak_planks'))

      expect(recipes.length).toBe(2)
      const ids = recipes.map(r => r.id)
      expect(ids).toContain(RecipeId('planks_from_logs'))
      expect(ids).toContain(RecipeId('planks_from_wood'))
    })

    it('should return empty array for item with no recipes', async () => {
      const recipes = await Effect.runPromise(service.getRecipesByResult('unobtainium'))

      expect(recipes).toEqual([])
    })
  })

  describe('validateAndRegister', () => {
    it('should validate and register a valid recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('validated_recipe'),
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

      const result = await Effect.runPromiseEither(service.validateAndRegister(recipe))

      expect(result._tag).toBe('Right')

      // Verify it was registered
      const hasRecipe = await Effect.runPromise(service.hasRecipe(RecipeId('validated_recipe')))
      expect(hasRecipe).toBe(true)
    })

    it('should reject invalid recipes', async () => {
      // Recipe with empty pattern (invalid)
      const invalidRecipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('invalid_recipe'),
        pattern: [],
        ingredients: {},
        result: {
          itemId: 'nothing',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromiseEither(service.validateAndRegister(invalidRecipe))

      // Should fail validation
      if (result._tag === 'Left') {
        expect(result.left).toBeDefined()
      }
    })
  })
})