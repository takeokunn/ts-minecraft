---
title: 'クラフティングシステム仕様 - レシピ管理・アイテム合成・UI統合'
description: 'Minecraft Cloneのクラフティングシステム完全仕様。2x2・3x3クラフティンググリッド、レシピ検証、アイテム変換システムのEffect-TS実装とECS統合パターン。'
category: 'specification'
difficulty: 'intermediate'
tags: ['crafting-system', 'recipe-management', 'item-system', 'inventory', 'ui-system', 'game-mechanics']
prerequisites: ['effect-ts-fundamentals', 'schema-basics', 'inventory-system-basics']
estimated_reading_time: '18分'
related_patterns: ['data-modeling-patterns', 'validation-patterns', 'ui-integration-patterns']
related_docs:
  ['./01-inventory-system.md', './10-material-system.md', '../explanations/architecture/05-ecs-integration.md']
search_keywords:
  primary: ['crafting-system', 'recipe-management', 'item-synthesis', 'crafting-grid']
  secondary: ['minecraft-crafting', 'game-mechanics', 'item-combination']
  context: ['minecraft-gameplay', 'item-management', 'player-interaction']
---

# クラフティングシステム

## 1. 概要

Minecraftクローンのクラフティングシステムは、アイテムの組み合わせによる新しいアイテムの作成を管理します。Effect-TSによる型安全な実装と、ECSアーキテクチャとの統合を特徴とします。

## 2. レシピシステム

### 2.1 レシピ定義

```typescript
import { Schema, Effect, ReadonlyArray, Option, Match, Context, Brand } from 'effect'

// ブランド型定義
export type RecipeId = string & Brand.Brand<'RecipeId'>
export type ItemId = string & Brand.Brand<'ItemId'>
export type ItemStackCount = number & Brand.Brand<'ItemStackCount'>

export const RecipeId = Schema.String.pipe(Schema.brand('RecipeId'))
export const ItemId = Schema.String.pipe(Schema.brand('ItemId'))
export const ItemStackCount = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('ItemStackCount'))

// ItemStack Schema
export const ItemStack = Schema.Struct({
  itemId: ItemId,
  count: ItemStackCount,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})
export interface ItemStack extends Schema.Schema.Type<typeof ItemStack> {}

// アイテムマッチャー（Schema.TaggedUnionパターン）
export const ItemMatcher = Schema.TaggedUnion('_tag', {
  exact: Schema.Struct({
    _tag: Schema.Literal('exact'),
    itemId: ItemId,
  }),
  tag: Schema.Struct({
    _tag: Schema.Literal('tag'),
    tag: Schema.String, // "minecraft:planks", "minecraft:logs" など
  }),
  custom: Schema.Struct({
    _tag: Schema.Literal('custom'),
    predicate: Schema.Function, // (item: ItemStack) => boolean
  }),
})
export interface ItemMatcher extends Schema.Schema.Type<typeof ItemMatcher> {}

// レシピカテゴリ
export const RecipeCategory = Schema.TaggedUnion('_tag', {
  crafting: Schema.Struct({ _tag: Schema.Literal('crafting') }),
  smelting: Schema.Struct({ _tag: Schema.Literal('smelting') }),
  smithing: Schema.Struct({ _tag: Schema.Literal('smithing') }),
  stonecutting: Schema.Struct({ _tag: Schema.Literal('stonecutting') }),
})
export interface RecipeCategory extends Schema.Schema.Type<typeof RecipeCategory> {}

// クラフティングレシピ（Schema.TaggedUnionパターン）
export const CraftingRecipe = Schema.TaggedUnion('_tag', {
  shaped: Schema.Struct({
    _tag: Schema.Literal('shaped'),
    id: RecipeId,
    pattern: Schema.Array(Schema.Array(Schema.optional(Schema.String))),
    ingredients: Schema.Record(Schema.String, ItemMatcher),
    result: ItemStack,
    category: RecipeCategory,
  }),
  shapeless: Schema.Struct({
    _tag: Schema.Literal('shapeless'),
    id: RecipeId,
    ingredients: Schema.Array(ItemMatcher),
    result: ItemStack,
    category: RecipeCategory,
  }),
})
export interface CraftingRecipe extends Schema.Schema.Type<typeof CraftingRecipe> {}
```

### 2.2 レシピ登録と検索

```typescript
// レシピエラー定義
export const DuplicateRecipeError = Schema.TaggedError('DuplicateRecipeError')<{
  recipeId: RecipeId
}>

export const InvalidRecipeError = Schema.TaggedError('InvalidRecipeError')<{
  recipeId: RecipeId
  reason: Schema.String
}>

export const RecipeNotFoundError = Schema.TaggedError('RecipeNotFoundError')<{
  recipeId: RecipeId
}>

export type RegistrationError = DuplicateRecipeError | InvalidRecipeError
export type MatchError = RecipeNotFoundError

// レシピレジストリサービスインターフェース
export interface RecipeRegistryService {
  readonly register: (recipe: CraftingRecipe) => Effect.Effect<void, RegistrationError>

  readonly findMatchingRecipe: (grid: CraftingGrid) => Effect.Effect<Option.Option<CraftingRecipe>, MatchError>

  readonly getRecipeById: (id: RecipeId) => Effect.Effect<CraftingRecipe, RecipeNotFoundError>

  readonly getRecipesByCategory: (category: RecipeCategory) => Effect.Effect<ReadonlyArray<CraftingRecipe>>
}

export const RecipeRegistryService = Context.GenericTag<RecipeRegistryService>('@minecraft/RecipeRegistryService')

// レシピレジストリ実装
export const RecipeRegistryServiceLive = Layer.effect(
  RecipeRegistryService,
  Effect.gen(function* () {
    const recipes = new Map<RecipeId, CraftingRecipe>()
    const byResult = new Map<ItemId, ReadonlyArray<CraftingRecipe>>()
    const byCategory = new Map<string, ReadonlyArray<CraftingRecipe>>()

    const validateRecipe = (recipe: CraftingRecipe): Effect.Effect<void, InvalidRecipeError> =>
      Match.value(recipe).pipe(
        Match.tag('shaped', ({ pattern, ingredients }) => {
          const patternKeys = new Set(pattern.flat().filter((key) => key !== undefined))
          const ingredientKeys = new Set(Object.keys(ingredients))

          return patternKeys.size === ingredientKeys.size
            ? Effect.void
            : Effect.fail(
                InvalidRecipeError({
                  recipeId: recipe.id,
                  reason: "Pattern keys don't match ingredients",
                })
              )
        }),
        Match.tag('shapeless', ({ ingredients }) =>
          ingredients.length > 0
            ? Effect.void
            : Effect.fail(
                InvalidRecipeError({
                  recipeId: recipe.id,
                  reason: 'Shapeless recipe must have ingredients',
                })
              )
        ),
        Match.exhaustive
      )

    const register = (recipe: CraftingRecipe): Effect.Effect<void, RegistrationError> =>
      Effect.gen(function* () {
        // 早期リターンで重複チェック
        if (recipes.has(recipe.id)) {
          return yield* Effect.fail(DuplicateRecipeError({ recipeId: recipe.id }))
        }

        yield* validateRecipe(recipe)

        recipes.set(recipe.id, recipe)

        // インデックス更新
        const resultId = recipe.result.itemId
        const existing = byResult.get(resultId) ?? []
        byResult.set(resultId, [...existing, recipe])

        const categoryKey = recipe.category._tag
        const categoryExisting = byCategory.get(categoryKey) ?? []
        byCategory.set(categoryKey, [...categoryExisting, recipe])
      })

    const findMatchingRecipe = (grid: CraftingGrid): Effect.Effect<Option.Option<CraftingRecipe>, MatchError> =>
      Effect.gen(function* () {
        const allRecipes = Array.from(recipes.values())

        // 並列検索でパフォーマンス最適化
        const matches = yield* Effect.forEach(allRecipes, (recipe) => matchesRecipe(grid, recipe), {
          concurrency: 'unbounded',
        })

        return Option.fromNullable(matches.find((match) => match !== null))
      })

    const getRecipeById = (id: RecipeId): Effect.Effect<CraftingRecipe, RecipeNotFoundError> => {
      const recipe = recipes.get(id)
      return recipe ? Effect.succeed(recipe) : Effect.fail(RecipeNotFoundError({ recipeId: id }))
    }

    const getRecipesByCategory = (category: RecipeCategory): Effect.Effect<ReadonlyArray<CraftingRecipe>> =>
      Effect.succeed(byCategory.get(category._tag) ?? [])

    return {
      register,
      findMatchingRecipe,
      getRecipeById,
      getRecipesByCategory,
    }
  })
)
```

## 3. クラフティンググリッド

### 3.1 グリッド実装

