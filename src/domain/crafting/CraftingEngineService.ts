import { Context, Effect, Match, Option, Array, pipe, Layer } from 'effect'
import {
  CraftingRecipe,
  ShapedRecipe,
  ShapelessRecipe,
  CraftingGrid,
  CraftingResult,
  CraftingItemStack,
  RecipeNotFoundError,
  PatternMismatchError,
  ItemMatcher,
  ExactItemMatcher,
  TagItemMatcher,
  CustomItemMatcher,
  RecipePattern,
  GridWidth,
  GridHeight,
  ItemStackCount,
  isShapedRecipe,
  isShapelessRecipe,
  isExactItemMatcher,
  isTagItemMatcher,
  isCustomItemMatcher,
} from './RecipeTypes'

/**
 * Crafting Engine Service
 *
 * レシピマッチングとクラフティング実行の中核サービス
 */

// ===== Service Interface =====

export interface CraftingEngineService {
  readonly matchRecipe: (grid: CraftingGrid) => Effect.Effect<Option.Option<CraftingRecipe>, never>

  readonly validateRecipeMatch: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ) => Effect.Effect<boolean, PatternMismatchError>

  readonly executeCrafting: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ) => Effect.Effect<CraftingResult, PatternMismatchError>

  readonly findMatchingRecipes: (
    grid: CraftingGrid
  ) => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>
}

export const CraftingEngineService = Context.GenericTag<CraftingEngineService>(
  '@minecraft/CraftingEngineService'
)

// ===== Service Implementation =====

export const CraftingEngineServiceLive = Layer.effect(
  CraftingEngineService,
  Effect.gen(function* () {
    const recipeRegistry = new Map<string, CraftingRecipe>()

    // Pattern matching for shaped recipes
    const matchesShapedRecipe = (
      grid: CraftingGrid,
      recipe: ShapedRecipe
    ): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const normalizedGrid = normalizeGrid(grid)
        const normalizedPattern = normalizePattern(recipe.pattern)

        // サイズチェック
        if (normalizedGrid.width !== normalizedPattern.width ||
            normalizedGrid.height !== normalizedPattern.height) {
          return false
        }

        // パターンマッチング（回転・反転考慮）
        const transforms = [
          identity,
          rotate90,
          rotate180,
          rotate270,
          flipHorizontal,
          flipVertical,
        ]

        const matchFound = yield* pipe(
          transforms,
          Array.findFirst((transform) =>
            Effect.gen(function* () {
              const transformedPattern = transform(normalizedPattern)
              return yield* checkPatternMatch(normalizedGrid, transformedPattern, recipe.ingredients)
            })
          ),
          Effect.map(Option.isSome)
        )

        return matchFound
      })

    // Pattern matching for shapeless recipes
    const matchesShapelessRecipe = (
      grid: CraftingGrid,
      recipe: ShapelessRecipe
    ): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const items = extractItemsFromGrid(grid)
        return checkShapelessMatch(items, recipe.ingredients)
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
        Effect.mapError(() =>
          new PatternMismatchError({
            recipeId: recipe.id,
            gridPattern: gridToString(grid),
            expectedPattern: recipeToString(recipe),
          })
        )
      )

    const matchRecipe = (grid: CraftingGrid): Effect.Effect<Option.Option<CraftingRecipe>, never> =>
      Effect.gen(function* () {
        const recipes = [...recipeRegistry.values()]

        for (const recipe of recipes) {
          const matches = yield* validateRecipeMatch(grid, recipe).pipe(
            Effect.option
          )

          if (Option.isSome(matches) && matches.value) {
            return Option.some(recipe)
          }
        }

        return Option.none()
      })

    const executeCrafting = (
      grid: CraftingGrid,
      recipe: CraftingRecipe
    ): Effect.Effect<CraftingResult, PatternMismatchError> =>
      Effect.gen(function* () {
        const isValid = yield* validateRecipeMatch(grid, recipe)

        if (!isValid) {
          return {
            _tag: 'CraftingResult',
            success: false,
            result: undefined,
            consumedItems: [],
            remainingGrid: grid,
            usedRecipe: undefined,
          }
        }

        const { consumedItems, remainingGrid } = yield* (
          isShapedRecipe(recipe)
            ? consumeShapedIngredients(grid, recipe)
            : isShapelessRecipe(recipe)
            ? consumeShapelessIngredients(grid, recipe)
            : Effect.fail(new Error('Unknown recipe type'))
        )

        return {
          _tag: 'CraftingResult',
          success: true,
          result: recipe.result,
          consumedItems,
          remainingGrid,
          usedRecipe: recipe,
        }
      })

    const findMatchingRecipes = (
      grid: CraftingGrid
    ): Effect.Effect<ReadonlyArray<CraftingRecipe>, never> =>
      Effect.gen(function* () {
        const recipes = [...recipeRegistry.values()]
        const matchingRecipes: CraftingRecipe[] = []

        for (const recipe of recipes) {
          const matches = yield* validateRecipeMatch(grid, recipe).pipe(
            Effect.option
          )

          if (Option.isSome(matches) && matches.value) {
            matchingRecipes.push(recipe)
          }
        }

        return matchingRecipes
      })

    return CraftingEngineService.of({
      matchRecipe,
      validateRecipeMatch,
      executeCrafting,
      findMatchingRecipes,
    })
  })
)

