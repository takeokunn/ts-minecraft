# Crafting System - クラフトシステム

## 概要

Crafting Systemは、Minecraftの創造性の核となるシステムです。レシピ定義、クラフトテーブルメカニクス、無形/有形レシピ、レシピ発見、精錬/かまどシステムなどを担当し、プレイヤーが原材料から様々なアイテムを作成できる包括的なクラフト体験を提供します。

## アーキテクチャ

### Domain Model（Effect-TS + DDD）

```typescript
import { Effect, Layer, Context, Schema, Match, pipe } from "effect"
import { Brand } from "effect"

// Value Objects
export const RecipeId = Schema.String.pipe(Schema.brand("RecipeId"))
export const CraftingGridSize = Schema.Literal(2, 3) // 2x2 or 3x3
export const SmeltingTime = pipe(Schema.Number, Schema.int(), Schema.positive()) // ticks

export const Ingredient = Schema.Struct({
  itemId: ItemId,
  count: pipe(Schema.Number, Schema.int(), Schema.positive()),
  metadata: Schema.Optional(Schema.Record(Schema.String, Schema.Unknown)),
  alternatives: Schema.Optional(Schema.Array(ItemId)) // 代替可能なアイテム
})

export type Ingredient = Schema.Schema.Type<typeof Ingredient>

export const CraftingResult = Schema.Struct({
  itemStack: ItemStack,
  experience: Schema.Optional(pipe(Schema.Number, Schema.nonNegative())),
  byproducts: Schema.Optional(Schema.Array(ItemStack)) // 副産物
})

export type CraftingResult = Schema.Schema.Type<typeof CraftingResult>

// Entities
export const ShapedRecipe = Schema.Struct({
  recipeId: RecipeId,
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  category: Schema.String,
  gridSize: CraftingGridSize,
  pattern: Schema.Array(Schema.Array(Schema.Optional(Ingredient))), // 2D pattern
  result: CraftingResult,
  unlockRequirements: Schema.Optional(Schema.Array(Schema.String)),
  requiredTool: Schema.Optional(ItemId),
  difficulty: pipe(Schema.Number, Schema.int(), Schema.between(1, 5)),
  isDiscovered: Schema.Boolean,
  createdAt: Schema.DateTimeUtc
})

export type ShapedRecipe = Schema.Schema.Type<typeof ShapedRecipe>

export const ShapelessRecipe = Schema.Struct({
  recipeId: RecipeId,
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  category: Schema.String,
  ingredients: Schema.Array(Ingredient),
  result: CraftingResult,
  unlockRequirements: Schema.Optional(Schema.Array(Schema.String)),
  requiredTool: Schema.Optional(ItemId),
  difficulty: pipe(Schema.Number, Schema.int(), Schema.between(1, 5)),
  isDiscovered: Schema.Boolean,
  createdAt: Schema.DateTimeUtc
})

export type ShapelessRecipe = Schema.Schema.Type<typeof ShapelessRecipe>

export const SmeltingRecipe = Schema.Struct({
  recipeId: RecipeId,
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  category: Schema.String,
  input: Ingredient,
  fuel: Schema.Optional(Ingredient), // 特定の燃料が必要な場合
  result: CraftingResult,
  smeltingTime: SmeltingTime, // ティック数
  experience: pipe(Schema.Number, Schema.nonNegative()),
  unlockRequirements: Schema.Optional(Schema.Array(Schema.String)),
  difficulty: pipe(Schema.Number, Schema.int(), Schema.between(1, 5)),
  isDiscovered: Schema.Boolean,
  createdAt: Schema.DateTimeUtc
})

export type SmeltingRecipe = Schema.Schema.Type<typeof SmeltingRecipe>

export const BrewingRecipe = Schema.Struct({
  recipeId: RecipeId,
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  category: Schema.String,
  basePotion: ItemId,
  ingredient: Ingredient,
  result: CraftingResult,
  brewingTime: SmeltingTime,
  unlockRequirements: Schema.Optional(Schema.Array(Schema.String)),
  difficulty: pipe(Schema.Number, Schema.int(), Schema.between(1, 5)),
  isDiscovered: Schema.Boolean,
  createdAt: Schema.DateTimeUtc
})

export type BrewingRecipe = Schema.Schema.Type<typeof BrewingRecipe>

export const CraftingSession = Schema.Struct({
  sessionId: Schema.String.pipe(Schema.brand("CraftingSessionId")),
  playerId: PlayerId,
  craftingType: Schema.Literal("workbench", "inventory", "furnace", "brewing_stand", "anvil"),
  gridContents: Schema.Array(Schema.Optional(ItemStack)), // 9 slots for 3x3, 4 for 2x2
  resultSlot: Schema.Optional(ItemStack),
  currentRecipe: Schema.Optional(RecipeId),
  availableRecipes: Schema.Array(RecipeId),
  startTime: Schema.DateTimeUtc,
  lastActivity: Schema.DateTimeUtc
})

export type CraftingSession = Schema.Schema.Type<typeof CraftingSession>

export const CraftingHistory = Schema.Struct({
  playerId: PlayerId,
  craftedItems: Schema.Array(Schema.Struct({
    recipeId: RecipeId,
    itemStack: ItemStack,
    craftedAt: Schema.DateTimeUtc,
    experience: Schema.Number
  })),
  discoveredRecipes: Schema.Set(RecipeId),
  totalExperience: pipe(Schema.Number, Schema.nonNegative()),
  craftingLevel: pipe(Schema.Number, Schema.int(), Schema.between(1, 100)),
  specializations: Schema.Array(Schema.String), // "blacksmithing", "alchemy", etc.
  lastActivity: Schema.DateTimeUtc
})

export type CraftingHistory = Schema.Schema.Type<typeof CraftingHistory>

// Constants
export const CRAFTING_GRID_2X2 = 4
export const CRAFTING_GRID_3X3 = 9
export const FURNACE_SLOTS = 3 // input, fuel, output
export const BREWING_STAND_SLOTS = 4 // 3 potions + 1 ingredient
export const ANVIL_SLOTS = 3 // 2 input + 1 output
```

## レシピ定義システム

### Recipe Registry Service