```typescript
// クラフティンググリッドSchema定義
export const CraftingGrid = Schema.Struct({
  _tag: Schema.Literal('CraftingGrid'),
  width: Schema.Number.pipe(Schema.int(), Schema.positive()),
  height: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slots: Schema.Array(Schema.Array(Schema.optional(ItemStack))),
})
export interface CraftingGrid extends Schema.Schema.Type<typeof CraftingGrid> {}

// 正規化されたグリッド
export const NormalizedGrid = Schema.Struct({
  _tag: Schema.Literal('NormalizedGrid'),
  width: Schema.Number.pipe(Schema.int(), Schema.positive()),
  height: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slots: Schema.Array(Schema.Array(Schema.optional(ItemStack))),
})
export interface NormalizedGrid extends Schema.Schema.Type<typeof NormalizedGrid> {}

// グリッドサービスインターフェース
export interface CraftingGridService {
  readonly normalize: (grid: CraftingGrid) => Effect.Effect<NormalizedGrid>
  readonly matchesRecipe: (grid: CraftingGrid, recipe: CraftingRecipe) => Effect.Effect<boolean>
  readonly extractItems: (grid: CraftingGrid) => Effect.Effect<ReadonlyArray<ItemStack>>
}

export const CraftingGridService = Context.GenericTag<CraftingGridService>('@minecraft/CraftingGridService')

// グリッドサービス実装
export const CraftingGridServiceLive = Layer.succeed(CraftingGridService, {
  normalize: (grid: CraftingGrid): Effect.Effect<NormalizedGrid> =>
    Effect.gen(function* () {
      const bounds = findContentBounds(grid)

      return bounds
        ? extractSubGrid(grid, bounds)
        : {
            _tag: 'NormalizedGrid' as const,
            width: 0,
            height: 0,
            slots: [],
          }
    }),

  matchesRecipe: (grid: CraftingGrid, recipe: CraftingRecipe): Effect.Effect<boolean> =>
    Match.value(recipe).pipe(
      Match.tag('shaped', (shapedRecipe) => matchesShapedRecipe(grid, shapedRecipe)),
      Match.tag('shapeless', (shapelessRecipe) => matchesShapelessRecipe(grid, shapelessRecipe)),
      Match.exhaustive
    ),

  extractItems: (grid: CraftingGrid): Effect.Effect<ReadonlyArray<ItemStack>> =>
    Effect.succeed(grid.slots.flat().filter((item): item is ItemStack => item !== undefined)),
})

// 形状付きレシピマッチング
const matchesShapedRecipe = (grid: CraftingGrid, recipe: CraftingRecipe & { _tag: 'shaped' }): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const gridService = yield* CraftingGridService
    const normalizedGrid = yield* gridService.normalize(grid)
    const normalizedPattern = normalizePattern(recipe.pattern)

    // 早期リターン: サイズチェック
    if (normalizedGrid.width !== normalizedPattern.width || normalizedGrid.height !== normalizedPattern.height) {
      return false
    }

    // 回転・反転を考慮したマッチング
    const transforms = [
      (p: typeof normalizedPattern) => p, // identity
      rotate90,
      rotate180,
      rotate270,
      flipHorizontal,
      flipVertical,
    ]

    const result = yield* pipe(
      transforms,
      Array.findFirst((transform) =>
        Effect.gen(function* () {
          const transformedPattern = transform(normalizedPattern)
          return yield* checkPatternMatch(normalizedGrid, transformedPattern, recipe.ingredients)
        })
      )
    )

    return Option.isSome(result)

    return false
  })

// 形状なしレシピマッチング
const matchesShapelessRecipe = (
  grid: CraftingGrid,
  recipe: CraftingRecipe & { _tag: 'shapeless' }
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const gridService = yield* CraftingGridService
    const items = yield* gridService.extractItems(grid)

    return checkShapelessMatch(items, recipe.ingredients)
  })

// パターンマッチ検証ユーティリティ
const checkPatternMatch = (
  grid: NormalizedGrid,
  pattern: NormalizedPattern,
  ingredients: Record<string, ItemMatcher>
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const allMatches = yield* pipe(
      Array.range(0, grid.height),
      Array.flatMap((y) =>
        pipe(
          Array.range(0, grid.width),
          Array.map((x) => ({ x, y }))
        )
      ),
      Array.map(({ x, y }) =>
        Effect.gen(function* () {
          const gridItem = grid.slots[y]?.[x]
          const patternKey = pattern.slots[y]?.[x]
          return yield* matchesIngredient(gridItem, patternKey, ingredients)
        })
      ),
      Effect.all,
      Effect.map(Array.every((matches) => matches))
    )

    return allMatches
    return true
  })

// 材料マッチングユーティリティ
const matchesIngredient = (
  item: ItemStack | undefined,
  patternKey: string | undefined,
  ingredients: Record<string, ItemMatcher>
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    // 空スロットの場合
    if (!patternKey) return item === undefined
    if (!item) return false

    const matcher = ingredients[patternKey]
    if (!matcher) return false

    return yield* Match.value(matcher).pipe(
      Match.tag('exact', ({ itemId }) => Effect.succeed(item.itemId === itemId)),
      Match.tag('tag', ({ tag }) => checkItemTag(item, tag)),
      Match.tag('custom', ({ predicate }) =>
        Effect.try({
          try: () => predicate(item),
          catch: () => false,
        })
      ),
      Match.exhaustive
    )
  })
```

### 3.2 形状なしクラフティング

```typescript
// 形状なしクラフティングユーティリティ
const checkShapelessMatch = (
  items: ReadonlyArray<ItemStack>,
  requiredIngredients: ReadonlyArray<ItemMatcher>
): boolean => {
  const providedItems = [...items] // ミュータブルコピーで消費計算

  // 各必要材料に対してマッチするアイテムを探す
  const allFound = pipe(
    requiredIngredients,
    Array.every((requiredIngredient) => {
      const foundIndex = pipe(
        providedItems,
        Array.findFirstIndex((item) => item.count > 0 && matchesIngredientSync(item, requiredIngredient))
      )

      return Match.value(foundIndex).pipe(
        Match.when(Option.isSome, (idx) => {
          const i = Option.getOrThrow(idx)
          const item = providedItems[i]
          // アイテムを消費
          providedItems[i] = {
            ...item,
            count: Brand.nominal<ItemStackCount>(item.count - 1),
          }
          return true
        }),
        Match.when(Option.isNone, () => false),
        Match.exhaustive
      )
    })
  )

  if (!allFound) return false

  // 余剰アイテムがないことを確認
  return providedItems.every((item) => item.count === 0)
}

// 同期バージョンの材料マッチング
const matchesIngredientSync = (item: ItemStack, matcher: ItemMatcher): boolean => {
  return Match.value(matcher).pipe(
    Match.tag('exact', ({ itemId }) => item.itemId === itemId),
    Match.tag('tag', ({ tag }) => checkItemTagSync(item, tag)),
    Match.tag('custom', ({ predicate }) => {
      try {
        return predicate(item)
      } catch {
        return false
      }
    }),
    Match.exhaustive
  )
}

// タグ検証の同期バージョン
const checkItemTagSync = (item: ItemStack, tag: string): boolean => {
  // タグマッチングロジックの実装
  const itemTags = getItemTags(item.itemId)
  return itemTags.includes(tag)
}

// アイテムタグ取得（サンプル実装）
const getItemTags = (itemId: ItemId): ReadonlyArray<string> => {
  const tagMap: Record<string, ReadonlyArray<string>> = {
    'minecraft:oak_planks': ['minecraft:planks', 'minecraft:wooden_items'],
    'minecraft:birch_planks': ['minecraft:planks', 'minecraft:wooden_items'],
    'minecraft:oak_log': ['minecraft:logs', 'minecraft:wooden_items'],
    'minecraft:stone': ['minecraft:stone', 'minecraft:building_blocks'],
  }

  return tagMap[itemId] ?? []
}
```

## 4. クラフティング実行

### 4.1 クラフティングプロセス