// ===== Helper Functions =====

const normalizeGrid = (grid: CraftingGrid): { width: number; height: number; slots: (CraftingItemStack | undefined)[][] } => {
  const bounds = findContentBounds(grid)
  if (!bounds) {
    return { width: 0, height: 0, slots: [] }
  }

  const { minX, minY, maxX, maxY } = bounds
  const width = maxX - minX + 1
  const height = maxY - minY + 1

  const slots = globalThis.Array.from({ length: height }, (_, y) =>
    globalThis.Array.from({ length: width }, (_, x) =>
      grid.slots[minY + y]?.[minX + x]
    )
  )

  return { width, height, slots }
}

const normalizePattern = (pattern: RecipePattern): { width: number; height: number; slots: (string | undefined)[][] } => {
  const nonEmptyRows = pattern.filter(row => row.some(cell => cell !== undefined))
  if (nonEmptyRows.length === 0) {
    return { width: 0, height: 0, slots: [] }
  }

  const height = nonEmptyRows.length
  const width = Math.max(...nonEmptyRows.map(row => row.length))

  const slots = nonEmptyRows.map(row =>
    globalThis.Array.from({ length: width }, (_, i) => row[i])
  )

  return { width, height, slots }
}

const findContentBounds = (grid: CraftingGrid) => {
  let minX = grid.width
  let minY = grid.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.slots[y]?.[x]) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  return maxX === -1 ? null : { minX, minY, maxX, maxY }
}

const extractItemsFromGrid = (grid: CraftingGrid): CraftingItemStack[] => {
  const items: CraftingItemStack[] = []

  for (const row of grid.slots) {
    for (const slot of row) {
      if (slot) {
        items.push(slot)
      }
    }
  }

  return items
}

const checkPatternMatch = (
  grid: { slots: (CraftingItemStack | undefined)[][] },
  pattern: { slots: (string | undefined)[][] },
  ingredients: Record<string, ItemMatcher>
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    for (let y = 0; y < pattern.slots.length; y++) {
      for (let x = 0; x < pattern.slots[y].length; x++) {
        const gridItem = grid.slots[y]?.[x]
        const patternKey = pattern.slots[y]?.[x]

        const matches = yield* matchesIngredient(gridItem, patternKey, ingredients)
        if (!matches) {
          return false
        }
      }
    }

    return true
  })

const matchesIngredient = (
  item: CraftingItemStack | undefined,
  patternKey: string | undefined,
  ingredients: Record<string, ItemMatcher>
): Effect.Effect<boolean, never> => {
  if (!patternKey) {
    return Effect.succeed(item === undefined)
  }

  if (!item) {
    return Effect.succeed(false)
  }

  const matcher = ingredients[patternKey]
  if (!matcher) {
    return Effect.succeed(false)
  }

  return isExactItemMatcher(matcher)
    ? Effect.succeed(item.itemId === matcher.itemId)
    : isTagItemMatcher(matcher)
    ? checkItemTag(item, matcher.tag)
    : isCustomItemMatcher(matcher)
    ? Effect.try({
        try: () => matcher.predicate(item),
        catch: () => false,
      })
    : Effect.fail(new Error('Unknown matcher type'))
}

const checkItemTag = (item: CraftingItemStack, tag: string): Effect.Effect<boolean, never> => {
  // タグマッチングロジック（簡略化）
  const itemTags = getItemTags(item.itemId)
  return Effect.succeed(itemTags.includes(tag))
}

const getItemTags = (itemId: string): string[] => {
  const tagMap: Record<string, string[]> = {
    'minecraft:oak_planks': ['minecraft:planks', 'minecraft:wooden_items'],
    'minecraft:birch_planks': ['minecraft:planks', 'minecraft:wooden_items'],
    'minecraft:oak_log': ['minecraft:logs', 'minecraft:wooden_items'],
  }

  return tagMap[itemId] ?? []
}