```typescript
// IMPORTANT: Context7でEffect-TSの最新パターンを確認して実装

// RecipeRegistryサービスインターフェース
interface RecipeRegistryInterface {
  readonly registerShapedRecipe: (recipe: ShapedRecipe) => Effect.Effect<void, RecipeRegistrationError>
  readonly registerShapelessRecipe: (recipe: ShapelessRecipe) => Effect.Effect<void, RecipeRegistrationError>
  readonly registerSmeltingRecipe: (recipe: SmeltingRecipe) => Effect.Effect<void, RecipeRegistrationError>
  readonly registerBrewingRecipe: (recipe: BrewingRecipe) => Effect.Effect<void, RecipeRegistrationError>
  readonly getRecipe: (recipeId: RecipeId) => Effect.Effect<Recipe, RecipeNotFoundError>
  readonly findRecipesByCategory: (category: string) => Effect.Effect<ReadonlyArray<Recipe>, never>
  readonly findRecipesByResult: (itemId: ItemId) => Effect.Effect<ReadonlyArray<Recipe>, never>
  readonly getAllRecipes: () => Effect.Effect<ReadonlyArray<Recipe>, never>
  readonly validateRecipe: (recipe: Recipe) => Effect.Effect<ValidationResult, never>
}

// Context Tag
export const RecipeRegistry = Context.GenericTag<RecipeRegistryInterface>("@app/RecipeRegistry")

// Live実装の作成関数
const makeRecipeRegistry = Effect.gen(function* () {
  const itemRegistry = yield* ItemRegistry
  const recipeStorage = yield* Effect.sync(() => new Map<RecipeId, Recipe>())

  const registerShapedRecipe = (recipe: ShapedRecipe) =>
    Effect.gen(function* () {
      // レシピ検証
      const validation = yield* validateShapedRecipe(recipe)
      if (!validation.isValid) {
        return yield* Effect.fail(new RecipeRegistrationError(`Invalid recipe: ${validation.errors.join(", ")}`))
      }

      recipeStorage.set(recipe.recipeId, recipe)
      yield* logRecipeRegistration(recipe)
    })

  const registerShapelessRecipe = (recipe: ShapelessRecipe) =>
    Effect.gen(function* () {
      const validation = yield* validateShapelessRecipe(recipe)
      if (!validation.isValid) {
        return yield* Effect.fail(new RecipeRegistrationError(`Invalid recipe: ${validation.errors.join(", ")}`))
      }

      recipeStorage.set(recipe.recipeId, recipe)
      yield* logRecipeRegistration(recipe)
    })

  const registerSmeltingRecipe = (recipe: SmeltingRecipe) =>
    Effect.gen(function* () {
      const validation = yield* validateSmeltingRecipe(recipe)
      if (!validation.isValid) {
        return yield* Effect.fail(new RecipeRegistrationError(`Invalid recipe: ${validation.errors.join(", ")}`))
      }

      recipeStorage.set(recipe.recipeId, recipe)
      yield* logRecipeRegistration(recipe)
    })

  const registerBrewingRecipe = (recipe: BrewingRecipe) =>
    Effect.gen(function* () {
      const validation = yield* validateBrewingRecipe(recipe)
      if (!validation.isValid) {
        return yield* Effect.fail(new RecipeRegistrationError(`Invalid recipe: ${validation.errors.join(", ")}`))
      }

      recipeStorage.set(recipe.recipeId, recipe)
      yield* logRecipeRegistration(recipe)
    })

  const getRecipe = (recipeId: RecipeId) =>
    Effect.gen(function* () {
      const recipe = recipeStorage.get(recipeId)
      if (!recipe) {
        return yield* Effect.fail(new RecipeNotFoundError(recipeId))
      }
      return recipe
    })

  const findRecipesByCategory = (category: string) =>
    Effect.gen(function* () {
      const allRecipes = Array.from(recipeStorage.values())
      return allRecipes.filter(recipe => recipe.category === category)
    })

  const findRecipesByResult = (itemId: ItemId) =>
    Effect.gen(function* () {
      const allRecipes = Array.from(recipeStorage.values())
      return allRecipes.filter(recipe => recipe.result.itemStack.itemId === itemId)
    })

  const getAllRecipes = () =>
    Effect.succeed(Array.from(recipeStorage.values()))

  const validateRecipe = (recipe: Recipe) =>
    Effect.gen(function* () {
      return yield* Match.value(recipe).pipe(
        Match.tag("ShapedRecipe", (shapedRecipe) => validateShapedRecipe(shapedRecipe)),
        Match.tag("ShapelessRecipe", (shapelessRecipe) => validateShapelessRecipe(shapelessRecipe)),
        Match.tag("SmeltingRecipe", (smeltingRecipe) => validateSmeltingRecipe(smeltingRecipe)),
        Match.tag("BrewingRecipe", (brewingRecipe) => validateBrewingRecipe(brewingRecipe)),
        Match.orElse(() => Effect.succeed({ isValid: false, errors: ["Unknown recipe type"] }))
      )
    })

  const validateShapedRecipe = (recipe: ShapedRecipe) =>
    Effect.gen(function* () {
      const errors: string[] = []

      // パターンサイズの検証
      if (recipe.pattern.length > recipe.gridSize || recipe.pattern.some(row => row.length > recipe.gridSize)) {
        errors.push("Pattern exceeds grid size")
      }

      // 空のパターンチェック
      const hasIngredients = recipe.pattern.some(row => row.some(cell => cell !== undefined))
      if (!hasIngredients) {
        errors.push("Recipe pattern is empty")
      }

      // 材料の検証
      for (const row of recipe.pattern) {
        for (const cell of row) {
          if (cell) {
            const itemExists = yield* itemRegistry.itemExists(cell.itemId).pipe(
              Effect.catchAll(() => Effect.succeed(false))
            )
            if (!itemExists) {
              errors.push(`Unknown ingredient: ${cell.itemId}`)
            }
          }
        }
      }

      // 結果アイテムの検証
      const resultExists = yield* itemRegistry.itemExists(recipe.result.itemStack.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!resultExists) {
        errors.push(`Unknown result item: ${recipe.result.itemStack.itemId}`)
      }

      return { isValid: errors.length === 0, errors }
    })

  const validateShapelessRecipe = (recipe: ShapelessRecipe) =>
    Effect.gen(function* () {
      const errors: string[] = []

      // 材料の検証
      if (recipe.ingredients.length === 0) {
        errors.push("Recipe has no ingredients")
      }

      if (recipe.ingredients.length > 9) {
        errors.push("Too many ingredients (max 9)")
      }

      for (const ingredient of recipe.ingredients) {
        const itemExists = yield* itemRegistry.itemExists(ingredient.itemId).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        )
        if (!itemExists) {
          errors.push(`Unknown ingredient: ${ingredient.itemId}`)
        }
      }

      // 結果アイテムの検証
      const resultExists = yield* itemRegistry.itemExists(recipe.result.itemStack.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!resultExists) {
        errors.push(`Unknown result item: ${recipe.result.itemStack.itemId}`)
      }

      return { isValid: errors.length === 0, errors }
    })

  const validateSmeltingRecipe = (recipe: SmeltingRecipe) =>
    Effect.gen(function* () {
      const errors: string[] = []

      // 入力材料の検証
      const inputExists = yield* itemRegistry.itemExists(recipe.input.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!inputExists) {
        errors.push(`Unknown input item: ${recipe.input.itemId}`)
      }

      // 燃料の検証（指定されている場合）
      if (recipe.fuel) {
        const fuelExists = yield* itemRegistry.itemExists(recipe.fuel.itemId).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        )
        if (!fuelExists) {
          errors.push(`Unknown fuel item: ${recipe.fuel.itemId}`)
        }
      }

      // 結果アイテムの検証
      const resultExists = yield* itemRegistry.itemExists(recipe.result.itemStack.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!resultExists) {
        errors.push(`Unknown result item: ${recipe.result.itemStack.itemId}`)
      }

      // 製錬時間の検証
      if (recipe.smeltingTime <= 0 || recipe.smeltingTime > 12000) { // 0-10分
        errors.push("Invalid smelting time")
      }

      return { isValid: errors.length === 0, errors }
    })

  const validateBrewingRecipe = (recipe: BrewingRecipe) =>
    Effect.gen(function* () {
      const errors: string[] = []

      // ベースポーションの検証
      const basePotionExists = yield* itemRegistry.itemExists(recipe.basePotion).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!basePotionExists) {
        errors.push(`Unknown base potion: ${recipe.basePotion}`)
      }

      // 材料の検証
      const ingredientExists = yield* itemRegistry.itemExists(recipe.ingredient.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!ingredientExists) {
        errors.push(`Unknown ingredient: ${recipe.ingredient.itemId}`)
      }

      // 結果ポーションの検証
      const resultExists = yield* itemRegistry.itemExists(recipe.result.itemStack.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )
      if (!resultExists) {
        errors.push(`Unknown result potion: ${recipe.result.itemStack.itemId}`)
      }

      return { isValid: errors.length === 0, errors }
    })

  const logRecipeRegistration = (recipe: Recipe) =>
    Effect.gen(function* () {
      console.log(`Registered ${recipe._tag}: ${recipe.name} (${recipe.recipeId})`)
    })

  return RecipeRegistry.of({
    registerShapedRecipe,
    registerShapelessRecipe,
    registerSmeltingRecipe,
    registerBrewingRecipe,
    getRecipe,
    findRecipesByCategory,
    findRecipesByResult,
    getAllRecipes,
    validateRecipe
  })
})

// Live Layer
export const RecipeRegistryLive = Layer.effect(
  RecipeRegistry,
  makeRecipeRegistry
).pipe(
  Layer.provide(ItemRegistryLive)
)

// 型定義
type Recipe = ShapedRecipe | ShapelessRecipe | SmeltingRecipe | BrewingRecipe

interface ValidationResult {
  readonly isValid: boolean
  readonly errors: ReadonlyArray<string>
}

class RecipeRegistrationError {
  readonly _tag = "RecipeRegistrationError"
  constructor(public readonly message: string) {}
}

class RecipeNotFoundError {
  readonly _tag = "RecipeNotFoundError"
  constructor(public readonly recipeId: RecipeId) {}
}
```

## クラフトテーブルメカニクス

### Crafting Table Manager

