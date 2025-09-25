import { Context, Effect, Match, Option, Array, pipe, HashMap, Layer, SynchronizedRef } from 'effect'
import {
  CraftingRecipe,
  RecipeId,
  RecipeCategory,
  DuplicateRecipeError,
  InvalidRecipeError,
  RecipeNotFoundError,
  RecipeIdSchema,
} from './RecipeTypes'
import { CraftingEngineService } from './CraftingEngineService'

/**
 * Recipe Registry Service
 *
 * レシピの登録・検索・管理を行う中央レジストリ
 */

// ===== Service Interface =====

export interface RecipeRegistryService {
  readonly register: (recipe: CraftingRecipe) => Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError>

  readonly unregister: (recipeId: RecipeId) => Effect.Effect<void, RecipeNotFoundError>

  readonly getById: (recipeId: RecipeId) => Effect.Effect<CraftingRecipe, RecipeNotFoundError>

  readonly getByCategory: (category: RecipeCategory) => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>

  readonly getAllRecipes: () => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>

  readonly getRecipeCount: () => Effect.Effect<number, never>

  readonly hasRecipe: (recipeId: RecipeId) => Effect.Effect<boolean, never>

  readonly validateAndRegister: (
    recipe: CraftingRecipe
  ) => Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError>

  readonly getRecipesByResult: (itemId: string) => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>
}

export const RecipeRegistryService = Context.GenericTag<RecipeRegistryService>('@minecraft/RecipeRegistryService')

// ===== Registry State =====

interface RegistryState {
  readonly recipes: HashMap.HashMap<RecipeId, CraftingRecipe>
  readonly byCategory: HashMap.HashMap<string, ReadonlyArray<CraftingRecipe>>
  readonly byResult: HashMap.HashMap<string, ReadonlyArray<CraftingRecipe>>
}

const createEmptyState = (): RegistryState => ({
  recipes: HashMap.empty(),
  byCategory: HashMap.empty(),
  byResult: HashMap.empty(),
})

// ===== Service Implementation =====

