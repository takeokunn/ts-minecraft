import { describe, it, expect } from 'vitest'
import { Array as Arr, Either, Option, Schema } from 'effect'
import { RecipeId } from '@ts-minecraft/kernel'
import { CraftingStationSchema, RecipeIngredient, Recipe } from '../domain/crafting'

describe('domain/crafting', () => {
  describe('CraftingStationSchema', () => {
    const decode = Schema.decodeUnknownEither(CraftingStationSchema)

    it('accepts "inventory"', () => {
      const result = decode('inventory')
      expect(Either.isRight(result)).toBe(true)
      expect(Either.getOrThrow(result)).toBe('inventory')
    })

    it('accepts "crafting_table"', () => {
      const result = decode('crafting_table')
      expect(Either.isRight(result)).toBe(true)
      expect(Either.getOrThrow(result)).toBe('crafting_table')
    })

    it('accepts "furnace"', () => {
      const result = decode('furnace')
      expect(Either.isRight(result)).toBe(true)
      expect(Either.getOrThrow(result)).toBe('furnace')
    })

    it('rejects an unknown station value', () => {
      const result = decode('anvil')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects a non-string value', () => {
      const result = decode(42)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('RecipeIngredient', () => {
    it('constructs a valid ingredient', () => {
      const ingredient = new RecipeIngredient({ itemType: 'WOOD', count: 2 })
      expect(ingredient.itemType).toBe('WOOD')
      expect(ingredient.count).toBe(2)
    })

    it('constructs an ingredient with count 1', () => {
      const ingredient = new RecipeIngredient({ itemType: 'STONE', count: 1 })
      expect(ingredient.count).toBe(1)
    })

    it('constructs an ingredient with count 64', () => {
      const ingredient = new RecipeIngredient({ itemType: 'DIRT', count: 64 })
      expect(ingredient.count).toBe(64)
    })

    it('rejects an invalid blockType via Schema.decodeUnknownEither', () => {
      const decode = Schema.decodeUnknownEither(RecipeIngredient)
      const result = decode({ itemType: 'INVALID_BLOCK', count: 1 })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects a count below 1 via Schema.decodeUnknownEither', () => {
      const decode = Schema.decodeUnknownEither(RecipeIngredient)
      const result = decode({ itemType: 'STONE', count: 0 })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects a count above 64 via Schema.decodeUnknownEither', () => {
      const decode = Schema.decodeUnknownEither(RecipeIngredient)
      const result = decode({ itemType: 'STONE', count: 65 })
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('Recipe', () => {
    const validRecipeData = {
      id: RecipeId.make('wood-to-planks'),
      station: 'inventory' as const,
      ingredients: [new RecipeIngredient({ itemType: 'WOOD', count: 1 })],
      output: { itemType: 'PLANKS' as const, count: 4 },
    }

    it('constructs a valid Recipe', () => {
      const recipe = new Recipe(validRecipeData)
      expect(recipe.id).toBe('wood-to-planks')
      expect(recipe.station).toBe('inventory')
      expect(recipe.ingredients.length).toBe(1)
      expect(Option.getOrThrow(Arr.get(recipe.ingredients, 0)).itemType).toBe('WOOD')
      expect(recipe.output.itemType).toBe('PLANKS')
      expect(recipe.output.count).toBe(4)
    })

    it('constructs a crafting_table recipe with multiple ingredients', () => {
      const recipe = new Recipe({
        id: RecipeId.make('planks-and-sticks-to-wooden-sword'),
        station: 'crafting_table',
        ingredients: [
          new RecipeIngredient({ itemType: 'PLANKS', count: 2 }),
          new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
        ],
        output: { itemType: 'WOODEN_SWORD', count: 1 },
      })
      expect(recipe.station).toBe('crafting_table')
      expect(recipe.ingredients.length).toBe(2)
    })

    it('constructs a furnace recipe', () => {
      const recipe = new Recipe({
        id: RecipeId.make('raw-iron-to-iron-ingot'),
        station: 'furnace',
        ingredients: [new RecipeIngredient({ itemType: 'IRON_ORE', count: 1 })],
        output: { itemType: 'IRON_INGOT', count: 1 },
      })
      expect(recipe.station).toBe('furnace')
    })

    it('rejects a recipe with no ingredients via Schema.decodeUnknownEither', () => {
      const decode = Schema.decodeUnknownEither(Recipe)
      const result = decode({
        id: 'empty-recipe',
        station: 'inventory',
        ingredients: [],
        output: { itemType: 'DIRT', count: 1 },
      })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects a recipe with an invalid station via Schema.decodeUnknownEither', () => {
      const decode = Schema.decodeUnknownEither(Recipe)
      const result = decode({
        id: 'bad-station',
        station: 'anvil',
        ingredients: [{ itemType: 'STONE', count: 1 }],
        output: { itemType: 'DIRT', count: 1 },
      })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects a recipe with an invalid output blockType via Schema.decodeUnknownEither', () => {
      const decode = Schema.decodeUnknownEither(Recipe)
      const result = decode({
        id: 'bad-output',
        station: 'inventory',
        ingredients: [{ itemType: 'STONE', count: 1 }],
        output: { itemType: 'NOT_A_BLOCK', count: 1 },
      })
      expect(Either.isLeft(result)).toBe(true)
    })
  })
})
