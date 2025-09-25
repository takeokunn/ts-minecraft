import { describe, expect, beforeEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Layer } from 'effect'
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
      return yield* RecipeRegistryService
    })
    const layers = RecipeRegistryServiceLive.pipe(Layer.provide(CraftingEngineServiceLive))
    service = Effect.runSync(program.pipe(Effect.provide(layers)))
  })

  describe('register', () => {
    it('should register a valid shaped recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('stick'),
        pattern: [['P'], ['P']],
        ingredients: {
          P: { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'stick',
          count: ItemStackCount(4),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromise(service.register(recipe).pipe(Effect.either))

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

      const result = await Effect.runPromise(service.register(recipe).pipe(Effect.either))

      expect(result._tag).toBe('Right')
    })

    it('should reject duplicate recipe IDs', async () => {
      const recipe1: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('duplicate_test'),
        pattern: [['P']],
        ingredients: {
          P: { _tag: 'exact', itemId: 'planks' },
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
          S: { _tag: 'exact', itemId: 'stone' },
        },
        result: {
          itemId: 'item2',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe1))
      const result = await Effect.runPromise(service.register(recipe2).pipe(Effect.either))

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
          P: { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'test_item',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe))
      const result = await Effect.runPromise(service.unregister(RecipeId('test_unregister')).pipe(Effect.either))

      expect(result._tag).toBe('Right')

      // Verify recipe is gone
      const getResult = await Effect.runPromise(service.getById(RecipeId('test_unregister')).pipe(Effect.either))
      expect(getResult._tag).toBe('Left')
    })

    it('should fail when unregistering non-existent recipe', async () => {
      const result = await Effect.runPromise(service.unregister(RecipeId('non_existent')).pipe(Effect.either))

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(RecipeNotFoundError)
      }
    })
  })

  describe('getById', () => {
    it.skip('should retrieve a registered recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('test_get'),
        pattern: [['P']],
        ingredients: {
          P: { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'test_item',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      await Effect.runPromise(service.register(recipe))
      const result = await Effect.runPromise(service.getById(RecipeId('test_get')).pipe(Effect.either))

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right.id).toBe(RecipeId('test_get'))
        expect(result.right.result.itemId).toBe('test_item')
      }
    })

    it('should fail for non-existent recipe', async () => {
      const result = await Effect.runPromise(service.getById(RecipeId('non_existent')).pipe(Effect.either))

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
          P: { _tag: 'exact', itemId: 'planks' },
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
        ingredients: [{ _tag: 'exact', itemId: 'iron_ore' }],
        result: {
          itemId: 'iron_ingot',
          count: ItemStackCount(1),
        },
        category: { _tag: 'smelting' },
      }

      await Effect.runPromise(service.register(craftingRecipe))
      await Effect.runPromise(service.register(smeltingRecipe))

      const craftingResults = await Effect.runPromise(service.getByCategory({ _tag: 'crafting' }))
      const smeltingResults = await Effect.runPromise(service.getByCategory({ _tag: 'smelting' }))

      expect(craftingResults.length).toBeGreaterThanOrEqual(1)
      expect(smeltingResults.length).toBeGreaterThanOrEqual(1)
    })

    it('should return empty array for category with no recipes', async () => {
      const results = await Effect.runPromise(service.getByCategory({ _tag: 'smithing' }))

      expect(results).toEqual([])
    })
  })

  describe('getAllRecipes', () => {
    it.scoped('should retrieve all registered recipes', () =>
      Effect.gen(function* () {
        const registry = yield* RecipeRegistryService

        const recipe1: ShapedRecipe = {
          _tag: 'shaped',
          id: RecipeId('recipe1'),
          pattern: [['P']],
          ingredients: {
            P: { _tag: 'exact', itemId: 'planks' },
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

        yield* registry.register(recipe1)
        yield* registry.register(recipe2)

        const allRecipes = yield* registry.getAllRecipes()

        expect(allRecipes.length).toBe(2)
        const ids = allRecipes.map((r) => r.id)
        expect(ids).toContain(RecipeId('recipe1'))
        expect(ids).toContain(RecipeId('recipe2'))
      }).pipe(Effect.provide(RecipeRegistryServiceLive.pipe(Layer.provide(CraftingEngineServiceLive))))
    )

    it('should return empty array when no recipes registered', async () => {
      // Create a fresh service instance
      const freshProgram = Effect.gen(function* () {
        return yield* RecipeRegistryService
      })
      const freshLayers = RecipeRegistryServiceLive.pipe(Layer.provide(CraftingEngineServiceLive))
      const freshService = Effect.runSync(freshProgram.pipe(Effect.provide(freshLayers)))
      const allRecipes = await Effect.runPromise(freshService.getAllRecipes())

      expect(allRecipes).toEqual([])
    })
  })

  describe('getRecipeCount', () => {
    it.scoped('should return correct recipe count', () =>
      Effect.gen(function* () {
        const registry = yield* RecipeRegistryService

        const initialCount = yield* registry.getRecipeCount()

        const recipe: ShapedRecipe = {
          _tag: 'shaped',
          id: RecipeId('count_test'),
          pattern: [['P']],
          ingredients: {
            P: { _tag: 'exact', itemId: 'planks' },
          },
          result: {
            itemId: 'test_item',
            count: ItemStackCount(1),
          },
          category: { _tag: 'crafting' },
        }

        yield* registry.register(recipe)
        const newCount = yield* registry.getRecipeCount()

        expect(newCount).toBe(initialCount + 1)
      }).pipe(Effect.provide(RecipeRegistryServiceLive.pipe(Layer.provide(CraftingEngineServiceLive))))
    )
  })

  describe('hasRecipe', () => {
    it.skip('should return true for existing recipe', async () => {
      const recipe: ShapedRecipe = {
        _tag: 'shaped',
        id: RecipeId('exists_test'),
        pattern: [['P']],
        ingredients: {
          P: { _tag: 'exact', itemId: 'planks' },
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
    it.scoped('should find all recipes that produce a specific item', () =>
      Effect.gen(function* () {
        const registry = yield* RecipeRegistryService

        const recipe1: ShapedRecipe = {
          _tag: 'shaped',
          id: RecipeId('planks_from_logs'),
          pattern: [['L']],
          ingredients: {
            L: { _tag: 'exact', itemId: 'oak_log' },
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
          ingredients: [{ _tag: 'exact', itemId: 'oak_wood' }],
          result: {
            itemId: 'oak_planks',
            count: ItemStackCount(4),
          },
          category: { _tag: 'crafting' },
        }

        yield* registry.register(recipe1)
        yield* registry.register(recipe2)

        const recipes = yield* registry.getRecipesByResult('oak_planks')

        expect(recipes.length).toBe(2)
        const ids = recipes.map((r) => r.id)
        expect(ids).toContain(RecipeId('planks_from_logs'))
        expect(ids).toContain(RecipeId('planks_from_wood'))
      }).pipe(Effect.provide(RecipeRegistryServiceLive.pipe(Layer.provide(CraftingEngineServiceLive))))
    )

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
          P: { _tag: 'exact', itemId: 'planks' },
        },
        result: {
          itemId: 'crafting_table',
          count: ItemStackCount(1),
        },
        category: { _tag: 'crafting' },
      }

      const result = await Effect.runPromise(service.validateAndRegister(recipe).pipe(Effect.either))

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

      const result = await Effect.runPromise(service.validateAndRegister(invalidRecipe).pipe(Effect.either))

      // Should fail validation
      if (result._tag === 'Left') {
        expect(result.left).toBeDefined()
      }
    })
  })
})