export const RecipeRegistryServiceLive = Layer.effect(
  RecipeRegistryService,
  Effect.gen(function* () {
    const state = yield* SynchronizedRef.make(createEmptyState())
    const craftingEngine = yield* CraftingEngineService

    const validateRecipe = (recipe: CraftingRecipe): Effect.Effect<void, InvalidRecipeError> =>
      pipe(
        recipe,
        Match.value,
        Match.tag('shaped', ({ pattern, ingredients }) => {
          const patternKeys = new Set(pattern.flat().filter((key): key is string => key !== undefined))
          const ingredientKeys = new Set(Object.keys(ingredients))

          return patternKeys.size === ingredientKeys.size && [...patternKeys].every((key) => ingredientKeys.has(key))
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

    const updateIndexes = (
      currentState: RegistryState,
      recipe: CraftingRecipe,
      operation: 'add' | 'remove'
    ): RegistryState => {
      const categoryKey = recipe.category._tag
      const resultItemId = recipe.result.itemId

      return pipe(
        operation,
        Match.value,
        Match.when('add', () => {
          // カテゴリインデックス更新
          const existingCategory = HashMap.get(currentState.byCategory, categoryKey)
          const newCategoryRecipes = pipe(
            existingCategory,
            Option.match({
              onNone: () => [recipe],
              onSome: (existing) => [...existing, recipe],
            })
          )

          // 結果アイテムインデックス更新
          const existingResult = HashMap.get(currentState.byResult, resultItemId)
          const newResultRecipes = pipe(
            existingResult,
            Option.match({
              onNone: () => [recipe],
              onSome: (existing) => [...existing, recipe],
            })
          )

          return {
            ...currentState,
            byCategory: HashMap.set(currentState.byCategory, categoryKey, newCategoryRecipes),
            byResult: HashMap.set(currentState.byResult, resultItemId, newResultRecipes),
          }
        }),
        Match.when('remove', () => {
          // カテゴリインデックスから削除
          const existingCategory = HashMap.get(currentState.byCategory, categoryKey)
          const newCategoryRecipes = pipe(
            existingCategory,
            Option.match({
              onNone: () => [],
              onSome: (existing) => existing.filter((r) => r.id !== recipe.id),
            })
          )

          // 結果アイテムインデックスから削除
          const existingResult = HashMap.get(currentState.byResult, resultItemId)
          const newResultRecipes = pipe(
            existingResult,
            Option.match({
              onNone: () => [],
              onSome: (existing) => existing.filter((r) => r.id !== recipe.id),
            })
          )

          return {
            ...currentState,
            byCategory: HashMap.set(currentState.byCategory, categoryKey, newCategoryRecipes),
            byResult: HashMap.set(currentState.byResult, resultItemId, newResultRecipes),
          }
        }),
        Match.exhaustive
      )
    }

    const register = (recipe: CraftingRecipe): Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError> =>
      Effect.gen(function* () {
        // バリデーション
        yield* validateRecipe(recipe)

        // 重複チェックと登録
        yield* SynchronizedRef.updateEffect(state, (currentState) =>
          Effect.gen(function* () {
            // 重複チェック
            const existingRecipe = HashMap.get(currentState.recipes, recipe.id)
            if (Option.isSome(existingRecipe)) {
              return yield* Effect.fail(
                new DuplicateRecipeError({
                  recipeId: recipe.id,
                })
              )
            }

            // 登録実行
            const newRecipes = HashMap.set(currentState.recipes, recipe.id, recipe)
            const updatedState = updateIndexes({ ...currentState, recipes: newRecipes }, recipe, 'add')

            yield* Effect.log(`Recipe registered: ${recipe.id}`)
            return updatedState
          })
        )
      })

    const unregister = (recipeId: RecipeId): Effect.Effect<void, RecipeNotFoundError> =>
      Effect.gen(function* () {
        yield* SynchronizedRef.updateEffect(state, (currentState) =>
          Effect.gen(function* () {
            const existingRecipe = HashMap.get(currentState.recipes, recipeId)

            if (Option.isNone(existingRecipe)) {
              return yield* Effect.fail(
                new RecipeNotFoundError({
                  recipeId,
                })
              )
            }

            const recipe = existingRecipe.value
            const newRecipes = HashMap.remove(currentState.recipes, recipeId)
            const updatedState = updateIndexes({ ...currentState, recipes: newRecipes }, recipe, 'remove')

            yield* Effect.log(`Recipe unregistered: ${recipeId}`)
            return updatedState
          })
        )
      })

    const getById = (recipeId: RecipeId): Effect.Effect<CraftingRecipe, RecipeNotFoundError> =>
      Effect.gen(function* () {
        const currentState = yield* SynchronizedRef.get(state)
        const recipe = HashMap.get(currentState.recipes, recipeId)

        return yield* pipe(
          recipe,
          Option.match({
            onNone: () => Effect.fail(new RecipeNotFoundError({ recipeId })),
            onSome: Effect.succeed,
          })
        )
      })

    const getByCategory = (category: RecipeCategory): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
      Effect.gen(function* () {
        const currentState = yield* SynchronizedRef.get(state)
        const recipes = HashMap.get(currentState.byCategory, category._tag)

        return pipe(
          recipes,
          Option.getOrElse(() => [] as ReadonlyArray<CraftingRecipe>)
        )
      })

    const getAllRecipes = (): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
      Effect.gen(function* () {
        const currentState = yield* SynchronizedRef.get(state)
        return [...HashMap.values(currentState.recipes)]
      })

    const getRecipeCount = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* SynchronizedRef.get(state)
        return HashMap.size(currentState.recipes)
      })

    const hasRecipe = (recipeId: RecipeId): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const currentState = yield* SynchronizedRef.get(state)
        const recipe = HashMap.get(currentState.recipes, recipeId)
        return Option.isSome(recipe)
      })

    const validateAndRegister = (
      recipe: CraftingRecipe
    ): Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError> =>
      Effect.gen(function* () {
        yield* Effect.log(`Validating and registering recipe: ${recipe.id}`)
        yield* register(recipe)
      })

    const getRecipesByResult = (itemId: string): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
      Effect.gen(function* () {
        const currentState = yield* SynchronizedRef.get(state)
        const recipes = HashMap.get(currentState.byResult, itemId)

        return pipe(
          recipes,
          Option.getOrElse(() => [] as ReadonlyArray<CraftingRecipe>)
        )
      })

    return RecipeRegistryService.of({
      register,
      unregister,
      getById,
      getByCategory,
      getAllRecipes,
      getRecipeCount,
      hasRecipe,
      validateAndRegister,
      getRecipesByResult,
    })
  })
)