```typescript
// クラフティングエラー定義
export const InsufficientPermissionsError = Schema.TaggedError('InsufficientPermissionsError', {
  playerId: Schema.String,
  recipeId: RecipeId,
  requiredPermission: Schema.String,
})

export const ConsumptionError = Schema.TaggedError('ConsumptionError', {
  recipeId: RecipeId,
  reason: Schema.String,
})

export const ResultGenerationError = Schema.TaggedError('ResultGenerationError', {
  recipeId: RecipeId,
  cause: Schema.String,
})

export type CraftingError = InsufficientPermissionsError | ConsumptionError | ResultGenerationError

// クラフティング結果
export const CraftingResult = Schema.Struct({
  _tag: Schema.Literal('CraftingResult'),
  grid: CraftingGrid,
  result: ItemStack,
  recipe: CraftingRecipe,
  timestamp: Schema.Number,
})
export interface CraftingResult extends Schema.Schema.Type<typeof CraftingResult> {}

// プレイヤースキーマ（サンプル）
export const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('PlayerId')),
  permissions: Schema.Array(Schema.String),
  craftingStats: Schema.Record(RecipeId, Schema.Number),
})
export interface Player extends Schema.Schema.Type<typeof Player> {}

// クラフティングサービスインターフェース
export interface CraftingService {
  readonly craft: (
    grid: CraftingGrid,
    recipe: CraftingRecipe,
    player: Player
  ) => Effect.Effect<CraftingResult, CraftingError>

  readonly validateCrafting: (
    grid: CraftingGrid,
    recipe: CraftingRecipe,
    player: Player
  ) => Effect.Effect<void, CraftingError>

  readonly consumeIngredients: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ) => Effect.Effect<CraftingGrid, ConsumptionError>
}

export const CraftingService = Context.GenericTag<CraftingService>('@minecraft/CraftingService')

// クラフティングサービス実装
export const CraftingServiceLive = Layer.effect(
  CraftingService,
  Effect.gen(function* () {
    const gridService = yield* CraftingGridService
    const eventBus = yield* EventBus
    const statsService = yield* StatsService

    const validateCrafting = (
      grid: CraftingGrid,
      recipe: CraftingRecipe,
      player: Player
    ): Effect.Effect<void, CraftingError> =>
      Effect.gen(function* () {
        // 早期リターン: 権限チェック
        const hasPermission = checkCraftingPermission(player, recipe)
        if (!hasPermission) {
          return yield* Effect.fail(
            InsufficientPermissionsError({
              playerId: player.id,
              recipeId: recipe.id,
              requiredPermission: getRequiredPermission(recipe),
            })
          )
        }

        // レシピマッチング検証
        const matches = yield* gridService.matchesRecipe(grid, recipe)
        if (!matches) {
          return yield* Effect.fail(
            ConsumptionError({
              recipeId: recipe.id,
              reason: "Recipe pattern doesn't match grid",
            })
          )
        }
      })

    const consumeIngredients = (
      grid: CraftingGrid,
      recipe: CraftingRecipe
    ): Effect.Effect<CraftingGrid, ConsumptionError> =>
      Match.value(recipe).pipe(
        Match.tag('shaped', (shapedRecipe) => consumeShapedIngredients(grid, shapedRecipe)),
        Match.tag('shapeless', (shapelessRecipe) => consumeShapelessIngredients(grid, shapelessRecipe)),
        Match.exhaustive
      )

    const craft = (
      grid: CraftingGrid,
      recipe: CraftingRecipe,
      player: Player
    ): Effect.Effect<CraftingResult, CraftingError> =>
      Effect.gen(function* () {
        // バリデーション（早期リターン）
        yield* validateCrafting(grid, recipe, player)

        // 材料消費
        const consumedGrid = yield* consumeIngredients(grid, recipe)

        // 結果生成
        const result = generateCraftingResult(recipe)

        // 統計更新（非同期）
        yield* Effect.fork(statsService.updateCraftingStats(player.id, recipe.id))

        // イベント発行（非同期）
        const craftingEvent = {
          _tag: 'CraftingCompleted' as const,
          playerId: player.id,
          recipeId: recipe.id,
          resultItemId: result.itemId,
          timestamp: Date.now(),
        }
        yield* Effect.fork(eventBus.publish(craftingEvent))

        return {
          _tag: 'CraftingResult' as const,
          grid: consumedGrid,
          result,
          recipe,
          timestamp: Date.now(),
        }
      })

    return { validateCrafting, consumeIngredients, craft }
  })
)

// ユーティリティ関数
const checkCraftingPermission = (player: Player, recipe: CraftingRecipe): boolean => {
  const requiredPermission = getRequiredPermission(recipe)
  return player.permissions.includes(requiredPermission)
}

const getRequiredPermission = (recipe: CraftingRecipe): string =>
  Match.value(recipe.category).pipe(
    Match.tag('crafting', () => 'minecraft.craft.basic'),
    Match.tag('smelting', () => 'minecraft.craft.smelting'),
    Match.tag('smithing', () => 'minecraft.craft.smithing'),
    Match.tag('stonecutting', () => 'minecraft.craft.stonecutting'),
    Match.exhaustive
  )

const generateCraftingResult = (recipe: CraftingRecipe): ItemStack => ({
  itemId: recipe.result.itemId,
  count: recipe.result.count,
  metadata: recipe.result.metadata,
})

// 形状付きレシピの消費
const consumeShapedIngredients = (
  grid: CraftingGrid,
  recipe: CraftingRecipe & { _tag: 'shaped' }
): Effect.Effect<CraftingGrid, ConsumptionError> =>
  Effect.gen(function* () {
    const updatedSlots = grid.slots.map((row) => [...row])

    // パターンに従って消費
    yield* pipe(
      recipe.pattern,
      Array.mapWithIndex((y, patternRow) =>
        pipe(
          patternRow,
          Array.mapWithIndex((x, patternKey) =>
            pipe(
              Option.fromNullable(patternKey),
              Option.match({
                onNone: () => Effect.succeed(undefined),
                onSome: () =>
                  Effect.gen(function* () {
                    const gridSlot = updatedSlots[y]?.[x]
                    if (!gridSlot) {
                      return yield* Effect.fail(
                        ConsumptionError({
                          recipeId: recipe.id,
                          reason: `Missing ingredient at position ${x},${y}`,
                        })
                      )
                    }

                    // 1個消費
                    const newCount = gridSlot.count - 1
                    updatedSlots[y][x] =
                      newCount > 0 ? { ...gridSlot, count: Brand.nominal<ItemStackCount>(newCount) } : undefined

                    return Effect.succeed(undefined)
                  }),
              })
            )
          ),
          Effect.all
        )
      ),
      Effect.all,
      Effect.asVoid
    )

    return {
      ...grid,
      slots: updatedSlots,
    }
  })

// 形状なしレシピの消費
const consumeShapelessIngredients = (
  grid: CraftingGrid,
  recipe: CraftingRecipe & { _tag: 'shapeless' }
): Effect.Effect<CraftingGrid, ConsumptionError> =>
  Effect.gen(function* () {
    const updatedSlots = grid.slots.map((row) => [...row])
    const flatSlots = updatedSlots.flat()

    // 各材料を消費
    yield* pipe(
      recipe.ingredients,
      Effect.reduce(flatSlots, (currentSlots, requiredIngredient) =>
        Effect.gen(function* () {
          const slotIndex = yield* pipe(
            currentSlots,
            Array.findFirstIndex((slot) => slot && slot.count > 0 && matchesIngredientSync(slot, requiredIngredient)),
            Effect.fromOption(() =>
              ConsumptionError({
                recipeId: recipe.id,
                reason: 'Insufficient ingredients for shapeless recipe',
              })
            )
          )

          const slot = currentSlots[slotIndex]!
          const newCount = slot.count - 1
          const updatedSlots = [...currentSlots]
          updatedSlots[slotIndex] =
            newCount > 0 ? { ...slot, count: Brand.nominal<ItemStackCount>(newCount) } : undefined

          return updatedSlots
        })
      ),
      Effect.map((finalSlots) => {
        // グリッドに戻す
        let index = 0
        return updatedSlots.map((row) => row.map(() => finalSlots[index++]))
      }),
      Effect.map((reconstructedSlots) => {
        // 元の flatSlots を更新 (関数型アプローチ)
        return reconstructedSlots.flat()
      }),
      Effect.asVoid
    )

    // グリッドに戻す
    const reconstructedSlots = pipe(
      Array.range(0, updatedSlots.length),
      Array.map((y) =>
        pipe(
          Array.range(0, updatedSlots[y].length),
          Array.map((x) => flatSlots[y * updatedSlots[y].length + x])
        )
      )
    )

    return {
      ...grid,
      slots: reconstructedSlots,
    }
  })
```

## 5. 特殊クラフティング

### 5.1 かまどレシピ

