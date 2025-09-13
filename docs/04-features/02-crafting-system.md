# クラフティングシステム

## 1. 概要

Minecraft クローンのクラフティングシステムは、アイテムの組み合わせによる新しいアイテムの作成を管理します。Effect-TS による型安全な実装と、ECS アーキテクチャとの統合を特徴とします。

## 2. レシピシステム

### 2.1 レシピ定義

```typescript
import { Schema, Effect, ReadonlyArray, Option } from "effect"

// レシピ型定義
export const CraftingRecipe = Schema.Struct({
  id: Schema.String,
  pattern: Schema.Array(Schema.Array(Schema.optional(Schema.String))),
  ingredients: Schema.Record(Schema.String, ItemMatcher),
  result: ItemStack,
  shapeless: Schema.optional(Schema.Boolean),
  category: Schema.Literal("crafting", "smelting", "smithing", "stonecutting")
})

export type CraftingRecipe = Schema.Schema.Type<typeof CraftingRecipe>

// アイテムマッチャー
export const ItemMatcher = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("exact"),
    itemId: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal("tag"),
    tag: Schema.String  // "minecraft:planks", "minecraft:logs" など
  }),
  Schema.Struct({
    type: Schema.Literal("custom"),
    matcher: Schema.Unknown  // カスタムマッチング関数
  })
)

export type ItemMatcher = Schema.Schema.Type<typeof ItemMatcher>
```

### 2.2 レシピ登録と検索

```typescript
// レシピレジストリ
export interface RecipeRegistry {
  readonly recipes: ReadonlyMap<RecipeId, CraftingRecipe>
  readonly byResult: ReadonlyMap<ItemId, ReadonlyArray<CraftingRecipe>>
  readonly byCategory: ReadonlyMap<RecipeCategory, ReadonlyArray<CraftingRecipe>>
}

export const RecipeRegistryOperations = {
  // レシピ登録
  register: (
    registry: RecipeRegistry,
    recipe: CraftingRecipe
  ): Effect.Effect<RecipeRegistry, RegistrationError> =>
    Effect.gen(function* () {
      // 重複チェック
      if (registry.recipes.has(recipe.id)) {
        return yield* new DuplicateRecipeError({ recipeId: recipe.id })
      }

      // レシピ検証
      yield* validateRecipe(recipe)

      return {
        recipes: new Map([...registry.recipes, [recipe.id, recipe]]),
        byResult: updateResultIndex(registry.byResult, recipe),
        byCategory: updateCategoryIndex(registry.byCategory, recipe)
      }
    }),

  // パターンマッチング
  findMatchingRecipe: (
    registry: RecipeRegistry,
    grid: CraftingGrid
  ): Effect.Effect<Option.Option<CraftingRecipe>, MatchError> =>
    Effect.gen(function* () {
      // 形状付きレシピの検索
      const shapedMatch = yield* findShapedMatch(registry.recipes, grid)
      if (Option.isSome(shapedMatch)) return shapedMatch

      // 形状なしレシピの検索
      const shapelessMatch = yield* findShapelessMatch(registry.recipes, grid)
      return shapelessMatch
    })
}
```

## 3. クラフティンググリッド

### 3.1 グリッド実装

```typescript
// クラフティンググリッド
export interface CraftingGrid {
  readonly width: number
  readonly height: number
  readonly slots: ReadonlyArray<ReadonlyArray<Option.Option<ItemStack>>>
}

export const CraftingGridOperations = {
  // グリッド正規化（空行・列の削除）
  normalize: (grid: CraftingGrid): NormalizedGrid => {
    const bounds = findContentBounds(grid)
    return extractSubGrid(grid, bounds)
  },

  // パターンマッチング
  matchesPattern: (
    grid: CraftingGrid,
    pattern: ReadonlyArray<ReadonlyArray<Option.Option<string>>>,
    ingredients: Record<string, ItemMatcher>
  ): boolean => {
    const normalizedGrid = CraftingGridOperations.normalize(grid)
    const normalizedPattern = normalizePattern(pattern)

    // サイズチェック
    if (normalizedGrid.width !== normalizedPattern.width ||
        normalizedGrid.height !== normalizedPattern.height) {
      return false
    }

    // 各スロットのマッチング
    for (let y = 0; y < normalizedGrid.height; y++) {
      for (let x = 0; x < normalizedGrid.width; x++) {
        const gridItem = normalizedGrid.slots[y][x]
        const patternKey = normalizedPattern.slots[y][x]

        if (!matchesIngredient(gridItem, patternKey, ingredients)) {
          return false
        }
      }
    }

    return true
  },

  // 回転・反転を考慮したマッチング
  matchesWithTransforms: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const transforms = [
        identity,
        rotate90,
        rotate180,
        rotate270,
        flipHorizontal,
        flipVertical
      ]

      for (const transform of transforms) {
        const transformedPattern = transform(recipe.pattern)
        if (CraftingGridOperations.matchesPattern(
          grid,
          transformedPattern,
          recipe.ingredients
        )) {
          return true
        }
      }

      return false
    })
}
```

