import { Effect, Layer, Match, pipe } from 'effect'
import {
  CraftingRecipe,
  DuplicateRecipeError,
  InvalidRecipeError,
  RecipeCategory,
  RecipeId,
  RecipeNotFoundError,
} from '../types'
import { RecipeRegistryService } from './service'

export const RecipeRegistryServiceLive = Layer.effect(
  RecipeRegistryService,
  Effect.gen(function* () {
    // In-memory registry for testing
    const registryMap = new Map<RecipeId, CraftingRecipe>()

    return {
      register: (recipe: CraftingRecipe): Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError> =>
        Effect.gen(function* () {
          // バリデーション
          yield* pipe(
            recipe,
            Match.value,
            Match.tag('shaped', ({ pattern, ingredients }) => {
              const patternKeys = new Set(pattern.flat().filter((key): key is string => key !== undefined))
              const ingredientKeys = new Set(Object.keys(ingredients))

              return patternKeys.size === ingredientKeys.size &&
                [...patternKeys].every((key) => ingredientKeys.has(key))
                ? Effect.void
                : Effect.fail(
                    new InvalidRecipeError({
                      recipeId: recipe.id,
                      reason: "Pattern keys don't match ingredients",
                    })
                  )
            }),
            Match.tag('shapeless', ({ ingredients }) =>
              ingredients.length > 0
                ? Effect.void
                : Effect.fail(
                    new InvalidRecipeError({
                      recipeId: recipe.id,
                      reason: 'Shapeless recipe must have ingredients',
                    })
                  )
            ),
            Match.exhaustive
          )

          // 重複チェック
          if (registryMap.has(recipe.id)) {
            return yield* Effect.fail(new DuplicateRecipeError({ recipeId: recipe.id }))
          }

          // 登録
          registryMap.set(recipe.id, recipe)
          yield* Effect.log(`Recipe registered: ${recipe.id}`)
        }),

      unregister: (recipeId: RecipeId): Effect.Effect<void, RecipeNotFoundError> =>
        Effect.gen(function* () {
          if (!registryMap.has(recipeId)) {
            return yield* Effect.fail(new RecipeNotFoundError({ recipeId }))
          }
          registryMap.delete(recipeId)
          yield* Effect.log(`Recipe unregistered: ${recipeId}`)
        }),

      getById: (recipeId: RecipeId): Effect.Effect<CraftingRecipe, RecipeNotFoundError> =>
        Effect.gen(function* () {
          const recipe = registryMap.get(recipeId)
          if (!recipe) {
            return yield* Effect.fail(new RecipeNotFoundError({ recipeId }))
          }
          return recipe
        }),

      getByCategory: (category: RecipeCategory): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
        Effect.sync(() => {
          const recipes = Array.from(registryMap.values()).filter((recipe) => recipe.category._tag === category._tag)
          return recipes as ReadonlyArray<CraftingRecipe>
        }),

      getAllRecipes: (): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
        Effect.sync(() => {
          return Array.from(registryMap.values()) as ReadonlyArray<CraftingRecipe>
        }),

      getRecipeCount: (): Effect.Effect<number, never> => Effect.sync(() => registryMap.size),

      hasRecipe: (recipeId: RecipeId): Effect.Effect<boolean, never> => Effect.sync(() => registryMap.has(recipeId)),

      validateAndRegister: (recipe: CraftingRecipe): Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError> =>
        Effect.gen(function* () {
          yield* Effect.log(`Validating and registering recipe: ${recipe.id}`)
          // バリデーションと登録を実行
          yield* pipe(
            recipe,
            Match.value,
            Match.tag('shaped', ({ pattern, ingredients }) => {
              const patternKeys = new Set(pattern.flat().filter((key): key is string => key !== undefined))
              const ingredientKeys = new Set(Object.keys(ingredients))

              return patternKeys.size === ingredientKeys.size &&
                [...patternKeys].every((key) => ingredientKeys.has(key))
                ? Effect.void
                : Effect.fail(
                    new InvalidRecipeError({
                      recipeId: recipe.id,
                      reason: "Pattern keys don't match ingredients",
                    })
                  )
            }),
            Match.tag('shapeless', ({ ingredients }) =>
              ingredients.length > 0
                ? Effect.void
                : Effect.fail(
                    new InvalidRecipeError({
                      recipeId: recipe.id,
                      reason: 'Shapeless recipe must have ingredients',
                    })
                  )
            ),
            Match.exhaustive
          )

          if (registryMap.has(recipe.id)) {
            return yield* Effect.fail(new DuplicateRecipeError({ recipeId: recipe.id }))
          }

          registryMap.set(recipe.id, recipe)
        }),

      getRecipesByResult: (itemId: string): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
        Effect.sync(() => {
          const recipes = Array.from(registryMap.values()).filter((recipe) => recipe.result.itemId === itemId)
          return recipes as ReadonlyArray<CraftingRecipe>
        }),
    }
  })
)