```typescript
// 精錬レシピSchema
export const FurnaceRecipe = Schema.Struct({
  _tag: Schema.Literal('FurnaceRecipe'),
  id: RecipeId,
  input: ItemMatcher,
  output: ItemStack,
  experience: Schema.Number.pipe(Schema.nonNegative()),
  cookingTime: Schema.Number.pipe(Schema.positive()), // ミリ秒単位
  category: Schema.Literal('smelting'),
})
export interface FurnaceRecipe extends Schema.Schema.Type<typeof FurnaceRecipe> {}

// 燃料アイテムSchema
export const FuelItem = Schema.Struct({
  _tag: Schema.Literal('FuelItem'),
  itemId: ItemId,
  burnTime: Schema.Number.pipe(Schema.positive()), // ミリ秒単位
})
export interface FuelItem extends Schema.Schema.Type<typeof FuelItem> {}

// かまど状態Schema
export const FurnaceState = Schema.Struct({
  _tag: Schema.Literal('FurnaceState'),
  inputSlot: Schema.optional(ItemStack),
  fuelSlot: Schema.optional(ItemStack),
  outputSlot: Schema.optional(ItemStack),
  fuelRemaining: Schema.Number.pipe(Schema.nonNegative()),
  smeltProgress: Schema.Number.pipe(Schema.nonNegative()),
  experience: Schema.Number.pipe(Schema.nonNegative()),
  isSmelting: Schema.Boolean,
})
export interface FurnaceState extends Schema.Schema.Type<typeof FurnaceState> {}

// 精錬エラー定義
export const InsufficientFuelError = Schema.TaggedError('InsufficientFuelError', {
  furnaceId: Schema.String,
  requiredTime: Schema.Number,
})

export const InvalidInputError = Schema.TaggedError('InvalidInputError', {
  itemId: ItemId,
  reason: Schema.String,
})

export const OutputSlotFullError = Schema.TaggedError('OutputSlotFullError', {
  furnaceId: Schema.String,
  outputItem: ItemStack,
})

export type SmeltingError = InsufficientFuelError | InvalidInputError | OutputSlotFullError

// かまどサービスインターフェース
export interface FurnaceService {
  readonly smelt: (furnaceState: FurnaceState, deltaTime: number) => Effect.Effect<FurnaceState, SmeltingError>

  readonly addFuel: (furnaceState: FurnaceState, fuelItem: ItemStack) => Effect.Effect<FurnaceState, SmeltingError>

  readonly getRecipeForInput: (input: ItemStack) => Effect.Effect<Option.Option<FurnaceRecipe>>
}

export const FurnaceService = Context.GenericTag<FurnaceService>('@minecraft/FurnaceService')

// かまどサービス実装
export const FurnaceServiceLive = Layer.effect(
  FurnaceService,
  Effect.gen(function* () {
    const recipeRegistry = yield* RecipeRegistryService

    const getRecipeForInput = (input: ItemStack): Effect.Effect<Option.Option<FurnaceRecipe>> =>
      Effect.gen(function* () {
        // 精錬レシピを検索
        const furnaceRecipes = yield* recipeRegistry.getRecipesByCategory({
          _tag: 'smelting',
        })

        const matchingRecipe = furnaceRecipes.find((recipe) =>
          Match.value(recipe).pipe(
            Match.when(
              (r) => r._tag === 'FurnaceRecipe',
              (r) => matchesIngredientSync(input, (r as any).input)
            ),
            Match.orElse(() => false)
          )
        )

        return Option.fromNullable(matchingRecipe as FurnaceRecipe)
      })

    const addFuel = (furnaceState: FurnaceState, fuelItem: ItemStack): Effect.Effect<FurnaceState, SmeltingError> =>
      Effect.gen(function* () {
        const fuelValue = getFuelValue(fuelItem.itemId)

        // 早期リターン: 燃料でない場合
        if (fuelValue <= 0) {
          return yield* Effect.fail(
            InvalidInputError({
              itemId: fuelItem.itemId,
              reason: 'Item is not a valid fuel',
            })
          )
        }

        return {
          ...furnaceState,
          fuelSlot:
            fuelItem.count > 1 ? { ...fuelItem, count: Brand.nominal<ItemStackCount>(fuelItem.count - 1) } : undefined,
          fuelRemaining: furnaceState.fuelRemaining + fuelValue,
        }
      })

    const smelt = (furnaceState: FurnaceState, deltaTime: number): Effect.Effect<FurnaceState, SmeltingError> =>
      Effect.gen(function* () {
        // 早期リターン: 入力スロットが空
        if (!furnaceState.inputSlot) {
          return {
            ...furnaceState,
            isSmelting: false,
            smeltProgress: 0,
          }
        }

        // レシピ検索
        const recipeOption = yield* getRecipeForInput(furnaceState.inputSlot)
        if (Option.isNone(recipeOption)) {
          return {
            ...furnaceState,
            isSmelting: false,
            smeltProgress: 0,
          }
        }

        const recipe = recipeOption.value

        // 燃料チェック
        if (furnaceState.fuelRemaining <= 0) {
          if (!furnaceState.fuelSlot) {
            return yield* Effect.fail(
              InsufficientFuelError({
                furnaceId: 'furnace_001', // TODO: 実際のIDを使用
                requiredTime: recipe.cookingTime,
              })
            )
          }

          // 自動燃料消費
          const updatedState = yield* addFuel(furnaceState, furnaceState.fuelSlot)
          return yield* smelt(updatedState, deltaTime)
        }

        // 精錬進行更新
        const newProgress = furnaceState.smeltProgress + deltaTime
        const newFuelRemaining = Math.max(0, furnaceState.fuelRemaining - deltaTime)

        // 精錬完了チェック
        if (newProgress >= recipe.cookingTime) {
          // 出力スロットチェック
          if (
            furnaceState.outputSlot &&
            (furnaceState.outputSlot.itemId !== recipe.output.itemId ||
              furnaceState.outputSlot.count + recipe.output.count > 64)
          ) {
            return yield* Effect.fail(
              OutputSlotFullError({
                furnaceId: 'furnace_001',
                outputItem: recipe.output,
              })
            )
          }

          // 精錬完了処理
          const inputConsumed = {
            ...furnaceState.inputSlot,
            count: Brand.nominal<ItemStackCount>(furnaceState.inputSlot.count - 1),
          }

          const newOutputSlot = furnaceState.outputSlot
            ? {
                ...furnaceState.outputSlot,
                count: Brand.nominal<ItemStackCount>(furnaceState.outputSlot.count + recipe.output.count),
              }
            : recipe.output

          return {
            ...furnaceState,
            inputSlot: inputConsumed.count > 0 ? inputConsumed : undefined,
            outputSlot: newOutputSlot,
            smeltProgress: 0,
            experience: furnaceState.experience + recipe.experience,
            fuelRemaining: newFuelRemaining,
            isSmelting: !!furnaceState.inputSlot,
          }
        }

        return {
          ...furnaceState,
          smeltProgress: newProgress,
          fuelRemaining: newFuelRemaining,
          isSmelting: true,
        }
      })

    return { smelt, addFuel, getRecipeForInput }
  })
)

// 燃料バリュー取得ユーティリティ
const getFuelValue = (itemId: ItemId): number => {
  const fuelValues: Record<string, number> = {
    'minecraft:coal': 80000, // 80秒
    'minecraft:charcoal': 80000, // 80秒
    'minecraft:wood': 15000, // 15秒
    'minecraft:stick': 5000, // 5秒
    'minecraft:lava_bucket': 1000000, // 1000秒
    'minecraft:blaze_rod': 120000, // 120秒
  }

  return fuelValues[itemId] ?? 0
}
```

### 5.2 エンチャントテーブル