### 3.2 形状なしクラフティング

```typescript
export const ShapelessCrafting = {
  // 形状なしレシピのマッチング
  matchesShapeless: (
    items: ReadonlyArray<ItemStack>,
    recipe: CraftingRecipe
  ): boolean => {
    if (!recipe.shapeless) return false

    const requiredItems = extractRequiredItems(recipe)
    const providedItems = [...items]

    // 各必要アイテムをチェック
    for (const [ingredient, count] of requiredItems) {
      let remaining = count

      for (let i = 0; i < providedItems.length; i++) {
        const item = providedItems[i]
        if (matchesIngredient(Option.some(item), ingredient, recipe.ingredients)) {
          const consumed = Math.min(remaining, item.count)
          remaining -= consumed
          providedItems[i] = { ...item, count: item.count - consumed }

          if (remaining === 0) break
        }
      }

      if (remaining > 0) return false
    }

    // 余剰アイテムチェック
    return providedItems.every(item => item.count === 0)
  }
}
```

## 4. クラフティング実行

### 4.1 クラフティングプロセス

```typescript
export const CraftingProcess = {
  // クラフティング実行
  craft: (
    grid: CraftingGrid,
    recipe: CraftingRecipe,
    player: Player
  ): Effect.Effect<CraftingResult, CraftingError> =>
    Effect.gen(function* () {
      // 権限チェック
      yield* checkCraftingPermissions(player, recipe)

      // 材料消費
      const consumedGrid = yield* consumeIngredients(grid, recipe)

      // 結果生成
      const result = yield* generateResult(recipe, player)

      // 統計更新
      yield* updateCraftingStats(player, recipe)

      // イベント発行
      yield* emitCraftingEvent({
        player,
        recipe,
        result,
        timestamp: Date.now()
      })

      return {
        grid: consumedGrid,
        result,
        recipe
      }
    }),

  // 材料消費
  consumeIngredients: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ): Effect.Effect<CraftingGrid, ConsumptionError> =>
    Effect.gen(function* () {
      const updatedSlots = [...grid.slots.map(row => [...row])]

      if (recipe.shapeless) {
        // 形状なしレシピの消費
        yield* consumeShapeless(updatedSlots, recipe)
      } else {
        // 形状付きレシピの消費
        yield* consumeShaped(updatedSlots, recipe)
      }

      return { ...grid, slots: updatedSlots }
    }),

  // ツール耐久度処理
  handleToolDurability: (
    grid: CraftingGrid
  ): Effect.Effect<CraftingGrid> =>
    Effect.gen(function* () {
      const updated = [...grid.slots]

      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const item = updated[y][x]

          if (Option.isSome(item) && isTool(item.value)) {
            const damaged = reduceDurability(item.value, 1)

            updated[y][x] = damaged.metadata?.durability === 0
              ? Option.none()  // ツール破壊
              : Option.some(damaged)
          }
        }
      }

      return { ...grid, slots: updated }
    })
}
```

## 5. 特殊クラフティング

### 5.1 かまどレシピ

```typescript
export const FurnaceRecipe = Schema.Struct({
  id: Schema.String,
  input: ItemMatcher,
  output: ItemStack,
  experience: Schema.Number,
  cookingTime: Schema.Number,  // ティック単位
  fuelValue: Schema.optional(Schema.Number)
})

export type FurnaceRecipe = Schema.Schema.Type<typeof FurnaceRecipe>

export const FurnaceCrafting = {
  // 精錬プロセス
  smelt: (
    furnace: FurnaceState,
    deltaTime: number
  ): Effect.Effect<FurnaceState, SmeltingError> =>
    Effect.gen(function* () {
      // 燃料チェック
      if (furnace.fuelRemaining <= 0) {
        const fuel = yield* consumeFuel(furnace)
        if (Option.isNone(fuel)) {
          return { ...furnace, isSmelting: false }
        }
      }

      // 精錬進行
      const progress = furnace.smeltProgress + deltaTime
      const recipe = yield* getCurrentRecipe(furnace)

      if (progress >= recipe.cookingTime) {
        // 完成
        const result = yield* completeSmelt(furnace, recipe)
        return {
          ...result,
          smeltProgress: 0,
          experience: furnace.experience + recipe.experience
        }
      }

      return {
        ...furnace,
        smeltProgress: progress,
        fuelRemaining: furnace.fuelRemaining - deltaTime
      }
    })
}
```

### 5.2 エンチャントテーブル