```typescript
// CraftingTableManagerサービスインターフェース
interface CraftingTableManagerInterface {
  readonly createCraftingSession: (playerId: PlayerId, craftingType: CraftingType) => Effect.Effect<CraftingSession, CraftingError>
  readonly updateCraftingGrid: (sessionId: CraftingSessionId, gridContents: ReadonlyArray<ItemStack | undefined>) => Effect.Effect<CraftingSession, CraftingError>
  readonly craftItem: (sessionId: CraftingSessionId, recipeId?: RecipeId) => Effect.Effect<CraftingResult, CraftingError>
  readonly getAvailableRecipes: (sessionId: CraftingSessionId) => Effect.Effect<ReadonlyArray<Recipe>, never>
  readonly closeCraftingSession: (sessionId: CraftingSessionId) => Effect.Effect<ReadonlyArray<ItemStack>, never>
  readonly autoFillRecipe: (sessionId: CraftingSessionId, recipeId: RecipeId) => Effect.Effect<boolean, CraftingError>
}

// Context Tag
export const CraftingTableManager = Context.GenericTag<CraftingTableManagerInterface>("@app/CraftingTableManager")

// Live実装の作成関数
const makeCraftingTableManager = Effect.gen(function* () {
  const recipeRegistry = yield* RecipeRegistry
  const playerInventory = yield* PlayerInventoryManager
  const eventBus = yield* EventBus

  const activeSessions = yield* Effect.sync(() => new Map<CraftingSessionId, CraftingSession>())

  const createCraftingSession = (playerId: PlayerId, craftingType: CraftingType) =>
    Effect.gen(function* () {
      const sessionId = generateCraftingSessionId()
      const gridSize = getGridSizeForCraftingType(craftingType)

      const session: CraftingSession = {
        sessionId,
        playerId,
        craftingType,
        gridContents: new Array(gridSize).fill(undefined),
        resultSlot: undefined,
        currentRecipe: undefined,
        availableRecipes: [],
        startTime: new Date(),
        lastActivity: new Date()
      }

      activeSessions.set(sessionId, session)

      yield* eventBus.publish(new CraftingSessionStartEvent({
        sessionId,
        playerId,
        craftingType,
        timestamp: new Date()
      }))

      return session
    })

  const updateCraftingGrid = (sessionId: CraftingSessionId, gridContents: ReadonlyArray<ItemStack | undefined>) =>
    Effect.gen(function* () {
      const session = activeSessions.get(sessionId)
      if (!session) {
        return yield* Effect.fail(new CraftingError("Crafting session not found"))
      }

      // グリッド内容を更新
      const updatedSession = {
        ...session,
        gridContents: [...gridContents],
        lastActivity: new Date()
      }

      // 可能なレシピを検索
      const availableRecipes = yield* findMatchingRecipes(updatedSession)
      const currentRecipe = availableRecipes.length > 0 ? availableRecipes[0].recipeId : undefined

      // 結果スロットを更新
      const resultSlot = currentRecipe ? (availableRecipes[0] as any).result.itemStack : undefined

      const finalSession = {
        ...updatedSession,
        availableRecipes: availableRecipes.map(r => r.recipeId),
        currentRecipe,
        resultSlot
      }

      activeSessions.set(sessionId, finalSession)

      yield* eventBus.publish(new CraftingGridUpdateEvent({
        sessionId,
        gridContents: finalSession.gridContents,
        availableRecipes: finalSession.availableRecipes,
        timestamp: new Date()
      }))

      return finalSession
    })

  const craftItem = (sessionId: CraftingSessionId, recipeId?: RecipeId) =>
    Effect.gen(function* () {
      const session = activeSessions.get(sessionId)
      if (!session) {
        return yield* Effect.fail(new CraftingError("Crafting session not found"))
      }

      const targetRecipeId = recipeId || session.currentRecipe
      if (!targetRecipeId) {
        return yield* Effect.fail(new CraftingError("No recipe selected"))
      }

      const recipe = yield* recipeRegistry.getRecipe(targetRecipeId)

      // レシピ実行可能性チェック
      const canCraft = yield* validateCraftingAttempt(session, recipe)
      if (!canCraft.success) {
        return yield* Effect.fail(new CraftingError(canCraft.reason))
      }

      // 材料を消費
      yield* consumeIngredients(session, recipe)

      // 結果アイテムを生成
      const result = recipe.result
      const craftedItem = result.itemStack

      // プレイヤーインベントリに追加
      yield* playerInventory.addItem(session.playerId, craftedItem)

      // 経験値を付与
      if (result.experience) {
        yield* addCraftingExperience(session.playerId, result.experience)
      }

      // 副産物を処理
      if (result.byproducts) {
        for (const byproduct of result.byproducts) {
          yield* playerInventory.addItem(session.playerId, byproduct)
        }
      }

      // レシピ発見を記録
      yield* recordRecipeDiscovery(session.playerId, targetRecipeId)

      // グリッドをリセット
      const clearedSession = {
        ...session,
        gridContents: new Array(session.gridContents.length).fill(undefined),
        resultSlot: undefined,
        currentRecipe: undefined,
        availableRecipes: [],
        lastActivity: new Date()
      }

      activeSessions.set(sessionId, clearedSession)

      yield* eventBus.publish(new ItemCraftedEvent({
        playerId: session.playerId,
        recipeId: targetRecipeId,
        craftedItem,
        experience: result.experience || 0,
        timestamp: new Date()
      }))

      return result
    })

  const getAvailableRecipes = (sessionId: CraftingSessionId) =>
    Effect.gen(function* () {
      const session = activeSessions.get(sessionId)
      if (!session) return []

      const matchingRecipes = yield* findMatchingRecipes(session)
      return matchingRecipes
    })

  const closeCraftingSession = (sessionId: CraftingSessionId) =>
    Effect.gen(function* () {
      const session = activeSessions.get(sessionId)
      if (!session) return []

      // グリッド内のアイテムを返却
      const returnedItems = session.gridContents.filter((item): item is ItemStack => item !== undefined)

      for (const item of returnedItems) {
        yield* playerInventory.addItem(session.playerId, item)
      }

      activeSessions.delete(sessionId)

      yield* eventBus.publish(new CraftingSessionEndEvent({
        sessionId,
        playerId: session.playerId,
        returnedItems,
        timestamp: new Date()
      }))

      return returnedItems
    })

  const autoFillRecipe = (sessionId: CraftingSessionId, recipeId: RecipeId) =>
    Effect.gen(function* () {
      const session = activeSessions.get(sessionId)
      if (!session) {
        return yield* Effect.fail(new CraftingError("Crafting session not found"))
      }

      const recipe = yield* recipeRegistry.getRecipe(recipeId)
      const inventory = yield* playerInventory.getPlayerInventory(session.playerId)

      // レシピタイプに応じて自動配置
      const filledGrid = yield* Match.value(recipe).pipe(
        Match.tag("ShapedRecipe", (shapedRecipe) =>
          fillShapedRecipeGrid(shapedRecipe, inventory, session.gridContents.length)
        ),
        Match.tag("ShapelessRecipe", (shapelessRecipe) =>
          fillShapelessRecipeGrid(shapelessRecipe, inventory, session.gridContents.length)
        ),
        Match.orElse(() => Effect.succeed(null))
      )

      if (filledGrid === null) {
        return false
      }

      yield* updateCraftingGrid(sessionId, filledGrid)
      return true
    })

  const findMatchingRecipes = (session: CraftingSession) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const matchingRecipes: Recipe[] = []

      for (const recipe of allRecipes) {
        const matches = yield* recipeMatchesGrid(recipe, session)
        if (matches) {
          matchingRecipes.push(recipe)
        }
      }

      // 優先度順にソート（難易度、カテゴリなど）
      matchingRecipes.sort((a, b) => {
        if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
        return a.name.localeCompare(b.name)
      })

      return matchingRecipes
    })

  const recipeMatchesGrid = (recipe: Recipe, session: CraftingSession) =>
    Effect.gen(function* () {
      return yield* Match.value(recipe).pipe(
        Match.tag("ShapedRecipe", (shapedRecipe) => matchesShapedRecipe(shapedRecipe, session)),
        Match.tag("ShapelessRecipe", (shapelessRecipe) => matchesShapelessRecipe(shapelessRecipe, session)),
        Match.orElse(() => Effect.succeed(false))
      )
    })

  const matchesShapedRecipe = (recipe: ShapedRecipe, session: CraftingSession) =>
    Effect.gen(function* () {
      const gridSize = Math.sqrt(session.gridContents.length)
      if (recipe.gridSize > gridSize) return false

      const grid = convertToGrid(session.gridContents, gridSize)

      // パターンをすべての位置で試行
      for (let startRow = 0; startRow <= gridSize - recipe.pattern.length; startRow++) {
        for (let startCol = 0; startCol <= gridSize - recipe.pattern[0].length; startCol++) {
          const matches = yield* checkPatternMatch(recipe.pattern, grid, startRow, startCol)
          if (matches) return true
        }
      }

      return false
    })

  const matchesShapelessRecipe = (recipe: ShapelessRecipe, session: CraftingSession) =>
    Effect.gen(function* () {
      const gridItems = session.gridContents.filter((item): item is ItemStack => item !== undefined)

      if (gridItems.length !== recipe.ingredients.length) return false

      // 使用可能な材料をカウント
      const availableItems = new Map<string, number>()
      for (const item of gridItems) {
        const key = item.itemId
        availableItems.set(key, (availableItems.get(key) || 0) + item.count)
      }

      // 必要な材料をチェック
      for (const ingredient of recipe.ingredients) {
        const available = availableItems.get(ingredient.itemId) || 0
        if (available < ingredient.count) {
          // 代替アイテムもチェック
          if (ingredient.alternatives) {
            let alternativeFound = false
            for (const alt of ingredient.alternatives) {
              const altAvailable = availableItems.get(alt) || 0
              if (altAvailable >= ingredient.count) {
                alternativeFound = true
                break
              }
            }
            if (!alternativeFound) return false
          } else {
            return false
          }
        }
      }

      return true
    })

  const validateCraftingAttempt = (session: CraftingSession, recipe: Recipe) =>
    Effect.gen(function* () {
      // レシピの解放条件チェック
      if (recipe.unlockRequirements) {
        const playerHistory = yield* getCraftingHistory(session.playerId)
        for (const requirement of recipe.unlockRequirements) {
          if (!playerHistory.discoveredRecipes.has(requirement as RecipeId)) {
            return { success: false, reason: `Recipe ${requirement} not discovered` }
          }
        }
      }

      // 必要なツールチェック
      if (recipe.requiredTool) {
        const hasRequiredTool = yield* playerInventory.countItems(session.playerId, recipe.requiredTool)
        if (hasRequiredTool === 0) {
          return { success: false, reason: `Required tool ${recipe.requiredTool} not found` }
        }
      }

      // インベントリ空き容量チェック
      const hasSpace = yield* playerInventory.hasSpace(session.playerId, recipe.result.itemStack)
      if (!hasSpace) {
        return { success: false, reason: "Inventory full" }
      }

      return { success: true }
    })

  return CraftingTableManager.of({
    createCraftingSession,
    updateCraftingGrid,
    craftItem,
    getAvailableRecipes,
    closeCraftingSession,
    autoFillRecipe
  })
})

// Live Layer
export const CraftingTableManagerLive = Layer.effect(
  CraftingTableManager,
  makeCraftingTableManager
).pipe(
  Layer.provide(RecipeRegistryLive),
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(EventBusLive)
)

// ヘルパー関数
type CraftingType = "workbench" | "inventory" | "furnace" | "brewing_stand" | "anvil"
type CraftingSessionId = string & Brand.Brand<"CraftingSessionId">

const getGridSizeForCraftingType = (craftingType: CraftingType): number =>
  Match.value(craftingType).pipe(
    Match.when("inventory", () => CRAFTING_GRID_2X2),
    Match.when("workbench", () => CRAFTING_GRID_3X3),
    Match.when("furnace", () => FURNACE_SLOTS),
    Match.when("brewing_stand", () => BREWING_STAND_SLOTS),
    Match.when("anvil", () => ANVIL_SLOTS),
    Match.orElse(() => CRAFTING_GRID_3X3)
  )

const generateCraftingSessionId = (): CraftingSessionId => {
  return `crafting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as CraftingSessionId
}

const convertToGrid = (items: ReadonlyArray<ItemStack | undefined>, gridSize: number): (ItemStack | undefined)[][] => {
  const grid: (ItemStack | undefined)[][] = []
  for (let i = 0; i < gridSize; i++) {
    grid[i] = []
    for (let j = 0; j < gridSize; j++) {
      grid[i][j] = items[i * gridSize + j]
    }
  }
  return grid
}

// イベント定義
class CraftingSessionStartEvent {
  constructor(
    public readonly data: {
      sessionId: CraftingSessionId
      playerId: PlayerId
      craftingType: CraftingType
      timestamp: Date
    }
  ) {}
}

class CraftingGridUpdateEvent {
  constructor(
    public readonly data: {
      sessionId: CraftingSessionId
      gridContents: ReadonlyArray<ItemStack | undefined>
      availableRecipes: ReadonlyArray<RecipeId>
      timestamp: Date
    }
  ) {}
}

class ItemCraftedEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      recipeId: RecipeId
      craftedItem: ItemStack
      experience: number
      timestamp: Date
    }
  ) {}
}

class CraftingSessionEndEvent {
  constructor(
    public readonly data: {
      sessionId: CraftingSessionId
      playerId: PlayerId
      returnedItems: ReadonlyArray<ItemStack>
      timestamp: Date
    }
  ) {}
}

class CraftingError {
  readonly _tag = "CraftingError"
  constructor(public readonly message: string) {}
}
```

## 無形/有形レシピシステム

### Advanced Recipe Matching

```typescript
// RecipeMatchingServiceサービスインターフェース
interface RecipeMatchingServiceInterface {
  readonly findExactShapedMatch: (pattern: ReadonlyArray<ReadonlyArray<ItemStack | undefined>>) => Effect.Effect<ReadonlyArray<ShapedRecipe>, never>
  readonly findShapelessMatch: (ingredients: ReadonlyArray<ItemStack>) => Effect.Effect<ReadonlyArray<ShapelessRecipe>, never>
  readonly findPartialMatches: (gridContents: ReadonlyArray<ItemStack | undefined>) => Effect.Effect<ReadonlyArray<Recipe>, never>
  readonly suggestRecipes: (availableItems: ReadonlyArray<ItemStack>) => Effect.Effect<ReadonlyArray<Recipe>, never>
  readonly optimizeRecipeSelection: (recipes: ReadonlyArray<Recipe>, criteria: OptimizationCriteria) => Effect.Effect<ReadonlyArray<Recipe>, never>
}

// Context Tag
export const RecipeMatchingService = Context.GenericTag<RecipeMatchingServiceInterface>("@app/RecipeMatchingService")

// Live実装の作成関数
const makeRecipeMatchingService = Effect.gen(function* () {
  const recipeRegistry = yield* RecipeRegistry

  const findExactShapedMatch = (pattern: ReadonlyArray<ReadonlyArray<ItemStack | undefined>>) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const shapedRecipes = allRecipes.filter((recipe): recipe is ShapedRecipe => recipe._tag === "ShapedRecipe")
      const matches: ShapedRecipe[] = []

      for (const recipe of shapedRecipes) {
        const isExactMatch = yield* checkExactShapedMatch(recipe, pattern)
        if (isExactMatch) {
          matches.push(recipe)
        }
      }

      return matches
    })

  const findShapelessMatch = (ingredients: ReadonlyArray<ItemStack>) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const shapelessRecipes = allRecipes.filter((recipe): recipe is ShapelessRecipe => recipe._tag === "ShapelessRecipe")
      const matches: ShapelessRecipe[] = []

      for (const recipe of shapelessRecipes) {
        const isMatch = yield* checkShapelessMatch(recipe, ingredients)
        if (isMatch) {
          matches.push(recipe)
        }
      }

      return matches
    })

  const findPartialMatches = (gridContents: ReadonlyArray<ItemStack | undefined>) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const partialMatches: Recipe[] = []

      for (const recipe of allRecipes) {
        const matchScore = yield* calculateMatchScore(recipe, gridContents)
        if (matchScore > 0.3) { // 30%以上のマッチ
          partialMatches.push(recipe)
        }
      }

      // マッチスコア順にソート
      const scoredMatches = yield* Promise.all(
        partialMatches.map(async recipe => ({
          recipe,
          score: yield* calculateMatchScore(recipe, gridContents)
        }))
      )

      scoredMatches.sort((a, b) => b.score - a.score)
      return scoredMatches.map(item => item.recipe)
    })

  const suggestRecipes = (availableItems: ReadonlyArray<ItemStack>) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const suggestions: Recipe[] = []

      const itemCounts = new Map<string, number>()
      for (const item of availableItems) {
        itemCounts.set(item.itemId, (itemCounts.get(item.itemId) || 0) + item.count)
      }

      for (const recipe of allRecipes) {
        const canCraft = yield* checkCraftability(recipe, itemCounts)
        if (canCraft) {
          suggestions.push(recipe)
        }
      }

      return suggestions
    })

  const optimizeRecipeSelection = (recipes: ReadonlyArray<Recipe>, criteria: OptimizationCriteria) =>
    Effect.gen(function* () {
      const scoredRecipes = yield* Effect.all(
        recipes.map(recipe =>
          Effect.gen(function* () {
            const score = yield* calculateRecipeScore(recipe, criteria)
            return { recipe, score }
          })
        )
      )

      scoredRecipes.sort((a, b) => b.score - a.score)
      return scoredRecipes.map(item => item.recipe)
    })

  const checkExactShapedMatch = (recipe: ShapedRecipe, pattern: ReadonlyArray<ReadonlyArray<ItemStack | undefined>>) =>
    Effect.gen(function* () {
      if (recipe.pattern.length !== pattern.length) return false

      for (let i = 0; i < recipe.pattern.length; i++) {
        if (recipe.pattern[i].length !== pattern[i].length) return false

        for (let j = 0; j < recipe.pattern[i].length; j++) {
          const recipeIngredient = recipe.pattern[i][j]
          const patternItem = pattern[i][j]

          if (!recipeIngredient && !patternItem) continue
          if (!recipeIngredient || !patternItem) return false

          const matches = yield* ingredientMatches(recipeIngredient, patternItem)
          if (!matches) return false
        }
      }

      return true
    })

  const checkShapelessMatch = (recipe: ShapelessRecipe, ingredients: ReadonlyArray<ItemStack>) =>
    Effect.gen(function* () {
      if (recipe.ingredients.length !== ingredients.length) return false

      const availableItems = new Map<string, number>()
      for (const item of ingredients) {
        availableItems.set(item.itemId, (availableItems.get(item.itemId) || 0) + item.count)
      }

      for (const ingredient of recipe.ingredients) {
        const available = availableItems.get(ingredient.itemId) || 0
        if (available < ingredient.count) {
          // 代替アイテムをチェック
          let alternativeFound = false
          if (ingredient.alternatives) {
            for (const alt of ingredient.alternatives) {
              const altAvailable = availableItems.get(alt) || 0
              if (altAvailable >= ingredient.count) {
                availableItems.set(alt, altAvailable - ingredient.count)
                alternativeFound = true
                break
              }
            }
          }
          if (!alternativeFound) return false
        } else {
          availableItems.set(ingredient.itemId, available - ingredient.count)
        }
      }

      return true
    })

  const calculateMatchScore = (recipe: Recipe, gridContents: ReadonlyArray<ItemStack | undefined>) =>
    Effect.gen(function* () {
      let totalIngredients = 0
      let matchingIngredients = 0

      yield* Match.value(recipe).pipe(
        Match.tag("ShapedRecipe", (shapedRecipe) =>
          Effect.gen(function* () {
            const flatPattern = shapedRecipe.pattern.flat()
            totalIngredients = flatPattern.filter(item => item !== undefined).length

            for (let i = 0; i < Math.min(flatPattern.length, gridContents.length); i++) {
              const recipeIngredient = flatPattern[i]
              const gridItem = gridContents[i]

              if (recipeIngredient && gridItem) {
                const matches = yield* ingredientMatches(recipeIngredient, gridItem)
                if (matches) matchingIngredients++
              }
            }
          })
        ),
        Match.tag("ShapelessRecipe", (shapelessRecipe) =>
          Effect.gen(function* () {
            totalIngredients = shapelessRecipe.ingredients.length
            const gridItems = gridContents.filter((item): item is ItemStack => item !== undefined)

            for (const ingredient of shapelessRecipe.ingredients) {
              const matchingGridItem = gridItems.find(item =>
                item.itemId === ingredient.itemId ||
                ingredient.alternatives?.includes(item.itemId as ItemId)
              )
              if (matchingGridItem) matchingIngredients++
            }
          })
        ),
        Match.orElse(() => Effect.succeed(undefined))
      )

      return totalIngredients > 0 ? matchingIngredients / totalIngredients : 0
    })

  const checkCraftability = (recipe: Recipe, availableItems: Map<string, number>) =>
    Effect.gen(function* () {
      return yield* Match.value(recipe).pipe(
        Match.tag("ShapedRecipe", (shapedRecipe) =>
          Effect.gen(function* () {
            const flatIngredients = shapedRecipe.pattern.flat().filter((item): item is Ingredient => item !== undefined)
            for (const ingredient of flatIngredients) {
              const available = availableItems.get(ingredient.itemId) || 0
              if (available < ingredient.count) {
                let alternativeFound = false
                if (ingredient.alternatives) {
                  for (const alt of ingredient.alternatives) {
                    const altAvailable = availableItems.get(alt) || 0
                    if (altAvailable >= ingredient.count) {
                      alternativeFound = true
                      break
                    }
                  }
                }
                if (!alternativeFound) return false
              }
            }
            return true
          })
        ),
        Match.tag("ShapelessRecipe", (shapelessRecipe) =>
          Effect.gen(function* () {
            for (const ingredient of shapelessRecipe.ingredients) {
              const available = availableItems.get(ingredient.itemId) || 0
              if (available < ingredient.count) {
                let alternativeFound = false
                if (ingredient.alternatives) {
                  for (const alt of ingredient.alternatives) {
                    const altAvailable = availableItems.get(alt) || 0
                    if (altAvailable >= ingredient.count) {
                      alternativeFound = true
                      break
                    }
                  }
                }
                if (!alternativeFound) return false
              }
            }
            return true
          })
        ),
        Match.tag("SmeltingRecipe", (smeltingRecipe) =>
          Effect.gen(function* () {
            const inputAvailable = availableItems.get(smeltingRecipe.input.itemId) || 0
            return inputAvailable >= smeltingRecipe.input.count
          })
        ),
        Match.tag("BrewingRecipe", (brewingRecipe) =>
          Effect.gen(function* () {
            const basePotionAvailable = availableItems.get(brewingRecipe.basePotion) || 0
            const ingredientAvailable = availableItems.get(brewingRecipe.ingredient.itemId) || 0
            return basePotionAvailable >= 1 && ingredientAvailable >= brewingRecipe.ingredient.count
          })
        ),
        Match.orElse(() => Effect.succeed(false))
      )
    })

  const calculateRecipeScore = (recipe: Recipe, criteria: OptimizationCriteria) =>
    Effect.gen(function* () {
      let score = 0

      // 難易度スコア
      score += (6 - recipe.difficulty) * criteria.difficultyWeight

      // カテゴリ優先度
      if (criteria.preferredCategories?.includes(recipe.category)) {
        score += 50 * criteria.categoryWeight
      }

      // 結果アイテムの価値
      const resultValue = yield* getItemValue(recipe.result.itemStack.itemId)
      score += resultValue * criteria.valueWeight

      // 経験値獲得量
      if (recipe.result.experience) {
        score += recipe.result.experience * criteria.experienceWeight
      }

      return score
    })

  const ingredientMatches = (ingredient: Ingredient, item: ItemStack) =>
    Effect.gen(function* () {
      if (ingredient.itemId === item.itemId && ingredient.count <= item.count) {
        return true
      }

      if (ingredient.alternatives) {
        for (const alt of ingredient.alternatives) {
          if (alt === item.itemId && ingredient.count <= item.count) {
            return true
          }
        }
      }

      return false
    })

  const getItemValue = (itemId: ItemId) =>
    Effect.gen(function* () {
      // アイテムの価値を計算（レア度、有用性など）
      // 実装は省略
      return 10
    })

  return RecipeMatchingService.of({
    findExactShapedMatch,
    findShapelessMatch,
    findPartialMatches,
    suggestRecipes,
    optimizeRecipeSelection
  })
})