```typescript
// エンチャントSchema定義
export type EnchantmentId = string & Brand.Brand<'EnchantmentId'>
export type EnchantmentLevel = number & Brand.Brand<'EnchantmentLevel'>
export type ExperienceLevel = number & Brand.Brand<'ExperienceLevel'>

export const EnchantmentId = Schema.String.pipe(Schema.brand('EnchantmentId'))
export const EnchantmentLevel = Schema.Number.pipe(Schema.int(), Schema.between(1, 5), Schema.brand('EnchantmentLevel'))
export const ExperienceLevel = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('ExperienceLevel'))

// エンチャント情報
export const Enchantment = Schema.Struct({
  _tag: Schema.Literal('Enchantment'),
  id: EnchantmentId,
  level: EnchantmentLevel,
  cost: ExperienceLevel,
})
export interface Enchantment extends Schema.Schema.Type<typeof Enchantment> {}

// エンチャントテーブル状態
export const EnchantingTableState = Schema.Struct({
  _tag: Schema.Literal('EnchantingTableState'),
  itemSlot: Schema.optional(ItemStack),
  lapisSlot: Schema.optional(ItemStack),
  bookshelfCount: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  availableEnchantments: Schema.Array(Enchantment),
  seed: Schema.Number.pipe(Schema.int()), // ランダムシード
})
export interface EnchantingTableState extends Schema.Schema.Type<typeof EnchantingTableState> {}

// エンチャントエラー定義
export const InsufficientExperienceError = Schema.TaggedError('InsufficientExperienceError', {
  required: ExperienceLevel,
  current: ExperienceLevel,
})

export const InsufficientLapisError = Schema.TaggedError('InsufficientLapisError', {
  required: Schema.Number,
  available: Schema.Number,
})

export const EnchantmentConflictError = Schema.TaggedError('EnchantmentConflictError', {
  conflictingEnchantments: Schema.Array(EnchantmentId),
})

export const ItemNotEnchantableError = Schema.TaggedError('ItemNotEnchantableError', {
  itemId: ItemId,
  reason: Schema.String,
})

export type EnchantmentError =
  | InsufficientExperienceError
  | InsufficientLapisError
  | EnchantmentConflictError
  | ItemNotEnchantableError

// エンチャントサービスインターフェース
export interface EnchantingService {
  readonly calculateAvailableEnchantments: (
    item: ItemStack,
    bookshelfCount: number,
    playerLevel: ExperienceLevel,
    seed: number
  ) => Effect.Effect<ReadonlyArray<Enchantment>>

  readonly applyEnchantment: (
    item: ItemStack,
    enchantment: Enchantment,
    playerLevel: ExperienceLevel,
    lapisCount: number
  ) => Effect.Effect<ItemStack, EnchantmentError>

  readonly checkEnchantmentCompatibility: (item: ItemStack, enchantment: Enchantment) => Effect.Effect<boolean>
}

export const EnchantingService = Context.GenericTag<EnchantingService>('@minecraft/EnchantingService')

// エンチャントサービス実装
export const EnchantingServiceLive = Layer.succeed(EnchantingService, {
  calculateAvailableEnchantments: (
    item: ItemStack,
    bookshelfCount: number,
    playerLevel: ExperienceLevel,
    seed: number
  ): Effect.Effect<ReadonlyArray<Enchantment>> =>
    Effect.gen(function* () {
      // 早期リターン: アイテムがエンチャント可能かチェック
      const enchantability = getItemEnchantability(item.itemId)
      if (enchantability === 0) {
        return []
      }

      const power = Math.min(bookshelfCount, 15)
      const availableEnchantments = getEnchantmentsForItem(item.itemId)

      // エンチャントランダム生成アルゴリズム
      const random = createSeededRandom(seed)

      const enchantmentOptions = yield* pipe(
        Array.range(0, 3),
        Effect.forEach((i) =>
          Effect.gen(function* () {
            const baseCost = (i + 1) * 3 + Math.floor(random() * 5)
            const levelCost = Math.min(30, baseCost + power)

            return pipe(
              levelCost <= playerLevel,
              (canAfford) => (canAfford ? Option.some(levelCost) : Option.none()),
              Option.flatMap((cost) =>
                pipe(
                  selectRandomEnchantment(availableEnchantments, enchantability, cost, random),
                  Option.fromNullable,
                  Option.map((selectedEnchantment) => ({
                    _tag: 'Enchantment' as const,
                    id: selectedEnchantment.id,
                    level: selectedEnchantment.level,
                    cost: Brand.nominal<ExperienceLevel>(cost),
                  }))
                )
              )
            )
          })
        ),
        Effect.map(Array.getSomes)
      )

      return enchantmentOptions
    }),

  applyEnchantment: (
    item: ItemStack,
    enchantment: Enchantment,
    playerLevel: ExperienceLevel,
    lapisCount: number
  ): Effect.Effect<ItemStack, EnchantmentError> =>
    Effect.gen(function* () {
      // 早期リターン: 経験値チェック
      if (playerLevel < enchantment.cost) {
        return yield* Effect.fail(
          InsufficientExperienceError({
            required: enchantment.cost,
            current: playerLevel,
          })
        )
      }

      // 早期リターン: ラピスラズリチェック
      const requiredLapis = Math.max(1, Math.floor(enchantment.cost / 10))
      if (lapisCount < requiredLapis) {
        return yield* Effect.fail(
          InsufficientLapisError({
            required: requiredLapis,
            available: lapisCount,
          })
        )
      }

      // 競合チェック
      const isCompatible = yield* checkEnchantmentCompatibility(item, enchantment)
      if (!isCompatible) {
        const existingEnchantments = getExistingEnchantments(item)
        const conflicting = existingEnchantments.filter((existing) =>
          areEnchantmentsConflicting(existing.id, enchantment.id)
        )

        return yield* Effect.fail(
          EnchantmentConflictError({
            conflictingEnchantments: conflicting.map((e) => e.id),
          })
        )
      }

      // エンチャント適用
      const existingEnchantments = getExistingEnchantments(item)
      const newEnchantments = [...existingEnchantments, enchantment]

      return {
        ...item,
        metadata: {
          ...item.metadata,
          enchantments: newEnchantments.map((e) => `${e.id}:${e.level}`),
        },
      }
    }),

  checkEnchantmentCompatibility: (item: ItemStack, enchantment: Enchantment): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      // アイテムタイプチェック
      if (!canApplyEnchantment(item.itemId, enchantment.id)) {
        return false
      }

      // 既存エンチャントとの競合チェック
      const existingEnchantments = getExistingEnchantments(item)
      return !existingEnchantments.some((existing) => areEnchantmentsConflicting(existing.id, enchantment.id))
    }),
})

// ユーティリティ関数
const getItemEnchantability = (itemId: ItemId): number => {
  const enchantabilityMap: Record<string, number> = {
    'minecraft:wooden_sword': 15,
    'minecraft:iron_sword': 14,
    'minecraft:diamond_sword': 10,
    'minecraft:netherite_sword': 15,
    'minecraft:bow': 1,
    'minecraft:book': 1,
  }
  return enchantabilityMap[itemId] ?? 0
}

const getEnchantmentsForItem = (itemId: ItemId): ReadonlyArray<{ id: EnchantmentId; maxLevel: number }> => {
  // アイテムタイプごとのエンチャント一覧
  if (itemId.includes('sword')) {
    return [
      { id: Brand.nominal<EnchantmentId>('minecraft:sharpness'), maxLevel: 5 },
      { id: Brand.nominal<EnchantmentId>('minecraft:fire_aspect'), maxLevel: 2 },
      { id: Brand.nominal<EnchantmentId>('minecraft:knockback'), maxLevel: 2 },
      { id: Brand.nominal<EnchantmentId>('minecraft:looting'), maxLevel: 3 },
    ]
  }
  return []
}

const getExistingEnchantments = (item: ItemStack): ReadonlyArray<Enchantment> => {
  const enchantmentStrings = (item.metadata?.enchantments as string[]) ?? []
  return enchantmentStrings.map((str) => {
    const [id, level] = str.split(':')
    return {
      _tag: 'Enchantment' as const,
      id: Brand.nominal<EnchantmentId>(id),
      level: Brand.nominal<EnchantmentLevel>(parseInt(level)),
      cost: Brand.nominal<ExperienceLevel>(0), // コストは既存エンチャントでは不要
    }
  })
}

const areEnchantmentsConflicting = (enchant1: EnchantmentId, enchant2: EnchantmentId): boolean => {
  const conflicts: Record<string, ReadonlyArray<string>> = {
    'minecraft:sharpness': ['minecraft:smite', 'minecraft:bane_of_arthropods'],
    'minecraft:protection': ['minecraft:blast_protection', 'minecraft:fire_protection'],
    'minecraft:infinity': ['minecraft:mending'],
  }

  return conflicts[enchant1]?.includes(enchant2) ?? false
}

const canApplyEnchantment = (itemId: ItemId, enchantmentId: EnchantmentId): boolean => {
  const itemEnchantments = getEnchantmentsForItem(itemId)
  return itemEnchantments.some((e) => e.id === enchantmentId)
}

const createSeededRandom = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }
}

const selectRandomEnchantment = (
  availableEnchantments: ReadonlyArray<{ id: EnchantmentId; maxLevel: number }>,
  enchantability: number,
  levelCost: number,
  random: () => number
): { id: EnchantmentId; level: EnchantmentLevel } | null => {
  if (availableEnchantments.length === 0) return null

  const selectedIndex = Math.floor(random() * availableEnchantments.length)
  const selected = availableEnchantments[selectedIndex]
  const level = Math.min(selected.maxLevel, Math.max(1, Math.floor(levelCost / 5)))

  return {
    id: selected.id,
    level: Brand.nominal<EnchantmentLevel>(level),
  }
}
```

## 6. レシピ解放システム

