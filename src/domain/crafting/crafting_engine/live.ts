import { Effect, Layer, Option, pipe } from 'effect'
import { CraftingEngineService } from './service'
import {
  CraftingGrid,
  CraftingItemStack,
  CraftingRecipe,
  CraftingResult,
  PatternMismatchError,
  ShapedRecipe,
  ShapelessRecipe,
  isShapedRecipe,
  isShapelessRecipe,
} from '../types'
import {
  normalizeGrid,
  normalizePattern,
  checkPatternMatchSync,
  extractItemsFromGrid,
  checkShapelessMatch,
  gridToString,
  recipeToString,
  consumeShapedIngredients,
  consumeShapelessIngredients
} from './helper'

export const CraftingEngineServiceLive = Layer.effect(
  CraftingEngineService,
  Effect.gen(function* () {
    const recipeRegistry = new Map<string, CraftingRecipe>()

    // Pattern matching for shaped recipes
    const matchesShapedRecipe = (grid: CraftingGrid, recipe: ShapedRecipe): Effect.Effect<boolean, never> =>
      Effect.sync(() => {
        const normalizedGrid = normalizeGrid(grid)
        const normalizedPattern = normalizePattern(recipe.pattern)

        // サイズチェック
        if (normalizedGrid.width !== normalizedPattern.width || normalizedGrid.height !== normalizedPattern.height) {
          return false
        }

        // パターンマッチング（簡略化）
        return checkPatternMatchSync(normalizedGrid, normalizedPattern, recipe.ingredients)
      })

    // Pattern matching for shapeless recipes
    const matchesShapelessRecipe = (grid: CraftingGrid, recipe: ShapelessRecipe): Effect.Effect<boolean, never> =>
      Effect.sync(() => {
        const items = extractItemsFromGrid(grid)
        return checkShapelessMatch(items, [...recipe.ingredients])
      })

    const validateRecipeMatch = (
      grid: CraftingGrid,
      recipe: CraftingRecipe
    ): Effect.Effect<boolean, PatternMismatchError> =>
      pipe(
        Effect.succeed(recipe),
        Effect.flatMap((r) =>
          isShapedRecipe(r)
            ? matchesShapedRecipe(grid, r)
            : isShapelessRecipe(r)
              ? matchesShapelessRecipe(grid, r)
              : Effect.fail(new Error('Unknown recipe type'))
        ),
        Effect.mapError(
          () =>
            new PatternMismatchError({
              recipeId: recipe.id,
              gridPattern: gridToString(grid),
              expectedPattern: recipeToString(recipe),
            })
        )
      )

    const matchRecipe = (grid: CraftingGrid): Effect.Effect<Option.Option<CraftingRecipe>, never> =>
      Effect.sync(() => {
        const recipes = [...recipeRegistry.values()]

        for (const recipe of recipes) {
          const matches = isShapedRecipe(recipe)
            ? Effect.runSync(matchesShapedRecipe(grid, recipe))
            : isShapelessRecipe(recipe)
              ? Effect.runSync(matchesShapelessRecipe(grid, recipe))
              : false

          if (matches) {
            return Option.some(recipe)
          }
        }

        return Option.none()
      })

    const executeCrafting = (
      grid: CraftingGrid,
      recipe: CraftingRecipe
    ): Effect.Effect<CraftingResult, PatternMismatchError> => {
      const matches = isShapedRecipe(recipe)
        ? Effect.runSync(matchesShapedRecipe(grid, recipe))
        : isShapelessRecipe(recipe)
          ? Effect.runSync(matchesShapelessRecipe(grid, recipe))
          : false

      if (!matches) {
        return Effect.fail(
          new PatternMismatchError({
            recipeId: recipe.id,
            gridPattern: gridToString(grid),
            expectedPattern: recipeToString(recipe),
          })
        )
      }

      const { consumedItems, remainingGrid } = isShapedRecipe(recipe)
        ? Effect.runSync(consumeShapedIngredients(grid, recipe))
        : isShapelessRecipe(recipe)
          ? Effect.runSync(consumeShapelessIngredients(grid, recipe))
          : { consumedItems: [] as ReadonlyArray<CraftingItemStack>, remainingGrid: grid }

      const result: CraftingResult = {
        _tag: 'CraftingResult',
        success: true,
        result: recipe.result,
        consumedItems,
        remainingGrid,
        usedRecipe: recipe,
      }

      return Effect.succeed(result)
    }

    const findMatchingRecipes = (grid: CraftingGrid): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
      Effect.sync(() => {
        const recipes = [...recipeRegistry.values()]
        const matchingRecipes: CraftingRecipe[] = []

        for (const recipe of recipes) {
          const matches = isShapedRecipe(recipe)
            ? Effect.runSync(matchesShapedRecipe(grid, recipe))
            : isShapelessRecipe(recipe)
              ? Effect.runSync(matchesShapelessRecipe(grid, recipe))
              : false

          if (matches) {
            matchingRecipes.push(recipe)
          }
        }

        return matchingRecipes as ReadonlyArray<CraftingRecipe>
      })

    return CraftingEngineService.of({
      matchRecipe,
      validateRecipeMatch,
      executeCrafting,
      findMatchingRecipes,
    })
  })
)