// Live Layer
export const RecipeMatchingServiceLive = Layer.effect(
  RecipeMatchingService,
  makeRecipeMatchingService
).pipe(
  Layer.provide(RecipeRegistryLive)
)

// 型定義
interface OptimizationCriteria {
  readonly difficultyWeight: number
  readonly categoryWeight: number
  readonly valueWeight: number
  readonly experienceWeight: number
  readonly preferredCategories?: ReadonlyArray<string>
}
```

## レシピ発見システム

### Recipe Discovery Manager

```typescript
// RecipeDiscoveryManagerサービスインターフェース
interface RecipeDiscoveryManagerInterface {
  readonly discoverRecipe: (playerId: PlayerId, recipeId: RecipeId) => Effect.Effect<boolean, RecipeDiscoveryError>
  readonly checkDiscoveryTriggers: (playerId: PlayerId, trigger: DiscoveryTrigger) => Effect.Effect<ReadonlyArray<RecipeId>, never>
  readonly getDiscoveredRecipes: (playerId: PlayerId) => Effect.Effect<ReadonlyArray<RecipeId>, never>
  readonly getRecipeDiscoveryProgress: (playerId: PlayerId) => Effect.Effect<RecipeDiscoveryProgress, never>
  readonly autoDiscoverRecipes: (playerId: PlayerId, craftedItem: ItemStack) => Effect.Effect<ReadonlyArray<RecipeId>, never>
  readonly unlockRecipeCategory: (playerId: PlayerId, category: string) => Effect.Effect<ReadonlyArray<RecipeId>, never>
}

// Context Tag
export const RecipeDiscoveryManager = Context.GenericTag<RecipeDiscoveryManagerInterface>("@app/RecipeDiscoveryManager")

// Live実装の作成関数
const makeRecipeDiscoveryManager = Effect.gen(function* () {
  const recipeRegistry = yield* RecipeRegistry
  const playerData = yield* PlayerDataService
  const eventBus = yield* EventBus

  const discoverRecipe = (playerId: PlayerId, recipeId: RecipeId) =>
    Effect.gen(function* () {
      const history = yield* getCraftingHistory(playerId)

      if (history.discoveredRecipes.has(recipeId)) {
        return false // 既に発見済み
      }

      const recipe = yield* recipeRegistry.getRecipe(recipeId)

      // 解放条件チェック
      if (recipe.unlockRequirements) {
        for (const requirement of recipe.unlockRequirements) {
          if (!history.discoveredRecipes.has(requirement as RecipeId)) {
            return yield* Effect.fail(new RecipeDiscoveryError(`Prerequisite recipe ${requirement} not discovered`))
          }
        }
      }

      // レシピを発見済みに追加
      const updatedHistory = {
        ...history,
        discoveredRecipes: history.discoveredRecipes.add(recipeId),
        lastActivity: new Date()
      }

      yield* saveCraftingHistory(playerId, updatedHistory)

      yield* eventBus.publish(new RecipeDiscoveredEvent({
        playerId,
        recipeId,
        recipeName: recipe.name,
        category: recipe.category,
        timestamp: new Date()
      }))

      return true
    })

  const checkDiscoveryTriggers = (playerId: PlayerId, trigger: DiscoveryTrigger) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const history = yield* getCraftingHistory(playerId)
      const newDiscoveries: RecipeId[] = []

      for (const recipe of allRecipes) {
        if (history.discoveredRecipes.has(recipe.recipeId)) continue

        const shouldDiscover = yield* checkTriggerConditions(recipe, trigger, history)
        if (shouldDiscover) {
          const discovered = yield* discoverRecipe(playerId, recipe.recipeId)
          if (discovered) {
            newDiscoveries.push(recipe.recipeId)
          }
        }
      }

      return newDiscoveries
    })

  const getDiscoveredRecipes = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const history = yield* getCraftingHistory(playerId)
      return Array.from(history.discoveredRecipes)
    })

  const getRecipeDiscoveryProgress = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const history = yield* getCraftingHistory(playerId)

      const categoryProgress = new Map<string, { discovered: number; total: number }>()

      for (const recipe of allRecipes) {
        const category = recipe.category
        if (!categoryProgress.has(category)) {
          categoryProgress.set(category, { discovered: 0, total: 0 })
        }

        const progress = categoryProgress.get(category)!
        progress.total++

        if (history.discoveredRecipes.has(recipe.recipeId)) {
          progress.discovered++
        }
      }

      return {
        totalRecipes: allRecipes.length,
        discoveredRecipes: history.discoveredRecipes.size,
        categoryProgress: Object.fromEntries(categoryProgress),
        craftingLevel: history.craftingLevel,
        totalExperience: history.totalExperience,
        specializations: history.specializations
      } as RecipeDiscoveryProgress
    })

  const autoDiscoverRecipes = (playerId: PlayerId, craftedItem: ItemStack) =>
    Effect.gen(function* () {
      const trigger: DiscoveryTrigger = {
        type: "item_crafted",
        itemId: craftedItem.itemId,
        count: craftedItem.count
      }

      return yield* checkDiscoveryTriggers(playerId, trigger)
    })

  const unlockRecipeCategory = (playerId: PlayerId, category: string) =>
    Effect.gen(function* () {
      const categoryRecipes = yield* recipeRegistry.findRecipesByCategory(category)
      const unlockedRecipes: RecipeId[] = []

      for (const recipe of categoryRecipes) {
        // 基本的なレシピのみ自動解放（難易度1-2）
        if (recipe.difficulty <= 2 && !recipe.unlockRequirements) {
          const discovered = yield* discoverRecipe(playerId, recipe.recipeId)
          if (discovered) {
            unlockedRecipes.push(recipe.recipeId)
          }
        }
      }

      yield* eventBus.publish(new CategoryUnlockedEvent({
        playerId,
        category,
        unlockedRecipes,
        timestamp: new Date()
      }))

      return unlockedRecipes
    })

  const checkTriggerConditions = (recipe: Recipe, trigger: DiscoveryTrigger, history: CraftingHistory) =>
    Effect.gen(function* () {
      return yield* Match.value(trigger.type).pipe(
        Match.when("item_crafted", () =>
          Effect.gen(function* () {
            // アイテム作成による発見
            if (recipe._tag === "ShapedRecipe" || recipe._tag === "ShapelessRecipe") {
              const usesIngredient = yield* recipeUsesIngredient(recipe, trigger.itemId!)
              return usesIngredient
            }
            return false
          })
        ),
        Match.when("item_obtained", () =>
          Effect.gen(function* () {
            // アイテム取得による発見
            if (recipe._tag === "ShapedRecipe" || recipe._tag === "ShapelessRecipe") {
              const usesIngredient = yield* recipeUsesIngredient(recipe, trigger.itemId!)
              return usesIngredient && recipe.difficulty <= 2
            }
            return false
          })
        ),
        Match.when("level_reached", () =>
          Effect.succeed(history.craftingLevel >= trigger.level!)
        ),
        Match.when("biome_entered", () =>
          Effect.succeed(recipe.category.includes(trigger.biome!) && recipe.difficulty <= 3)
        ),
        Match.when("structure_discovered", () =>
          Effect.gen(function* () {
            // 構造物発見による発見
            const structureRecipes = ["ancient_debris", "netherite", "enchanting"]
            return structureRecipes.includes(recipe.category) && recipe.difficulty <= 4
          })
        ),
        Match.when("achievement_unlocked", () =>
          Effect.succeed(recipe.unlockRequirements?.includes(trigger.achievement!) || false)
        ),
        Match.orElse(() => Effect.succeed(false))
      )
    })

  const recipeUsesIngredient = (recipe: ShapedRecipe | ShapelessRecipe, itemId: ItemId) =>
    Effect.gen(function* () {
      if (recipe._tag === "ShapedRecipe") {
        const flatIngredients = recipe.pattern.flat().filter((item): item is Ingredient => item !== undefined)
        return flatIngredients.some(ingredient =>
          ingredient.itemId === itemId ||
          ingredient.alternatives?.includes(itemId)
        )
      } else {
        return recipe.ingredients.some(ingredient =>
          ingredient.itemId === itemId ||
          ingredient.alternatives?.includes(itemId)
        )
      }
    })

  const getCraftingHistory = (playerId: PlayerId) =>
    Effect.gen(function* () {
      return yield* playerData.getCraftingHistory(playerId).pipe(
        Effect.catchTag("PlayerDataNotFoundError", () =>
          Effect.succeed(createDefaultCraftingHistory(playerId))
        )
      )
    })

  const saveCraftingHistory = (playerId: PlayerId, history: CraftingHistory) =>
    Effect.gen(function* () {
      yield* playerData.saveCraftingHistory(playerId, history)
    })

  const createDefaultCraftingHistory = (playerId: PlayerId): CraftingHistory => ({
    playerId,
    craftedItems: [],
    discoveredRecipes: new Set<RecipeId>(),
    totalExperience: 0,
    craftingLevel: 1,
    specializations: [],
    lastActivity: new Date()
  })

  return RecipeDiscoveryManager.of({
    discoverRecipe,
    checkDiscoveryTriggers,
    getDiscoveredRecipes,
    getRecipeDiscoveryProgress,
    autoDiscoverRecipes,
    unlockRecipeCategory
  })
})