```typescript
// レシピ解放条件Schema
export const UnlockCondition = Schema.TaggedUnion('_tag', {
  item_obtained: Schema.Struct({
    _tag: Schema.Literal('item_obtained'),
    itemId: ItemId,
    count: ItemStackCount,
  }),
  advancement_completed: Schema.Struct({
    _tag: Schema.Literal('advancement_completed'),
    advancementId: Schema.String.pipe(Schema.brand('AdvancementId')),
  }),
  level_reached: Schema.Struct({
    _tag: Schema.Literal('level_reached'),
    level: ExperienceLevel,
  }),
  dimension_visited: Schema.Struct({
    _tag: Schema.Literal('dimension_visited'),
    dimensionId: Schema.String.pipe(Schema.brand('DimensionId')),
  }),
})
export interface UnlockCondition extends Schema.Schema.Type<typeof UnlockCondition> {}

// レシピ解放データ
export const RecipeUnlockData = Schema.Struct({
  _tag: Schema.Literal('RecipeUnlockData'),
  recipeId: RecipeId,
  conditions: Schema.Array(UnlockCondition),
  autoUnlock: Schema.Boolean, // 条件満たし時に自動解放するか
  category: RecipeCategory,
})
export interface RecipeUnlockData extends Schema.Schema.Type<typeof RecipeUnlockData> {}

// プレイヤー解放状態
export const PlayerUnlockState = Schema.Struct({
  _tag: Schema.Literal('PlayerUnlockState'),
  playerId: Schema.String.pipe(Schema.brand('PlayerId')),
  unlockedRecipes: Schema.Set(RecipeId),
  obtainedItems: Schema.Map({
    key: ItemId,
    value: ItemStackCount,
  }),
  completedAdvancements: Schema.Set(Schema.String.pipe(Schema.brand('AdvancementId'))),
  experienceLevel: ExperienceLevel,
  visitedDimensions: Schema.Set(Schema.String.pipe(Schema.brand('DimensionId'))),
})
export interface PlayerUnlockState extends Schema.Schema.Type<typeof PlayerUnlockState> {}

// 解放エラー定義
export const ConditionNotMetError = Schema.TaggedError('ConditionNotMetError', {
  playerId: Schema.String.pipe(Schema.brand('PlayerId')),
  recipeId: RecipeId,
  unmetConditions: Schema.Array(UnlockCondition),
})

export const RecipeAlreadyUnlockedError = Schema.TaggedError('RecipeAlreadyUnlockedError', {
  playerId: Schema.String.pipe(Schema.brand('PlayerId')),
  recipeId: RecipeId,
})

export type UnlockError = ConditionNotMetError | RecipeAlreadyUnlockedError

// レシピ解放サービスインターフェース
export interface RecipeUnlockService {
  readonly checkUnlockConditions: (
    playerState: PlayerUnlockState,
    unlockData: RecipeUnlockData
  ) => Effect.Effect<boolean>

  readonly unlockRecipe: (
    playerState: PlayerUnlockState,
    recipeId: RecipeId
  ) => Effect.Effect<PlayerUnlockState, UnlockError>

  readonly autoUnlockRecipes: (
    playerState: PlayerUnlockState,
    newItem: ItemStack
  ) => Effect.Effect<{
    updatedState: PlayerUnlockState
    unlockedRecipes: ReadonlyArray<RecipeId>
  }>

  readonly getAvailableRecipes: (playerState: PlayerUnlockState) => Effect.Effect<ReadonlyArray<RecipeId>>
}

export const RecipeUnlockService = Context.GenericTag<RecipeUnlockService>('@minecraft/RecipeUnlockService')

// レシピ解放サービス実装
export const RecipeUnlockServiceLive = Layer.effect(
  RecipeUnlockService,
  Effect.gen(function* () {
    const recipeRegistry = yield* RecipeRegistryService
    const eventBus = yield* EventBus

    // 解放条件データストア（サンプル）
    const unlockDataStore = new Map<RecipeId, RecipeUnlockData>()

    const checkUnlockConditions = (
      playerState: PlayerUnlockState,
      unlockData: RecipeUnlockData
    ): Effect.Effect<boolean> =>
      pipe(
        unlockData.conditions,
        Effect.every((condition) => evaluateCondition(playerState, condition))
      )

    const evaluateCondition = (playerState: PlayerUnlockState, condition: UnlockCondition): Effect.Effect<boolean> =>
      Match.value(condition).pipe(
        Match.tag('item_obtained', ({ itemId, count }) => {
          const obtained = playerState.obtainedItems.get(itemId) ?? Brand.nominal<ItemStackCount>(0)
          return Effect.succeed(obtained >= count)
        }),
        Match.tag('advancement_completed', ({ advancementId }) =>
          Effect.succeed(playerState.completedAdvancements.has(advancementId))
        ),
        Match.tag('level_reached', ({ level }) => Effect.succeed(playerState.experienceLevel >= level)),
        Match.tag('dimension_visited', ({ dimensionId }) =>
          Effect.succeed(playerState.visitedDimensions.has(dimensionId))
        ),
        Match.exhaustive
      )

    const unlockRecipe = (
      playerState: PlayerUnlockState,
      recipeId: RecipeId
    ): Effect.Effect<PlayerUnlockState, UnlockError> =>
      Effect.gen(function* () {
        // 早期リターン: 既に解放済み
        if (playerState.unlockedRecipes.has(recipeId)) {
          return yield* Effect.fail(
            RecipeAlreadyUnlockedError({
              playerId: playerState.playerId,
              recipeId,
            })
          )
        }

        const unlockData = unlockDataStore.get(recipeId)
        if (!unlockData) {
          // デフォルトで解放（条件なし）
          return {
            ...playerState,
            unlockedRecipes: new Set([...playerState.unlockedRecipes, recipeId]),
          }
        }

        // 条件チェック
        const conditionsMet = yield* checkUnlockConditions(playerState, unlockData)
        if (!conditionsMet) {
          const unmetConditions = yield* pipe(
            unlockData.conditions,
            Effect.filterMap((condition) =>
              Effect.gen(function* () {
                const met = yield* evaluateCondition(playerState, condition)
                return met ? Option.none() : Option.some(condition)
              })
            )
          )

          return yield* Effect.fail(
            ConditionNotMetError({
              playerId: playerState.playerId,
              recipeId,
              unmetConditions,
            })
          )
        }

        // 解放実行
        const updatedState = {
          ...playerState,
          unlockedRecipes: new Set([...playerState.unlockedRecipes, recipeId]),
        }

        // 解放イベント発行
        yield* Effect.fork(
          eventBus.publish({
            _tag: 'RecipeUnlocked' as const,
            playerId: playerState.playerId,
            recipeId,
            timestamp: Date.now(),
          })
        )

        return updatedState
      })

    const autoUnlockRecipes = (
      playerState: PlayerUnlockState,
      newItem: ItemStack
    ): Effect.Effect<{
      updatedState: PlayerUnlockState
      unlockedRecipes: ReadonlyArray<RecipeId>
    }> =>
      Effect.gen(function* () {
        // アイテム取得状態更新
        const currentCount = playerState.obtainedItems.get(newItem.itemId) ?? Brand.nominal<ItemStackCount>(0)
        const updatedObtainedItems = new Map(playerState.obtainedItems)
        updatedObtainedItems.set(newItem.itemId, Brand.nominal<ItemStackCount>(currentCount + newItem.count))

        let currentState: PlayerUnlockState = {
          ...playerState,
          obtainedItems: updatedObtainedItems,
        }
        const unlockedRecipes: RecipeId[] = []

        // 自動解放対象レシピをチェック
        const { updatedState: finalState, unlockedRecipes: newlyUnlocked } = yield* pipe(
          Array.from(unlockDataStore.entries()),
          Effect.reduce(
            { updatedState: currentState, unlockedRecipes: [] as RecipeId[] },
            (acc, [recipeId, unlockData]) =>
              Effect.gen(function* () {
                // 早期スキップ: 既に解放済みまたは自動解放無効
                if (acc.updatedState.unlockedRecipes.has(recipeId) || !unlockData.autoUnlock) {
                  return acc
                }

                const conditionsMet = yield* checkUnlockConditions(acc.updatedState, unlockData)
                if (!conditionsMet) {
                  return acc
                }

                const unlockResult = yield* unlockRecipe(acc.updatedState, recipeId).pipe(
                  Effect.option // エラーを無視して続行
                )

                return pipe(
                  unlockResult,
                  Option.match({
                    onNone: () => acc,
                    onSome: (newState) => ({
                      updatedState: newState,
                      unlockedRecipes: [...acc.unlockedRecipes, recipeId],
                    }),
                  })
                )
              })
          )
        )

        currentState = finalState
        unlockedRecipes.push(...newlyUnlocked)

        return {
          updatedState: currentState,
          unlockedRecipes,
        }
      })

    const getAvailableRecipes = (playerState: PlayerUnlockState): Effect.Effect<ReadonlyArray<RecipeId>> =>
      Effect.succeed(Array.from(playerState.unlockedRecipes))

    return {
      checkUnlockConditions,
      unlockRecipe,
      autoUnlockRecipes,
      getAvailableRecipes,
    }
  })
)

// 解放条件初期化ユーティリティ
const initializeUnlockData = (): Map<RecipeId, RecipeUnlockData> => {
  const unlockData = new Map<RecipeId, RecipeUnlockData>()

  // サンプルレシピ解放条件
  unlockData.set(Brand.nominal<RecipeId>('minecraft:wooden_pickaxe'), {
    _tag: 'RecipeUnlockData' as const,
    recipeId: Brand.nominal<RecipeId>('minecraft:wooden_pickaxe'),
    conditions: [
      {
        _tag: 'item_obtained' as const,
        itemId: Brand.nominal<ItemId>('minecraft:wood'),
        count: Brand.nominal<ItemStackCount>(1),
      },
    ],
    autoUnlock: true,
    category: { _tag: 'crafting' as const },
  })

  unlockData.set(Brand.nominal<RecipeId>('minecraft:iron_sword'), {
    _tag: 'RecipeUnlockData' as const,
    recipeId: Brand.nominal<RecipeId>('minecraft:iron_sword'),
    conditions: [
      {
        _tag: 'item_obtained' as const,
        itemId: Brand.nominal<ItemId>('minecraft:iron_ingot'),
        count: Brand.nominal<ItemStackCount>(2),
      },
    ],
    autoUnlock: true,
    category: { _tag: 'crafting' as const },
  })

  return unlockData
}
```

## 7. パフォーマンス最適化

### 7.1 レシピキャッシュ

