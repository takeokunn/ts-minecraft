import { Effect, Context, Layer, Option, Match, pipe, Stream, Queue, Ref, Fiber, Array } from 'effect'
import type {
  CraftingGUIState,
  CraftingGUIEvent,
  CraftingSession,
  RecipeFilterConfig,
  DragDropState,
  CraftingResultDisplay,
  TooltipInfo,
} from './CraftingGUITypes'
import type { CraftingGrid, CraftingItemStack, CraftingRecipe, RecipeId } from '../../../domain/crafting/RecipeTypes'
import { GridWidth, GridHeight, ItemStackCount } from '../../../domain/crafting/RecipeTypes'
import { RecipeRegistryService } from '../../../domain/crafting/RecipeRegistryService'
import { CraftingEngineService } from '../../../domain/crafting/CraftingEngineService'
import { InventoryService } from '../../../domain/inventory/InventoryService'
import { Brand } from 'effect'

// エラー定義
export class CraftingGUIError extends Error {
  readonly _tag = 'CraftingGUIError'
  constructor(readonly reason: string) {
    super(reason)
  }
}

export class InvalidSlotError extends Error {
  readonly _tag = 'InvalidSlotError'
  constructor(
    readonly slotIndex: number,
    readonly maxSlots: number
  ) {
    super(`Invalid slot index ${slotIndex}, max slots: ${maxSlots}`)
  }
}

export class DragDropError extends Error {
  readonly _tag = 'DragDropError'
  constructor(readonly reason: string) {
    super(reason)
  }
}

// Crafting GUI Service インターフェース
export interface CraftingGUIService {
  readonly initializeSession: (
    playerId: string,
    tableType: CraftingSession['craftingTableType']
  ) => Effect.Effect<CraftingSession, CraftingGUIError>

  readonly getState: () => Effect.Effect<CraftingGUIState>

  readonly handleEvent: (
    event: CraftingGUIEvent
  ) => Effect.Effect<void, CraftingGUIError | InvalidSlotError | DragDropError>

  readonly updateGrid: (grid: CraftingGrid) => Effect.Effect<CraftingResultDisplay, CraftingGUIError>

  readonly getAvailableRecipes: (filter?: RecipeFilterConfig) => Effect.Effect<Array<CraftingRecipe>>

  readonly craftItem: (recipeId?: RecipeId, quantity?: number) => Effect.Effect<CraftingItemStack, CraftingGUIError>

  readonly clearGrid: () => Effect.Effect<void>

  readonly getTooltip: (slotIndex: number) => Effect.Effect<Option.Option<TooltipInfo>>

  readonly subscribeToUpdates: () => Stream.Stream<CraftingGUIState>

  readonly dispose: () => Effect.Effect<void>
}

export const CraftingGUIService = Context.GenericTag<CraftingGUIService>('@minecraft/presentation/CraftingGUIService')