// Live Layer
export const RecipeDiscoveryManagerLive = Layer.effect(
  RecipeDiscoveryManager,
  makeRecipeDiscoveryManager
).pipe(
  Layer.provide(RecipeRegistryLive),
  Layer.provide(PlayerDataServiceLive),
  Layer.provide(EventBusLive)
)

// 型定義
interface DiscoveryTrigger {
  readonly type: "item_crafted" | "item_obtained" | "level_reached" | "biome_entered" | "structure_discovered" | "achievement_unlocked"
  readonly itemId?: ItemId
  readonly count?: number
  readonly level?: number
  readonly biome?: string
  readonly structure?: string
  readonly achievement?: string
}

interface RecipeDiscoveryProgress {
  readonly totalRecipes: number
  readonly discoveredRecipes: number
  readonly categoryProgress: Record<string, { discovered: number; total: number }>
  readonly craftingLevel: number
  readonly totalExperience: number
  readonly specializations: ReadonlyArray<string>
}

class RecipeDiscoveryError {
  readonly _tag = "RecipeDiscoveryError"
  constructor(public readonly message: string) {}
}

class RecipeDiscoveredEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      recipeId: RecipeId
      recipeName: string
      category: string
      timestamp: Date
    }
  ) {}
}

class CategoryUnlockedEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      category: string
      unlockedRecipes: ReadonlyArray<RecipeId>
      timestamp: Date
    }
  ) {}
}
```

## 精錬/かまどシステム

### Smelting and Furnace System

```typescript
// SmeltingManagerサービスインターフェース
interface SmeltingManagerInterface {
  readonly startSmelting: (furnaceId: ContainerId, inputItem: ItemStack, fuel: ItemStack) => Effect.Effect<SmeltingProcess, SmeltingError>
  readonly updateSmeltingProcess: (furnaceId: ContainerId, deltaTime: number) => Effect.Effect<SmeltingProcess, never>
  readonly getFurnaceState: (furnaceId: ContainerId) => Effect.Effect<FurnaceState, FurnaceNotFoundError>
  readonly addFuel: (furnaceId: ContainerId, fuel: ItemStack) => Effect.Effect<boolean, SmeltingError>
  readonly extractResult: (furnaceId: ContainerId) => Effect.Effect<ItemStack | null, SmeltingError>
  readonly getFuelEfficiency: (fuelItem: ItemStack) => Effect.Effect<FuelInfo, never>
}

// Context Tag
export const SmeltingManager = Context.GenericTag<SmeltingManagerInterface>("@app/SmeltingManager")

// Live実装の作成関数
const makeSmeltingManager = Effect.gen(function* () {
  const recipeRegistry = yield* RecipeRegistry
  const containerManager = yield* ContainerManager
  const eventBus = yield* EventBus

  const activeProcesses = yield* Effect.sync(() => new Map<ContainerId, SmeltingProcess>())

  const startSmelting = (furnaceId: ContainerId, inputItem: ItemStack, fuel: ItemStack) =>
    Effect.gen(function* () {
      // 製錬レシピを検索
      const smeltingRecipe = yield* findSmeltingRecipe(inputItem)
      if (!smeltingRecipe) {
        return yield* Effect.fail(new SmeltingError("No smelting recipe found for input item"))
      }

      // 燃料効率を取得
      const fuelInfo = yield* getFuelEfficiency(fuel)
      if (fuelInfo.burnTime <= 0) {
        return yield* Effect.fail(new SmeltingError("Invalid fuel"))
      }

      // かまどの状態を確認
      const furnace = yield* containerManager.getContainer(furnaceId)
      if (furnace.containerType !== "furnace") {
        return yield* Effect.fail(new SmeltingError("Container is not a furnace"))
      }

      const process: SmeltingProcess = {
        furnaceId,
        recipe: smeltingRecipe,
        inputItem,
        fuel,
        remainingFuel: fuelInfo.burnTime,
        smeltingProgress: 0,
        totalSmeltingTime: smeltingRecipe.smeltingTime,
        isActive: true,
        startTime: new Date(),
        lastUpdate: new Date()
      }

      activeProcesses.set(furnaceId, process)

      yield* eventBus.publish(new SmeltingStartedEvent({
        furnaceId,
        recipeId: smeltingRecipe.recipeId,
        inputItem,
        fuel,
        estimatedCompletionTime: new Date(Date.now() + smeltingRecipe.smeltingTime * 50), // 50ms per tick
        timestamp: new Date()
      }))

      return process
    })

  const updateSmeltingProcess = (furnaceId: ContainerId, deltaTime: number) =>
    Effect.gen(function* () {
      const process = activeProcesses.get(furnaceId)
      if (!process || !process.isActive) {
        return process || createEmptyProcess(furnaceId)
      }

      let updatedProcess = { ...process, lastUpdate: new Date() }

      // 燃料消費
      updatedProcess.remainingFuel -= deltaTime

      if (updatedProcess.remainingFuel <= 0) {
        // 燃料切れ - プロセス停止
        updatedProcess = {
          ...updatedProcess,
          isActive: false
        }

        yield* eventBus.publish(new SmeltingStoppedEvent({
          furnaceId,
          reason: "out_of_fuel",
          progress: updatedProcess.smeltingProgress / updatedProcess.totalSmeltingTime,
          timestamp: new Date()
        }))
      } else {
        // 製錬進行
        updatedProcess.smeltingProgress += deltaTime

        if (updatedProcess.smeltingProgress >= updatedProcess.totalSmeltingTime) {
          // 製錬完了
          const result = yield* completeSmeltingProcess(updatedProcess)
          updatedProcess = result

          yield* eventBus.publish(new SmeltingCompletedEvent({
            furnaceId,
            recipeId: updatedProcess.recipe.recipeId,
            resultItem: updatedProcess.recipe.result.itemStack,
            experience: updatedProcess.recipe.experience,
            timestamp: new Date()
          }))
        }
      }

      activeProcesses.set(furnaceId, updatedProcess)
      return updatedProcess
    })

  const getFurnaceState = (furnaceId: ContainerId) =>
    Effect.gen(function* () {
      const furnace = yield* containerManager.getContainer(furnaceId)
      const process = activeProcesses.get(furnaceId)

      const inputSlot = furnace.slots[1] // 原料スロット
      const fuelSlot = furnace.slots[0]  // 燃料スロット
      const resultSlot = furnace.slots[2] // 結果スロット

      return {
        furnaceId,
        inputItem: inputSlot.itemStack || null,
        fuel: fuelSlot.itemStack || null,
        result: resultSlot.itemStack || null,
        isActive: process?.isActive || false,
        smeltingProgress: process?.smeltingProgress || 0,
        totalSmeltingTime: process?.totalSmeltingTime || 0,
        remainingFuel: process?.remainingFuel || 0,
        temperature: calculateFurnaceTemperature(process)
      } as FurnaceState
    })

  const addFuel = (furnaceId: ContainerId, fuel: ItemStack) =>
    Effect.gen(function* () {
      const fuelInfo = yield* getFuelEfficiency(fuel)
      if (fuelInfo.burnTime <= 0) {
        return yield* Effect.fail(new SmeltingError("Invalid fuel"))
      }

      const process = activeProcesses.get(furnaceId)
      if (process) {
        const updatedProcess = {
          ...process,
          remainingFuel: process.remainingFuel + fuelInfo.burnTime,
          isActive: true
        }
        activeProcesses.set(furnaceId, updatedProcess)
      }

      return true
    })

  const extractResult = (furnaceId: ContainerId) =>
    Effect.gen(function* () {
      const furnace = yield* containerManager.getContainer(furnaceId)
      const resultSlot = furnace.slots[2] // 結果スロット

      if (resultSlot.itemStack) {
        const result = resultSlot.itemStack
        resultSlot.itemStack = undefined
        resultSlot.lastModified = new Date()

        yield* eventBus.publish(new SmeltingResultExtractedEvent({
          furnaceId,
          extractedItem: result,
          timestamp: new Date()
        }))

        return result
      }

      return null
    })

  const getFuelEfficiency = (fuelItem: ItemStack) =>
    Effect.gen(function* () {
      // 燃料の種類に応じた燃焼時間を返す
      const fuelTypes: Record<string, FuelInfo> = {
        "coal": { burnTime: 1600, efficiency: 1.0 },
        "charcoal": { burnTime: 1600, efficiency: 1.0 },
        "coal_block": { burnTime: 16000, efficiency: 1.0 },
        "wood_planks": { burnTime: 300, efficiency: 0.8 },
        "stick": { burnTime: 100, efficiency: 0.6 },
        "lava_bucket": { burnTime: 20000, efficiency: 1.2 },
        "blaze_rod": { burnTime: 2400, efficiency: 1.1 },
        "dried_kelp_block": { burnTime: 4000, efficiency: 0.9 }
      }

      return fuelTypes[fuelItem.itemId] || { burnTime: 0, efficiency: 0 }
    })

  const findSmeltingRecipe = (inputItem: ItemStack) =>
    Effect.gen(function* () {
      const allRecipes = yield* recipeRegistry.getAllRecipes()
      const smeltingRecipes = allRecipes.filter((recipe): recipe is SmeltingRecipe => recipe._tag === "SmeltingRecipe")

      for (const recipe of smeltingRecipes) {
        if (recipe.input.itemId === inputItem.itemId && recipe.input.count <= inputItem.count) {
          return recipe
        }
      }

      return null
    })

  const completeSmeltingProcess = (process: SmeltingProcess) =>
    Effect.gen(function* () {
      // 製錬完了処理
      const recipe = process.recipe
      const furnace = yield* containerManager.getContainer(process.furnaceId)

      // 結果スロットにアイテムを配置
      const resultSlot = furnace.slots[2]
      if (!resultSlot.itemStack) {
        resultSlot.itemStack = recipe.result.itemStack
      } else {
        // スタック可能な場合は統合
        const stackedResult = yield* tryStackItems(resultSlot.itemStack, recipe.result.itemStack)
        resultSlot.itemStack = stackedResult
      }

      resultSlot.lastModified = new Date()

      // 原料スロットからアイテムを消費
      const inputSlot = furnace.slots[1]
      if (inputSlot.itemStack) {
        inputSlot.itemStack = {
          ...inputSlot.itemStack,
          count: inputSlot.itemStack.count - recipe.input.count
        }
        if (inputSlot.itemStack.count <= 0) {
          inputSlot.itemStack = undefined
        }
        inputSlot.lastModified = new Date()
      }

      // プロセスをリセット
      return {
        ...process,
        smeltingProgress: 0,
        isActive: inputSlot.itemStack ? true : false // 材料があれば継続
      }
    })

  const calculateFurnaceTemperature = (process: SmeltingProcess | undefined): number => {
    if (!process || !process.isActive) return 0

    const progress = process.smeltingProgress / process.totalSmeltingTime
    const baseTemp = 800 // 摂氏
    const maxTemp = 1200

    return Math.floor(baseTemp + (maxTemp - baseTemp) * progress)
  }

  const createEmptyProcess = (furnaceId: ContainerId): SmeltingProcess => ({
    furnaceId,
    recipe: null,
    inputItem: null,
    fuel: null,
    remainingFuel: 0,
    smeltingProgress: 0,
    totalSmeltingTime: 0,
    isActive: false,
    startTime: new Date(),
    lastUpdate: new Date()
  })

  const tryStackItems = (existing: ItemStack, newItem: ItemStack) =>
    Effect.gen(function* () {
      if (existing.itemId === newItem.itemId) {
        return {
          ...existing,
          count: Math.min(existing.count + newItem.count, 64) // スタック制限
        }
      }
      return existing
    })

  return SmeltingManager.of({
    startSmelting,
    updateSmeltingProcess,
    getFurnaceState,
    addFuel,
    extractResult,
    getFuelEfficiency
  })
})