```typescript
// キャッシュキー型定義
export type CacheKey = string & Brand.Brand<'CacheKey'>
export const CacheKey = Schema.String.pipe(Schema.brand('CacheKey'))

// キャッシュエントリ
export const CacheEntry = Schema.Struct({
  _tag: Schema.Literal('CacheEntry'),
  recipe: CraftingRecipe,
  timestamp: Schema.Number,
  accessCount: Schema.Number.pipe(Schema.nonNegative()),
})
export interface CacheEntry extends Schema.Schema.Type<typeof CacheEntry> {}

// キャッシュ統計情報
export const CacheStats = Schema.Struct({
  _tag: Schema.Literal('CacheStats'),
  hits: Schema.Number.pipe(Schema.nonNegative()),
  misses: Schema.Number.pipe(Schema.nonNegative()),
  evictions: Schema.Number.pipe(Schema.nonNegative()),
  size: Schema.Number.pipe(Schema.nonNegative()),
  maxSize: Schema.Number.pipe(Schema.positive()),
})
export interface CacheStats extends Schema.Schema.Type<typeof CacheStats> {}

// レシピキャッシュサービスインターフェース
export interface RecipeCacheService {
  readonly get: (key: CacheKey) => Effect.Effect<Option.Option<CraftingRecipe>>
  readonly set: (key: CacheKey, recipe: CraftingRecipe) => Effect.Effect<void>
  readonly invalidate: (key: CacheKey) => Effect.Effect<void>
  readonly clear: () => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<CacheStats>
}

export const RecipeCacheService = Context.GenericTag<RecipeCacheService>('@minecraft/RecipeCacheService')

// LRUキャッシュ実装
export const RecipeCacheServiceLive = Layer.scoped(
  RecipeCacheService,
  Effect.gen(function* () {
    const maxSize = 1000
    const cache = yield* SynchronizedRef.make(new Map<CacheKey, CacheEntry>())
    const stats = yield* SynchronizedRef.make<CacheStats>({
      _tag: 'CacheStats' as const,
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize,
    })

    // 定期クリーンアップタスク
    const cleanupFiber = yield* Effect.fork(
      Effect.schedule(
        Effect.gen(function* () {
          const now = Date.now()
          const maxAge = 30 * 60 * 1000 // 30分

          yield* SynchronizedRef.updateEffect(cache, (cacheMap) =>
            Effect.gen(function* () {
              const newMap = new Map(cacheMap)
              let evictedCount = 0

              for (const [key, entry] of newMap.entries()) {
                if (now - entry.timestamp > maxAge) {
                  newMap.delete(key)
                  evictedCount++
                }
              }

              if (evictedCount > 0) {
                yield* SynchronizedRef.update(stats, (s) => ({
                  ...s,
                  evictions: s.evictions + evictedCount,
                  size: newMap.size,
                }))
                yield* Effect.log(`Cache cleanup: evicted ${evictedCount} entries`)
              }

              return newMap
            })
          )
        }),
        Schedule.fixed('5 minutes')
      )
    )

    // クリーンアップ登録
    yield* Effect.addFinalizer(() => Fiber.interrupt(cleanupFiber))

    const evictLRU = (cacheMap: Map<CacheKey, CacheEntry>): Map<CacheKey, CacheEntry> => {
      if (cacheMap.size <= maxSize) return cacheMap

      // LRUアルゴリズム: アクセス回数と時間を考慮
      const entries = Array.from(cacheMap.entries())
      entries.sort(([, a], [, b]) => {
        const scoreA = a.accessCount * 0.7 + (Date.now() - a.timestamp) * 0.3
        const scoreB = b.accessCount * 0.7 + (Date.now() - b.timestamp) * 0.3
        return scoreA - scoreB
      })

      const toEvict = entries.slice(0, Math.floor(maxSize * 0.1)) // 10%を削除
      const newMap = new Map(cacheMap)
      for (const [key] of toEvict) {
        newMap.delete(key)
      }

      return newMap
    }

    const get = (key: CacheKey): Effect.Effect<Option.Option<CraftingRecipe>> =>
      Effect.gen(function* () {
        const cacheMap = yield* SynchronizedRef.get(cache)
        const entry = cacheMap.get(key)

        if (entry) {
          // キャッシュヒット: アクセス回数とタイムスタンプ更新
          yield* SynchronizedRef.update(cache, (map) => {
            const newMap = new Map(map)
            newMap.set(key, {
              ...entry,
              timestamp: Date.now(),
              accessCount: entry.accessCount + 1,
            })
            return newMap
          })

          yield* SynchronizedRef.update(stats, (s) => ({ ...s, hits: s.hits + 1 }))
          return Option.some(entry.recipe)
        }

        yield* SynchronizedRef.update(stats, (s) => ({ ...s, misses: s.misses + 1 }))
        return Option.none()
      })

    const set = (key: CacheKey, recipe: CraftingRecipe): Effect.Effect<void> =>
      Effect.gen(function* () {
        const entry: CacheEntry = {
          _tag: 'CacheEntry' as const,
          recipe,
          timestamp: Date.now(),
          accessCount: 1,
        }

        yield* SynchronizedRef.updateEffect(cache, (cacheMap) =>
          Effect.gen(function* () {
            let newMap = new Map(cacheMap)
            newMap.set(key, entry)

            // サイズ制限チェック
            if (newMap.size > maxSize) {
              newMap = evictLRU(newMap)
              yield* SynchronizedRef.update(stats, (s) => ({
                ...s,
                evictions: s.evictions + 1,
              }))
            }

            yield* SynchronizedRef.update(stats, (s) => ({
              ...s,
              size: newMap.size,
            }))

            return newMap
          })
        )
      })

    const invalidate = (key: CacheKey): Effect.Effect<void> =>
      SynchronizedRef.update(cache, (map) => {
        const newMap = new Map(map)
        const deleted = newMap.delete(key)
        if (deleted) {
          SynchronizedRef.update(stats, (s) => ({ ...s, size: newMap.size }))
        }
        return newMap
      })

    const clear = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* SynchronizedRef.set(cache, new Map())
        yield* SynchronizedRef.update(stats, (s) => ({ ...s, size: 0 }))
      })

    const getStats = (): Effect.Effect<CacheStats> => SynchronizedRef.get(stats)

    return { get, set, invalidate, clear, getStats }
  })
)

// グリッドキー生成ユーティリティ
const gridToCacheKey = (grid: CraftingGrid): CacheKey => {
  const normalizedSlots = grid.slots
    .map((row) => row.map((slot) => (slot ? `${slot.itemId}:${slot.count}` : '_')).join('|'))
    .join('#')

  return Brand.nominal<CacheKey>(`${grid.width}x${grid.height}:${normalizedSlots}`)
}
```

### 7.2 インデックス最適化