// Crafting GUI Service実装
export const CraftingGUIServiceLive = Layer.effect(
  CraftingGUIService,
  Effect.gen(function* () {
    // 依存サービスの取得
    const recipeRegistry = yield* RecipeRegistryService
    const craftingEngine = yield* CraftingEngineService
    const inventoryService = yield* InventoryService

    // 内部状態の管理
    const stateRef = yield* Ref.make<CraftingGUIState>({
      _tag: 'CraftingGUIState',
      sessionId: '',
      craftingGrid: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
      resultSlot: null,
      selectedRecipe: null,
      availableRecipes: [],
      isProcessing: false,
      isDragging: false,
      draggedItem: null,
      draggedFromSlot: null,
      hoveredSlot: null,
      searchQuery: '',
      selectedCategory: 'all',
      showRecipeBook: true,
      animations: {},
    })

    const sessionRef = yield* Ref.make<Option.Option<CraftingSession>>(Option.none())
    const updateQueue = yield* Queue.unbounded<CraftingGUIState>()
    const dragDropStateRef = yield* Ref.make<DragDropState>({
      _tag: 'DragDropState',
      isDragging: false,
      draggedItem: null,
      sourceSlot: null,
      targetSlot: null,
      dropEffect: 'none',
      cursorPosition: { x: 0, y: 0 },
    })

    // セッション初期化
    const initializeSession = (
      playerId: string,
      tableType: CraftingSession['craftingTableType']
    ): Effect.Effect<CraftingSession, CraftingGUIError> =>
      Effect.gen(function* () {
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const gridSize = getGridSizeForTableType(tableType)
        const emptyGrid = createEmptyGrid(gridSize.width, gridSize.height)

        const session: CraftingSession = {
          _tag: 'CraftingSession',
          id: sessionId,
          playerId,
          startTime: Date.now(),
          craftingTableType: tableType,
          grid: emptyGrid as any,
          history: [],
          stats: {
            itemsCrafted: 0,
            recipesUsed: 0,
            materialsConsumed: 0,
          },
        }

        yield* Ref.set(sessionRef, Option.some(session))
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          sessionId,
          craftingGrid: emptyGrid,
          availableRecipes: [],
        }))

        // 利用可能なレシピを読み込み
        const recipes = yield* recipeRegistry.getAllRecipes()
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          availableRecipes: recipes as any[],
        }))

        return session
      })

    // 状態取得
    const getState = (): Effect.Effect<CraftingGUIState> => Ref.get(stateRef)

    // イベントハンドリング
    const handleEvent = (
      event: CraftingGUIEvent
    ): Effect.Effect<void, CraftingGUIError | InvalidSlotError | DragDropError> =>
      pipe(
        Match.value(event),
        Match.tag('SlotClicked', ({ slotIndex, button, shiftKey }) => handleSlotClick(slotIndex, button, shiftKey)),
        Match.tag('ItemDragStart', ({ slotIndex, item }) => handleDragStart(slotIndex, item as CraftingItemStack)),
        Match.tag('ItemDragEnd', ({ targetSlotIndex }) => handleDragEnd(targetSlotIndex)),
        Match.tag('ItemDrop', ({ sourceSlot, targetSlot, item }) =>
          handleItemDrop(sourceSlot, targetSlot, item as CraftingItemStack)
        ),
        Match.tag('RecipeSelected', ({ recipeId }) => handleRecipeSelection(recipeId as RecipeId)),
        Match.tag('RecipeSearch', ({ query }) => handleRecipeSearch(query)),
        Match.tag('CategorySelected', ({ category }) => handleCategorySelection(category)),
        Match.tag('CraftingRequested', ({ recipeId, quantity }) =>
          Effect.gen(function* () {
            const id = recipeId ? (recipeId as RecipeId) : undefined
            yield* craftItem(id, quantity)
          })
        ),
        Match.tag('GridCleared', () => clearGrid()),
        Match.tag('RecipeBookToggled', () => toggleRecipeBook()),
        Match.exhaustive
      )

    // スロットクリック処理
    const handleSlotClick = (
      slotIndex: number,
      button: 'left' | 'right',
      shiftKey: boolean
    ): Effect.Effect<void, InvalidSlotError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const maxSlots = state.craftingGrid.flat().length + 1 // +1 for result slot

        if (slotIndex < 0 || slotIndex >= maxSlots) {
          return yield* Effect.fail(new InvalidSlotError(slotIndex, maxSlots))
        }

        // Quick move with shift+click
        if (shiftKey && button === 'left') {
          yield* quickMoveItem(slotIndex)
        }
        // Split stack with right click
        else if (button === 'right') {
          yield* splitStack(slotIndex)
        }

        yield* updateCraftingResult()
      })

    // ドラッグ開始処理
    const handleDragStart = (slotIndex: number, item: CraftingItemStack): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.update(dragDropStateRef, (state) => ({
          ...state,
          isDragging: true,
          draggedItem: item as any,
          sourceSlot: slotIndex,
        }))

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          isDragging: true,
          draggedItem: item as any,
          draggedFromSlot: slotIndex,
        }))
      })

    // ドラッグ終了処理
    const handleDragEnd = (targetSlotIndex?: number | null): Effect.Effect<void, DragDropError> =>
      Effect.gen(function* () {
        const dragState = yield* Ref.get(dragDropStateRef)

        if (!dragState.isDragging) {
          return yield* Effect.fail(new DragDropError('No active drag operation'))
        }

        if (targetSlotIndex !== undefined && targetSlotIndex !== null && dragState.sourceSlot !== null) {
          yield* handleItemDrop(dragState.sourceSlot, targetSlotIndex, dragState.draggedItem as CraftingItemStack)
        }

        // Reset drag state
        yield* Ref.set(dragDropStateRef, {
          _tag: 'DragDropState',
          isDragging: false,
          draggedItem: null,
          sourceSlot: null,
          targetSlot: null,
          dropEffect: 'none',
          cursorPosition: { x: 0, y: 0 },
        })

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          isDragging: false,
          draggedItem: null,
          draggedFromSlot: null,
        }))
      })

    // アイテムドロップ処理
    const handleItemDrop = (sourceSlot: number, targetSlot: number, item: CraftingItemStack): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (sourceSlot === targetSlot) return

        const state = yield* Ref.get(stateRef)
        const newGrid = [...state.craftingGrid.map((row) => [...row])]

        // Calculate positions
        const sourcePos = getSlotPosition(sourceSlot, newGrid)
        const targetPos = getSlotPosition(targetSlot, newGrid)

        if (sourcePos && targetPos && newGrid[sourcePos.y] && newGrid[targetPos.y]) {
          const sourceRow = newGrid[sourcePos.y]!
          const targetRow = newGrid[targetPos.y]!

          // Swap items
          const sourceItem = sourceRow[sourcePos.x]
          const targetItem = targetRow[targetPos.x]

          // Stack if same item
          if (targetItem && sourceItem && (targetItem as any).itemId === (sourceItem as any).itemId) {
            const totalCount = (targetItem as any).count + (sourceItem as any).count
            const maxStack = 64 // TODO: Get from item definition

            if (totalCount <= maxStack) {
              targetRow[targetPos.x] = {
                ...targetItem,
                count: ItemStackCount(totalCount),
              } as any
              sourceRow[sourcePos.x] = null
            } else {
              targetRow[targetPos.x] = {
                ...targetItem,
                count: ItemStackCount(maxStack),
              } as any
              sourceRow[sourcePos.x] = {
                ...sourceItem,
                count: ItemStackCount(totalCount - maxStack),
              } as any
            }
          } else {
            // Swap
            targetRow[targetPos.x] = sourceItem
            sourceRow[sourcePos.x] = targetItem
          }

          yield* Ref.update(stateRef, (s) => ({ ...s, craftingGrid: newGrid }))
          yield* updateCraftingResult()
        }
      })

    // レシピ選択処理
    const handleRecipeSelection = (recipeId: RecipeId): Effect.Effect<void> =>
      Effect.gen(function* () {
        const recipe = yield* pipe(
          recipeRegistry.getById(recipeId),
          Effect.map(Option.some),
          Effect.catchAll(() => Effect.succeed(Option.none()))
        )

        if (Option.isSome(recipe)) {
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            selectedRecipe: recipeId,
          }))

          // Auto-fill grid with recipe pattern if possible
          yield* autoFillRecipePattern(recipe.value)
        }
      })

    // レシピ検索処理
    const handleRecipeSearch = (query: string): Effect.Effect<void> =>
      Ref.update(stateRef, (state) => ({
        ...state,
        searchQuery: query,
      }))

    // カテゴリ選択処理
    const handleCategorySelection = (category: string): Effect.Effect<void> =>
      Ref.update(stateRef, (state) => ({
        ...state,
        selectedCategory: category,
      }))

    // グリッド更新処理
    const updateGrid = (grid: CraftingGrid): Effect.Effect<CraftingResultDisplay, CraftingGUIError> =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          craftingGrid: grid.slots as any[][],
        }))

        const result = yield* updateCraftingResult()
        return result
      })

    // 利用可能レシピ取得
    const getAvailableRecipes = (filter?: RecipeFilterConfig): Effect.Effect<Array<CraftingRecipe>> =>
      Effect.gen(function* () {
        const allRecipes = yield* recipeRegistry.getAllRecipes()

        const recipesArray = globalThis.Array.from(allRecipes)
        if (!filter) return recipesArray

        const filtered = recipesArray.filter((recipe) => {
          // Category filter
          if (filter.categories.length > 0 && !filter.categories.includes(recipe.category._tag)) {
            return false
          }

          // Search query filter
          if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase()
            const recipeName = recipe.result.itemId.toLowerCase()
            if (!recipeName.includes(query)) {
              return false
            }
          }

          // Craftable filter
          if (filter.showCraftableOnly) {
            // TODO: Check if player has required items
            return true
          }

          return true
        })

        // Sort
        return filtered.sort((a, b) => {
          switch (filter.sortBy) {
            case 'name':
              return a.result.itemId.localeCompare(b.result.itemId) as -1 | 0 | 1
            case 'category':
              return a.category._tag.localeCompare(b.category._tag) as -1 | 0 | 1
            default:
              return 0
          }
        })
      })

    // アイテムクラフト処理
    const craftItem = (recipeId?: RecipeId, quantity: number = 1): Effect.Effect<CraftingItemStack, CraftingGUIError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const grid: CraftingGrid = {
          _tag: 'CraftingGrid',
          width: GridWidth(3),
          height: GridHeight(3),
          slots: state.craftingGrid as any[][],
        }

        // Find matching recipe if not specified
        const recipe = recipeId
          ? yield* pipe(
              recipeRegistry.getById(recipeId),
              Effect.map(Option.some),
              Effect.catchAll(() => Effect.succeed(Option.none()))
            )
          : yield* craftingEngine.matchRecipe(grid)

        if (Option.isNone(recipe)) {
          return yield* Effect.fail(new CraftingGUIError('No matching recipe found'))
        }

        // Craft the item
        const result = yield* pipe(
          craftingEngine.executeCrafting(grid, recipe.value),
          Effect.catchTag('PatternMismatchError', () =>
            Effect.fail(new CraftingGUIError('Pattern mismatch in crafting'))
          )
        )

        // Update grid with remaining items after crafting
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          craftingGrid: result.remainingGrid.slots as any[][],
        }))

        // Update session stats
        yield* updateSessionStats(recipe.value, quantity)

        if (!result.result) {
          return yield* Effect.fail(new CraftingGUIError('Crafting failed to produce result'))
        }

        return result.result
      })

    // グリッドクリア
    const clearGrid = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const emptyGrid = createEmptyGrid(3, 3)
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          craftingGrid: emptyGrid,
          resultSlot: null,
          selectedRecipe: null,
        }))
      })

    // ツールチップ取得
    const getTooltip = (slotIndex: number): Effect.Effect<Option.Option<TooltipInfo>> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const item = getItemAtSlot(slotIndex, state.craftingGrid as any[][])

        if (!item) return Option.none()

        const tooltip: TooltipInfo = {
          _tag: 'TooltipInfo',
          title: (item as any).itemId || 'Unknown Item',
          stackSize: (item as any).count,
          description: `A crafting material`,
          tags: [],
        }

        return Option.some(tooltip)
      })

    // 更新ストリーム購読
    const subscribeToUpdates = (): Stream.Stream<CraftingGUIState> => Stream.fromQueue(updateQueue)

    // リソース破棄
    const dispose = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Queue.shutdown(updateQueue)
        yield* clearGrid()
      })

    // ヘルパー関数
    const updateCraftingResult = (): Effect.Effect<CraftingResultDisplay> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const grid: CraftingGrid = {
          _tag: 'CraftingGrid',
          width: GridWidth(3),
          height: GridHeight(3),
          slots: state.craftingGrid as any[][],
        }

        const matchingRecipe = yield* craftingEngine.matchRecipe(grid)

        const display: CraftingResultDisplay = {
          _tag: 'CraftingResultDisplay',
          result: Option.isSome(matchingRecipe) ? (matchingRecipe.value.result as any) : null,
          recipe: Option.isSome(matchingRecipe) ? (matchingRecipe.value as any) : null,
          canCraft: Option.isSome(matchingRecipe),
          missingIngredients: [],
          craftCount: 1,
          showAnimation: false,
        }

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          resultSlot: display.result,
        }))

        // Notify subscribers
        const newState = yield* Ref.get(stateRef)
        yield* Queue.offer(updateQueue, newState)

        return display
      })

    const toggleRecipeBook = (): Effect.Effect<void> =>
      Ref.update(stateRef, (state) => ({
        ...state,
        showRecipeBook: !state.showRecipeBook,
      }))

    const quickMoveItem = (slotIndex: number): Effect.Effect<void> =>
      Effect.gen(function* () {
        // TODO: Implement quick move logic
        yield* Effect.log(`Quick move from slot ${slotIndex}`)
      })

    const splitStack = (slotIndex: number): Effect.Effect<void> =>
      Effect.gen(function* () {
        // TODO: Implement stack splitting logic
        yield* Effect.log(`Split stack at slot ${slotIndex}`)
      })

    const autoFillRecipePattern = (recipe: CraftingRecipe): Effect.Effect<void> =>
      Effect.gen(function* () {
        // TODO: Implement auto-fill from inventory
        yield* Effect.log(`Auto-filling recipe pattern for ${recipe.id}`)
      })

    const updateSessionStats = (recipe: CraftingRecipe, quantity: number): Effect.Effect<void> =>
      Ref.update(sessionRef, (maybeSession) =>
        Option.map(maybeSession, (session) => ({
          ...session,
          stats: {
            ...session.stats,
            itemsCrafted: session.stats.itemsCrafted + quantity,
            recipesUsed: session.stats.recipesUsed + 1,
            materialsConsumed:
              session.stats.materialsConsumed + (Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 1),
          },
          history: [
            ...session.history,
            {
              timestamp: Date.now(),
              action: 'crafted',
              recipe: recipe.id,
            },
          ],
        }))
      )

    // Utility functions
    const getGridSizeForTableType = (type: CraftingSession['craftingTableType']) => {
      switch (type) {
        case 'player-inventory':
          return { width: 2, height: 2 }
        case 'workbench':
          return { width: 3, height: 3 }
        default:
          return { width: 3, height: 3 }
      }
    }

    const createEmptyGrid = (width: number, height: number) => {
      return globalThis
        .Array(height)
        .fill(null)
        .map(() => globalThis.Array(width).fill(null))
    }

    const getSlotPosition = (slotIndex: number, grid: any[][]) => {
      if (grid.length === 0 || !grid[0]) return null
      const gridSize = grid.length * grid[0].length
      if (slotIndex >= gridSize) return null

      const y = Math.floor(slotIndex / grid[0].length)
      const x = slotIndex % grid[0].length
      return { x, y }
    }

    const getItemAtSlot = (slotIndex: number, grid: any[][]) => {
      const pos = getSlotPosition(slotIndex, grid)
      if (!pos || !grid[pos.y]) return undefined
      return grid[pos.y]![pos.x]
    }

    return {
      initializeSession,
      getState,
      handleEvent,
      updateGrid,
      getAvailableRecipes,
      craftItem,
      clearGrid,
      getTooltip,
      subscribeToUpdates,
      dispose,
    }
  })
)