const checkShapelessMatch = (
  items: CraftingItemStack[],
  requiredIngredients: ItemMatcher[]
): boolean => {
  const providedItems = [...items]

  return requiredIngredients.every(requiredIngredient => {
    const foundIndex = providedItems.findIndex(item =>
      item.count > 0 && matchesIngredientSync(item, requiredIngredient)
    )

    if (foundIndex === -1) {
      return false
    }

    const item = providedItems[foundIndex]
    providedItems[foundIndex] = {
      ...item,
      count: item.count - 1,
    }

    return true
  })
}

const matchesIngredientSync = (item: CraftingItemStack, matcher: ItemMatcher): boolean => {
  return isExactItemMatcher(matcher)
    ? item.itemId === matcher.itemId
    : isTagItemMatcher(matcher)
    ? getItemTags(item.itemId).includes(matcher.tag)
    : isCustomItemMatcher(matcher)
    ? (() => {
        try {
          return matcher.predicate(item)
        } catch {
          return false
        }
      })()
    : false
}

const consumeShapedIngredients = (
  grid: CraftingGrid,
  recipe: ShapedRecipe
): Effect.Effect<{ consumedItems: CraftingItemStack[]; remainingGrid: CraftingGrid }, never> =>
  Effect.gen(function* () {
    const consumedItems: CraftingItemStack[] = []
    const newSlots = grid.slots.map(row => [...row])

    for (let y = 0; y < recipe.pattern.length; y++) {
      for (let x = 0; x < recipe.pattern[y].length; x++) {
        const patternKey = recipe.pattern[y]?.[x]
        if (patternKey && newSlots[y]?.[x]) {
          const item = newSlots[y][x]!
          consumedItems.push({ ...item, count: 1 })

          const newCount = item.count - 1
          newSlots[y][x] = newCount > 0 ? { ...item, count: newCount } : undefined
        }
      }
    }

    return {
      consumedItems,
      remainingGrid: { ...grid, slots: newSlots },
    }
  })

const consumeShapelessIngredients = (
  grid: CraftingGrid,
  recipe: ShapelessRecipe
): Effect.Effect<{ consumedItems: CraftingItemStack[]; remainingGrid: CraftingGrid }, never> =>
  Effect.gen(function* () {
    const consumedItems: CraftingItemStack[] = []
    const newSlots = grid.slots.map(row => [...row])
    const flatSlots = newSlots.flat()

    for (const requiredIngredient of recipe.ingredients) {
      const slotIndex = flatSlots.findIndex(slot =>
        slot && slot.count > 0 && matchesIngredientSync(slot, requiredIngredient)
      )

      if (slotIndex !== -1) {
        const slot = flatSlots[slotIndex]!
        consumedItems.push({ ...slot, count: 1 })

        const newCount = slot.count - 1
        flatSlots[slotIndex] = newCount > 0 ? { ...slot, count: newCount } : undefined
      }
    }

    // グリッドに戻す
    let index = 0
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        newSlots[y][x] = flatSlots[index++]
      }
    }

    return {
      consumedItems,
      remainingGrid: { ...grid, slots: newSlots },
    }
  })

// Transform functions
const identity = <T>(x: T): T => x

const rotate90 = (pattern: { width: number; height: number; slots: (string | undefined)[][] }): typeof pattern => ({
  width: pattern.height,
  height: pattern.width,
  slots: globalThis.Array.from({ length: pattern.width }, (_, x) =>
    globalThis.Array.from({ length: pattern.height }, (_, y) =>
      pattern.slots[pattern.height - 1 - y]?.[x]
    )
  ),
})

const rotate180 = (pattern: { width: number; height: number; slots: (string | undefined)[][] }): typeof pattern =>
  rotate90(rotate90(pattern))

const rotate270 = (pattern: { width: number; height: number; slots: (string | undefined)[][] }): typeof pattern =>
  rotate90(rotate180(pattern))

const flipHorizontal = (pattern: { width: number; height: number; slots: (string | undefined)[][] }): typeof pattern => ({
  ...pattern,
  slots: pattern.slots.map(row => [...row].reverse()),
})

const flipVertical = (pattern: { width: number; height: number; slots: (string | undefined)[][] }): typeof pattern => ({
  ...pattern,
  slots: [...pattern.slots].reverse(),
})

// Utility functions for debugging
const gridToString = (grid: CraftingGrid): string => {
  return grid.slots.map(row =>
    row.map(slot => slot ? slot.itemId : '_').join('|')
  ).join('#')
}

const recipeToString = (recipe: CraftingRecipe): string => {
  return isShapedRecipe(recipe)
    ? recipe.pattern.map(row => row.map(cell => cell ?? '_').join('|')).join('#')
    : isShapelessRecipe(recipe)
    ? `shapeless:${recipe.ingredients.length}`
    : 'unknown'
}