```typescript
// パフォーマンス最適化サービスインターフェース
export interface RecipeSearchOptimizationService {
  readonly quickMatch: (grid: CraftingGrid) => Effect.Effect<Option.Option<CraftingRecipe>>

  readonly preloadPatterns: (recipes: ReadonlyArray<CraftingRecipe>) => Effect.Effect<void>

  readonly getSearchMetrics: () => Effect.Effect<SearchMetrics>
}

export const RecipeSearchOptimizationService = Context.GenericTag<RecipeSearchOptimizationService>(
  '@minecraft/RecipeSearchOptimizationService'
)

// 検索メトリクス
export const SearchMetrics = Schema.Struct({
  _tag: Schema.Literal('SearchMetrics'),
  totalSearches: Schema.Number.pipe(Schema.nonNegative()),
  cacheHits: Schema.Number.pipe(Schema.nonNegative()),
  bloomFilterRejects: Schema.Number.pipe(Schema.nonNegative()),
  averageSearchTime: Schema.Number.pipe(Schema.nonNegative()),
})
export interface SearchMetrics extends Schema.Schema.Type<typeof SearchMetrics> {}

// 最適化されたレシピ検索サービス実装
export const RecipeSearchOptimizationServiceLive = Layer.scoped(
  RecipeSearchOptimizationService,
  Effect.gen(function* () {
    const cacheService = yield* RecipeCacheService
    const recipeRegistry = yield* RecipeRegistryService

    // ブルームフィルタ初期化（メモ化）
    const bloomFilter = yield* createOptimizedBloomFilter(10000, 0.01) // 1%の偏偏率
    const memoizedBloomCheck = yield* Effect.cachedFunction((itemId: ItemId) => bloomFilter.mightContain(itemId))

    // パターンインデックス（非同期初期化）
    const patternIndex = yield* SynchronizedRef.make(new Map<string, ReadonlyArray<CraftingRecipe>>())

    // 検索メトリクス
    const metrics = yield* SynchronizedRef.make<SearchMetrics>({
      _tag: 'SearchMetrics' as const,
      totalSearches: 0,
      cacheHits: 0,
      bloomFilterRejects: 0,
      averageSearchTime: 0,
    })

    // パフォーマンス監視ファイバー
    const monitoringFiber = yield* Effect.fork(
      Effect.schedule(
        Effect.gen(function* () {
          const currentMetrics = yield* SynchronizedRef.get(metrics)
          if (currentMetrics.totalSearches % 1000 === 0 && currentMetrics.totalSearches > 0) {
            yield* Effect.log(`Recipe search metrics: ${JSON.stringify(currentMetrics)}`)
          }
        }),
        Schedule.fixed('30 seconds')
      )
    )

    yield* Effect.addFinalizer(() => Fiber.interrupt(monitoringFiber))

    const preloadPatterns = (recipes: ReadonlyArray<CraftingRecipe>): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Effect.log(`Preloading ${recipes.length} recipe patterns...`)
        const startTime = Date.now()

        // ブルームフィルタにアイテムIDを追加
        for (const recipe of recipes) {
          const ingredients = extractRecipeIngredients(recipe)
          for (const itemId of ingredients) {
            yield* bloomFilter.add(itemId)
          }
        }

        // パターンインデックスを構築
        const patterns = new Map<string, ReadonlyArray<CraftingRecipe>>()
        for (const recipe of recipes) {
          const patternKey = generatePatternKey(recipe)
          const existing = patterns.get(patternKey) ?? []
          patterns.set(patternKey, [...existing, recipe])
        }

        yield* SynchronizedRef.set(patternIndex, patterns)

        const duration = Date.now() - startTime
        yield* Effect.log(`Recipe patterns preloaded in ${duration}ms`)
      })

    const quickMatch = (grid: CraftingGrid): Effect.Effect<Option.Option<CraftingRecipe>> =>
      Effect.gen(function* () {
        const startTime = Date.now()
        yield* SynchronizedRef.update(metrics, (m) => ({ ...m, totalSearches: m.totalSearches + 1 }))

        // Step 1: キャッシュチェック（早期リターン）
        const cacheKey = gridToCacheKey(grid)
        const cached = yield* cacheService.get(cacheKey)
        if (Option.isSome(cached)) {
          yield* SynchronizedRef.update(metrics, (m) => ({ ...m, cacheHits: m.cacheHits + 1 }))
          yield* updateSearchTime(startTime)
          return cached
        }

        // Step 2: グリッドからアイテム抽出
        const gridService = yield* CraftingGridService
        const items = yield* gridService.extractItems(grid)

        // Step 3: ブルームフィルターで高速除外（早期リターン）
        const hasViableItems = yield* Effect.gen(function* () {
          for (const item of items) {
            const mightMatch = yield* memoizedBloomCheck(item.itemId)
            if (mightMatch) return true
          }
          return false
        })

        if (!hasViableItems) {
          yield* SynchronizedRef.update(metrics, (m) => ({ ...m, bloomFilterRejects: m.bloomFilterRejects + 1 }))
          yield* updateSearchTime(startTime)
          return Option.none()
        }

        // Step 4: パターンベース検索
        const patternKey = gridToPatternKey(grid)
        const indexMap = yield* SynchronizedRef.get(patternIndex)
        const candidateRecipes = indexMap.get(patternKey) ?? []

        // Step 5: 詳細マッチング（並列処理）
        const matchingRecipe = yield* Effect.gen(function* () {
          for (const recipe of candidateRecipes) {
            const matches = yield* gridService.matchesRecipe(grid, recipe)
            if (matches) {
              // キャッシュに保存
              yield* cacheService.set(cacheKey, recipe)
              return Option.some(recipe)
            }
          }
          return Option.none<CraftingRecipe>()
        })

        yield* updateSearchTime(startTime)
        return matchingRecipe
      })

    const updateSearchTime = (startTime: number): Effect.Effect<void> =>
      Effect.gen(function* () {
        const duration = Date.now() - startTime
        yield* SynchronizedRef.update(metrics, (m) => {
          const newAverage = (m.averageSearchTime * (m.totalSearches - 1) + duration) / m.totalSearches
          return { ...m, averageSearchTime: newAverage }
        })
      })

    const getSearchMetrics = (): Effect.Effect<SearchMetrics> => SynchronizedRef.get(metrics)

    return {
      quickMatch,
      preloadPatterns,
      getSearchMetrics,
    }
  })
)

// ユーティリティ関数
const extractRecipeIngredients = (recipe: CraftingRecipe): ReadonlyArray<ItemId> => {
  return Match.value(recipe).pipe(
    Match.tag('shaped', ({ ingredients }) => {
      return Object.values(ingredients).flatMap((matcher) => extractMatcherItemIds(matcher))
    }),
    Match.tag('shapeless', ({ ingredients }) => {
      return ingredients.flatMap((matcher) => extractMatcherItemIds(matcher))
    }),
    Match.exhaustive
  )
}

const extractMatcherItemIds = (matcher: ItemMatcher): ReadonlyArray<ItemId> => {
  return Match.value(matcher).pipe(
    Match.tag('exact', ({ itemId }) => [itemId]),
    Match.tag('tag', ({ tag }) => getItemIdsByTag(tag)),
    Match.tag('custom', () => []), // カスタムマッチャーはスキップ
    Match.exhaustive
  )
}

const getItemIdsByTag = (tag: string): ReadonlyArray<ItemId> => {
  // タグからアイテムIDを解決するロジック
  const tagMap: Record<string, ReadonlyArray<string>> = {
    'minecraft:planks': ['minecraft:oak_planks', 'minecraft:birch_planks', 'minecraft:spruce_planks'],
    'minecraft:logs': ['minecraft:oak_log', 'minecraft:birch_log', 'minecraft:spruce_log'],
  }

  return (tagMap[tag] ?? []).map((id) => Brand.nominal<ItemId>(id))
}

const generatePatternKey = (recipe: CraftingRecipe): string => {
  return Match.value(recipe).pipe(
    Match.tag('shaped', ({ pattern, ingredients }) => {
      const normalizedPattern = pattern.map((row) => row.map((cell) => cell ?? '_').join('|')).join('#')
      const ingredientKeys = Object.keys(ingredients).sort().join(',')
      return `shaped:${normalizedPattern}:${ingredientKeys}`
    }),
    Match.tag('shapeless', ({ ingredients }) => {
      const ingredientPattern = ingredients
        .map((ingredient) => ingredient._tag)
        .sort()
        .join(',')
      return `shapeless:${ingredientPattern}`
    }),
    Match.exhaustive
  )
}

const gridToPatternKey = (grid: CraftingGrid): string => {
  // グリッドをパターンキーに変換（簡略化）
  const hasItems = grid.slots.some((row) => row.some((slot) => slot !== undefined))
  const itemCount = grid.slots.flat().filter((slot) => slot !== undefined).length

  if (!hasItems) return 'empty'
  if (itemCount === 1) return 'single'
  if (itemCount <= 4) return 'small'
  return 'complex'
}

// ブルームフィルター実装（シンプル版）
const createOptimizedBloomFilter = (
  expectedElements: number,
  falsePositiveRate: number
): Effect.Effect<{
  add: (item: ItemId) => Effect.Effect<void>
  mightContain: (item: ItemId) => boolean
}> =>
  Effect.gen(function* () {
    const bitArraySize = Math.ceil((-expectedElements * Math.log(falsePositiveRate)) / Math.log(2) ** 2)
    const numHashFunctions = Math.ceil((bitArraySize / expectedElements) * Math.log(2))
    const bitArray = new Uint8Array(Math.ceil(bitArraySize / 8))

    const hash = (item: string, seed: number): number => {
      let hash = seed
      for (let i = 0; i < item.length; i++) {
        hash = ((hash << 5) - hash + item.charCodeAt(i)) & 0xffffffff
      }
      return Math.abs(hash) % bitArraySize
    }

    const setBit = (index: number): void => {
      const byteIndex = Math.floor(index / 8)
      const bitIndex = index % 8
      bitArray[byteIndex] |= 1 << bitIndex
    }

    const getBit = (index: number): boolean => {
      const byteIndex = Math.floor(index / 8)
      const bitIndex = index % 8
      return (bitArray[byteIndex] & (1 << bitIndex)) !== 0
    }

    return {
      add: (item: ItemId) =>
        Effect.sync(() => {
          for (let i = 0; i < numHashFunctions; i++) {
            const index = hash(item, i)
            setBit(index)
          }
        }),

      mightContain: (item: ItemId): boolean => {
        for (let i = 0; i < numHashFunctions; i++) {
          const index = hash(item, i)
          if (!getBit(index)) return false
        }
        return true
      },
    }
  })
```

## 8. まとめ

クラフティングシステムは、Effect-TS 3.17+の最新パターンを活用して、以下の特徴を実現しています：

### アーキテクチャの特徴

- **Schema.TaggedUnion**: レシピやアイテムマッチャーの型安全な表現
- **Branded Types**: RecipeId、ItemId、ItemStackCount等の型レベルセキュリティ
- **Context Pattern**: サービスの依存性注入とテスト容易性
- **Match.value**: パターンマッチングによる安全な分岐処理

### 機能的特徴

- **柔軟性**: 形状付き/形状なし、精錬、エンチャント等の多様なクラフティングに対応
- **拡張性**: カスタムマッチャー、解放条件、エンチャント系統等
- **パフォーマンス**: LRUキャッシュ、ブルームフィルター、パターンインデックスによる高速化

### Effect-TSベストプラクティス

- **早期リターン**: 条件チェックでのパフォーマンス最適化
- **浅いネスト**: 最大3レベルのネスト制限で可読性向上
- **Schema.TaggedError**: 構造化されたエラーハンドリング
- **Property-based Testing**: Fast-Checkとの統合で堅牢なテスト

### 統合性と保守性

- **ECSアーキテクチャ**: コンポーネントベース設計とのシームレス連携
- **インベントリシステム**: アイテム管理との自然な統合
- **イベントドリブン**: クラフティングイベントの非同期発行と処理
- **レイヤードアーキテクチャ**: サービス層の明確な分離

### 実装品質

- **型安全**: コンパイル時エラー検出とランタイムセーフティ
- **メモリ効率**: SynchronizedRef、メモ化、リソース管理
- **同期/非同期**: Fiberと Effectによる適切な並行性制御
- **監視性**: メトリクス、ログ、パフォーマンス計測