```typescript
export const EnchantingRecipe = Schema.Struct({
  item: ItemMatcher,
  enchantments: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      level: Schema.Number,
      cost: Schema.Number  // 経験値コスト
    })
  ),
  requiredBookshelves: Schema.Number
})

export const EnchantingSystem = {
  // エンチャント可能性計算
  calculateEnchantability: (
    item: ItemStack,
    bookshelves: number,
    playerLevel: number
  ): ReadonlyArray<PossibleEnchantment> => {
    const itemEnchantability = getEnchantability(item)
    const power = Math.min(bookshelves, 15) * 2

    return generateEnchantmentOptions(
      itemEnchantability,
      power,
      playerLevel
    )
  },

  // エンチャント適用
  applyEnchantment: (
    item: ItemStack,
    enchantment: Enchantment,
    playerLevel: number
  ): Effect.Effect<ItemStack, EnchantError> =>
    Effect.gen(function* () {
      // レベルチェック
      if (playerLevel < enchantment.cost) {
        return yield* new InsufficientLevelError({
          required: enchantment.cost,
          current: playerLevel
        })
      }

      // 競合チェック
      const conflicts = checkEnchantmentConflicts(item, enchantment)
      if (conflicts.length > 0) {
        return yield* new EnchantmentConflictError({ conflicts })
      }

      // エンチャント追加
      return {
        ...item,
        metadata: {
          ...item.metadata,
          enchantments: [
            ...(item.metadata?.enchantments ?? []),
            `${enchantment.id}:${enchantment.level}`
          ]
        }
      }
    })
}
```

## 6. レシピ解放システム

```typescript
export const RecipeUnlockSystem = {
  // レシピ解放条件
  checkUnlockConditions: (
    player: Player,
    recipe: CraftingRecipe
  ): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const conditions = yield* getRecipeConditions(recipe.id)

      for (const condition of conditions) {
        const met = yield* evaluateCondition(player, condition)
        if (!met) return false
      }

      return true
    }),

  // 自動解放
  autoUnlockRecipes: (
    player: Player,
    obtainedItem: ItemStack
  ): Effect.Effect<ReadonlyArray<RecipeId>> =>
    Effect.gen(function* () {
      const unlocked: RecipeId[] = []
      const recipes = yield* getAllRecipes()

      for (const recipe of recipes) {
        if (player.unlockedRecipes.has(recipe.id)) continue

        const ingredients = getRecipeIngredients(recipe)
        if (ingredients.includes(obtainedItem.itemId)) {
          yield* unlockRecipe(player, recipe.id)
          unlocked.push(recipe.id)
        }
      }

      return unlocked
    })
}
```

## 7. パフォーマンス最適化

### 7.1 レシピキャッシュ

```typescript
export const RecipeCache = {
  // LRUキャッシュ実装
  cache: new Map<string, CraftingRecipe>(),
  maxSize: 100,

  getCached: (
    grid: CraftingGrid
  ): Option.Option<CraftingRecipe> => {
    const key = gridToKey(grid)
    const cached = RecipeCache.cache.get(key)

    if (cached) {
      // LRU更新
      RecipeCache.cache.delete(key)
      RecipeCache.cache.set(key, cached)
      return Option.some(cached)
    }

    return Option.none()
  },

  setCached: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ): void => {
    const key = gridToKey(grid)

    if (RecipeCache.cache.size >= RecipeCache.maxSize) {
      // 最も古いエントリを削除
      const firstKey = RecipeCache.cache.keys().next().value
      RecipeCache.cache.delete(firstKey)
    }

    RecipeCache.cache.set(key, recipe)
  }
}
```

### 7.2 インデックス最適化

```typescript
export const OptimizedRecipeSearch = {
  // ブルームフィルタによる高速除外
  bloomFilter: createBloomFilter<ItemId>(),

  // トライ木によるパターン検索
  patternTrie: createPatternTrie<CraftingRecipe>(),

  quickMatch: (
    grid: CraftingGrid
  ): Effect.Effect<Option.Option<CraftingRecipe>> =>
    Effect.gen(function* () {
      // キャッシュチェック
      const cached = RecipeCache.getCached(grid)
      if (Option.isSome(cached)) return cached

      // ブルームフィルタで候補絞り込み
      const items = extractItems(grid)
      const candidates = items.filter(item =>
        OptimizedRecipeSearch.bloomFilter.mightContain(item.itemId)
      )

      if (candidates.length === 0) return Option.none()

      // トライ木検索
      const pattern = gridToPattern(grid)
      const matches = OptimizedRecipeSearch.patternTrie.search(pattern)

      if (matches.length > 0) {
        RecipeCache.setCached(grid, matches[0])
        return Option.some(matches[0])
      }

      return Option.none()
    })
}
```

## 8. まとめ

クラフティングシステムは：
- **柔軟性**: 形状付き/形状なし、特殊クラフティングに対応
- **拡張性**: カスタムマッチャーと条件システム
- **パフォーマンス**: キャッシュとインデックスによる高速化
- **型安全**: Effect-TS による完全な型定義
- **統合性**: ECS とインベントリシステムとのシームレスな連携