// Live Layer
export const SmeltingManagerLive = Layer.effect(
  SmeltingManager,
  makeSmeltingManager
).pipe(
  Layer.provide(RecipeRegistryLive),
  Layer.provide(ContainerManagerLive),
  Layer.provide(EventBusLive)
)

// 型定義
interface SmeltingProcess {
  readonly furnaceId: ContainerId
  readonly recipe: SmeltingRecipe | null
  readonly inputItem: ItemStack | null
  readonly fuel: ItemStack | null
  readonly remainingFuel: number
  readonly smeltingProgress: number
  readonly totalSmeltingTime: number
  readonly isActive: boolean
  readonly startTime: Date
  readonly lastUpdate: Date
}

interface FurnaceState {
  readonly furnaceId: ContainerId
  readonly inputItem: ItemStack | null
  readonly fuel: ItemStack | null
  readonly result: ItemStack | null
  readonly isActive: boolean
  readonly smeltingProgress: number
  readonly totalSmeltingTime: number
  readonly remainingFuel: number
  readonly temperature: number
}

interface FuelInfo {
  readonly burnTime: number
  readonly efficiency: number
}

class SmeltingError {
  readonly _tag = "SmeltingError"
  constructor(public readonly message: string) {}
}

class FurnaceNotFoundError {
  readonly _tag = "FurnaceNotFoundError"
  constructor(public readonly furnaceId: ContainerId) {}
}

// イベント定義
class SmeltingStartedEvent {
  constructor(
    public readonly data: {
      furnaceId: ContainerId
      recipeId: RecipeId
      inputItem: ItemStack
      fuel: ItemStack
      estimatedCompletionTime: Date
      timestamp: Date
    }
  ) {}
}

class SmeltingCompletedEvent {
  constructor(
    public readonly data: {
      furnaceId: ContainerId
      recipeId: RecipeId
      resultItem: ItemStack
      experience: number
      timestamp: Date
    }
  ) {}
}

class SmeltingStoppedEvent {
  constructor(
    public readonly data: {
      furnaceId: ContainerId
      reason: "out_of_fuel" | "no_input" | "output_full"
      progress: number
      timestamp: Date
    }
  ) {}
}

class SmeltingResultExtractedEvent {
  constructor(
    public readonly data: {
      furnaceId: ContainerId
      extractedItem: ItemStack
      timestamp: Date
    }
  ) {}
}
```

## インテグレーション

### Crafting System Integration

```typescript
interface CraftingSystemServiceInterface {
  readonly initializeCraftingSystem: () => Effect.Effect<void, CraftingSystemError>
  readonly processPlayerCraftingAction: (playerId: PlayerId, action: CraftingAction) => Effect.Effect<CraftingActionResult, CraftingError>
  readonly updateAllFurnaces: (deltaTime: number) => Effect.Effect<void, never>
  readonly getCraftingSystemState: (playerId: PlayerId) => Effect.Effect<CraftingSystemState, never>
}

export const CraftingSystemService = Context.GenericTag<CraftingSystemServiceInterface>("@app/CraftingSystemService")

export const CraftingSystemServiceLive = Layer.effect(
  CraftingSystemService,
  Effect.gen(function* () {
    const recipeRegistry = yield* RecipeRegistry
    const craftingTable = yield* CraftingTableManager
    const smeltingManager = yield* SmeltingManager
    const recipeDiscovery = yield* RecipeDiscoveryManager

    const initializeCraftingSystem = () =>
      Effect.gen(function* () {
        // デフォルトレシピの登録
        yield* registerDefaultRecipes()

        // システム初期化完了
        console.log("Crafting System initialized successfully")
      })

    const processPlayerCraftingAction = (playerId: PlayerId, action: CraftingAction) =>
      Effect.gen(function* () {
        return yield* Match.value(action.type).pipe(
          Match.when("open_crafting_table", () =>
            Effect.gen(function* () {
              const session = yield* craftingTable.createCraftingSession(playerId, "workbench")
              return { success: true, data: session }
            })
          ),
          Match.when("update_crafting_grid", () =>
            Effect.gen(function* () {
              const updatedSession = yield* craftingTable.updateCraftingGrid(action.sessionId!, action.gridContents!)
              return { success: true, data: updatedSession }
            })
          ),
          Match.when("craft_item", () =>
            Effect.gen(function* () {
              const craftResult = yield* craftingTable.craftItem(action.sessionId!, action.recipeId)

              // 自動レシピ発見
              yield* recipeDiscovery.autoDiscoverRecipes(playerId, craftResult.itemStack)

              return { success: true, data: craftResult }
            })
          ),
          Match.when("auto_fill_recipe", () =>
            Effect.gen(function* () {
              const filled = yield* craftingTable.autoFillRecipe(action.sessionId!, action.recipeId!)
              return { success: filled, message: filled ? "Recipe filled" : "Cannot fill recipe" }
            })
          ),
          Match.when("close_crafting_session", () =>
            Effect.gen(function* () {
              const returnedItems = yield* craftingTable.closeCraftingSession(action.sessionId!)
              return { success: true, data: returnedItems }
            })
          ),
          Match.when("start_smelting", () =>
            Effect.gen(function* () {
              const smeltingProcess = yield* smeltingManager.startSmelting(
                action.furnaceId!,
                action.inputItem!,
                action.fuel!
              )
              return { success: true, data: smeltingProcess }
            })
          ),
          Match.when("extract_smelting_result", () =>
            Effect.gen(function* () {
              const extracted = yield* smeltingManager.extractResult(action.furnaceId!)
              return { success: extracted !== null, data: extracted }
            })
          ),
          Match.orElse(() => Effect.fail(new CraftingError(`Unknown crafting action: ${action.type}`)))
        )
      })

    const updateAllFurnaces = (deltaTime: number) =>
      Effect.gen(function* () {
        // すべてのアクティブなかまどを更新
        const activeFurnaces = yield* getAllActiveFurnaces()

        for (const furnaceId of activeFurnaces) {
          yield* smeltingManager.updateSmeltingProcess(furnaceId, deltaTime)
        }
      })

    const getCraftingSystemState = (playerId: PlayerId) =>
      Effect.gen(function* () {
        const discoveredRecipes = yield* recipeDiscovery.getDiscoveredRecipes(playerId)
        const discoveryProgress = yield* recipeDiscovery.getRecipeDiscoveryProgress(playerId)

        return {
          discoveredRecipes,
          discoveryProgress,
          availableCategories: ["tools", "weapons", "armor", "food", "building", "redstone", "brewing"],
          craftingLevel: discoveryProgress.craftingLevel,
          totalExperience: discoveryProgress.totalExperience
        } as CraftingSystemState
      })

    const registerDefaultRecipes = () =>
      Effect.gen(function* () {
        // 基本的なレシピを登録
        const basicRecipes = createBasicRecipes()

        for (const recipe of basicRecipes) {
          yield* Match.value(recipe).pipe(
            Match.tag("ShapedRecipe", (shapedRecipe) => recipeRegistry.registerShapedRecipe(shapedRecipe)),
            Match.tag("ShapelessRecipe", (shapelessRecipe) => recipeRegistry.registerShapelessRecipe(shapelessRecipe)),
            Match.tag("SmeltingRecipe", (smeltingRecipe) => recipeRegistry.registerSmeltingRecipe(smeltingRecipe)),
            Match.tag("BrewingRecipe", (brewingRecipe) => recipeRegistry.registerBrewingRecipe(brewingRecipe)),
            Match.orElse(() => Effect.unit)
          )
        }
      })

    const getAllActiveFurnaces = () =>
      Effect.gen(function* () {
        // アクティブなかまどのIDリストを取得
        // 実装では、コンテナマネージャーからかまどタイプのコンテナを検索
        return [] as ContainerId[]
      })

    const createBasicRecipes = (): Recipe[] => {
      return [
        // 木の道具
        {
          _tag: "ShapedRecipe",
          recipeId: "wooden_pickaxe" as RecipeId,
          name: "Wooden Pickaxe",
          category: "tools",
          gridSize: 3,
          pattern: [
            [
              { itemId: "oak_planks" as ItemId, count: 1 },
              { itemId: "oak_planks" as ItemId, count: 1 },
              { itemId: "oak_planks" as ItemId, count: 1 }
            ],
            [
              undefined,
              { itemId: "stick" as ItemId, count: 1 },
              undefined
            ],
            [
              undefined,
              { itemId: "stick" as ItemId, count: 1 },
              undefined
            ]
          ],
          result: {
            itemStack: {
              itemId: "wooden_pickaxe" as ItemId,
              count: 1,
              durability: 59,
              timestamp: new Date()
            }
          },
          difficulty: 1,
          isDiscovered: false,
          createdAt: new Date()
        },

        // 製錬レシピ
        {
          _tag: "SmeltingRecipe",
          recipeId: "iron_ingot" as RecipeId,
          name: "Iron Ingot",
          category: "materials",
          input: { itemId: "iron_ore" as ItemId, count: 1 },
          result: {
            itemStack: {
              itemId: "iron_ingot" as ItemId,
              count: 1,
              timestamp: new Date()
            }
          },
          smeltingTime: 200, // 10 seconds
          experience: 0.7,
          difficulty: 1,
          isDiscovered: false,
          createdAt: new Date()
        }

        // その他のレシピ...
      ]
    }

    return CraftingSystemService.of({
      initializeCraftingSystem,
      processPlayerCraftingAction,
      updateAllFurnaces,
      getCraftingSystemState
    })
  })
).pipe(
  Layer.provide(RecipeRegistryLive),
  Layer.provide(CraftingTableManagerLive),
  Layer.provide(SmeltingManagerLive),
  Layer.provide(RecipeDiscoveryManagerLive)
)

// 型定義
interface CraftingAction {
  readonly type: "open_crafting_table" | "update_crafting_grid" | "craft_item" | "auto_fill_recipe" | "close_crafting_session" | "start_smelting" | "extract_smelting_result"
  readonly sessionId?: CraftingSessionId
  readonly gridContents?: ReadonlyArray<ItemStack | undefined>
  readonly recipeId?: RecipeId
  readonly furnaceId?: ContainerId
  readonly inputItem?: ItemStack
  readonly fuel?: ItemStack
}

interface CraftingActionResult {
  readonly success: boolean
  readonly message?: string
  readonly data?: unknown
}

interface CraftingSystemState {
  readonly discoveredRecipes: ReadonlyArray<RecipeId>
  readonly discoveryProgress: RecipeDiscoveryProgress
  readonly availableCategories: ReadonlyArray<string>
  readonly craftingLevel: number
  readonly totalExperience: number
}

class CraftingSystemError {
  readonly _tag = "CraftingSystemError"
  constructor(public readonly message: string) {}
}
```

## テスト

```typescript
import { Effect, TestContext, TestClock } from "effect"

describe("Crafting System", () => {
  const TestCraftingLayer = Layer.mergeAll(
    RecipeRegistryLive,
    CraftingTableManagerLive,
    RecipeMatchingServiceLive,
    RecipeDiscoveryManagerLive,
    SmeltingManagerLive,
    CraftingSystemServiceLive
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  it("should register and retrieve recipes", () =>
    Effect.gen(function* () {
      const registry = yield* RecipeRegistry

      const testRecipe: ShapedRecipe = {
        _tag: "ShapedRecipe",
        recipeId: "test_recipe" as RecipeId,
        name: "Test Recipe",
        category: "test",
        gridSize: 3,
        pattern: [
          [{ itemId: "stone" as ItemId, count: 1 }, undefined, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined]
        ],
        result: {
          itemStack: {
            itemId: "stone_brick" as ItemId,
            count: 1,
            timestamp: new Date()
          }
        },
        difficulty: 1,
        isDiscovered: false,
        createdAt: new Date()
      }

      yield* registry.registerShapedRecipe(testRecipe)
      const retrieved = yield* registry.getRecipe("test_recipe" as RecipeId)

      expect(retrieved.name).toBe("Test Recipe")
      expect(retrieved._tag).toBe("ShapedRecipe")
    }).pipe(
      Effect.provide(TestCraftingLayer),
      Effect.runPromise
    ))

  it("should create and manage crafting sessions", () =>
    Effect.gen(function* () {
      const craftingTable = yield* CraftingTableManager
      const playerId = "player1" as PlayerId

      const session = yield* craftingTable.createCraftingSession(playerId, "workbench")
      expect(session.craftingType).toBe("workbench")
      expect(session.gridContents.length).toBe(9)

      // グリッドを更新
      const gridContents = new Array(9).fill(undefined)
      gridContents[0] = {
        itemId: "oak_planks" as ItemId,
        count: 1,
        timestamp: new Date()
      } as ItemStack

      const updatedSession = yield* craftingTable.updateCraftingGrid(session.sessionId, gridContents)
      expect(updatedSession.gridContents[0]).toBeDefined()
    }).pipe(
      Effect.provide(TestCraftingLayer),
      Effect.runPromise
    ))

  it("should match recipes correctly", () =>
    Effect.gen(function* () {
      const matchingService = yield* RecipeMatchingService

      const ingredients = [
        {
          itemId: "iron_ingot" as ItemId,
          count: 3,
          timestamp: new Date()
        },
        {
          itemId: "stick" as ItemId,
          count: 2,
          timestamp: new Date()
        }
      ] as ItemStack[]

      const matches = yield* matchingService.findShapelessMatch(ingredients)
      expect(Array.isArray(matches)).toBe(true)
    }).pipe(
      Effect.provide(TestCraftingLayer),
      Effect.runPromise
    ))

  it("should discover recipes automatically", () =>
    Effect.gen(function* () {
      const discoveryManager = yield* RecipeDiscoveryManager
      const playerId = "player1" as PlayerId

      const craftedItem = {
        itemId: "wooden_planks" as ItemId,
        count: 4,
        timestamp: new Date()
      } as ItemStack

      const discoveredRecipes = yield* discoveryManager.autoDiscoverRecipes(playerId, craftedItem)
      expect(Array.isArray(discoveredRecipes)).toBe(true)

      const progress = yield* discoveryManager.getRecipeDiscoveryProgress(playerId)
      expect(progress.totalRecipes).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestCraftingLayer),
      Effect.runPromise
    ))

  it("should process smelting operations", () =>
    Effect.gen(function* () {
      const smeltingManager = yield* SmeltingManager
      const furnaceId = "furnace1" as ContainerId

      const inputItem = {
        itemId: "iron_ore" as ItemId,
        count: 1,
        timestamp: new Date()
      } as ItemStack

      const fuel = {
        itemId: "coal" as ItemId,
        count: 1,
        timestamp: new Date()
      } as ItemStack

      // 製錬開始
      const process = yield* smeltingManager.startSmelting(furnaceId, inputItem, fuel)
      expect(process.isActive).toBe(true)
      expect(process.recipe).toBeDefined()

      // 製錬進行をシミュレート
      const updatedProcess = yield* smeltingManager.updateSmeltingProcess(furnaceId, 100)
      expect(updatedProcess.smeltingProgress).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestCraftingLayer),
      Effect.runPromise
    ))
})
```

## まとめ

Crafting Systemは、Minecraftの創造性と探求心を刺激する包括的なシステムです。Effect-TSのLayerパターンを活用し、各クラフトコンポーネントが独立して機能しながら、統合された創造体験を提供します。

### 主要な特徴

1. **柔軟なレシピシステム**: 有形・無形レシピの完全サポート
2. **直感的なクラフトテーブル**: リアルタイムレシピマッチング
3. **自動レシピ発見**: プレイヤーの行動に基づく発見システム
4. **高度な製錬システム**: リアルな燃料消費と進捗管理
5. **醸造システム**: ポーション作成の完全サポート
6. **レシピ最適化**: 効率的なレシピ提案と自動配置
7. **進捗追跡**: 詳細なクラフト統計と実績

このシステムにより、プレイヤーは直感的で楽しいクラフト体験を得られ、Minecraftの無限の創造可能性を実現できます。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Create Rendering System documentation (05-rendering-system.md)", "status": "completed", "activeForm": "Creating Rendering System documentation"}, {"content": "Create Physics System documentation (06-physics-system.md)", "status": "completed", "activeForm": "Creating Physics System documentation"}, {"content": "Create Chunk Management documentation (07-chunk-system.md)", "status": "completed", "activeForm": "Creating Chunk Management documentation"}, {"content": "Create Inventory System documentation (08-inventory-system.md)", "status": "completed", "activeForm": "Creating Inventory System documentation"}, {"content": "Create Crafting System documentation (09-crafting-system.md)", "status": "completed", "activeForm": "Creating Crafting System documentation"}]