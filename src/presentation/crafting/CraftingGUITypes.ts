import { Schema, Brand, Option } from 'effect'
import type { CraftingGrid, CraftingItemStack, CraftingRecipe, RecipeId } from '../../domain/crafting/RecipeTypes'

// ブランド型定義
export type SlotIndex = number & Brand.Brand<'SlotIndex'>
export type GridPosition = { x: number; y: number } & Brand.Brand<'GridPosition'>
export type CraftingSessionId = string & Brand.Brand<'CraftingSessionId'>

export const SlotIndex = Brand.nominal<SlotIndex>()
export const GridPosition = Brand.nominal<GridPosition>()
export const CraftingSessionId = Brand.nominal<CraftingSessionId>()

// UI状態のSchema定義
export const CraftingSlotState = Schema.Struct({
  _tag: Schema.Literal('CraftingSlotState'),
  index: Schema.Number,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
  item: Schema.NullOr(Schema.Unknown), // CraftingItemStack
  isHovered: Schema.Boolean,
  isDragging: Schema.Boolean,
  isDropTarget: Schema.Boolean,
})
export interface CraftingSlotState extends Schema.Schema.Type<typeof CraftingSlotState> {}

export const CraftingGUIState = Schema.Struct({
  _tag: Schema.Literal('CraftingGUIState'),
  sessionId: Schema.String,
  craftingGrid: Schema.Array(Schema.Array(Schema.NullOr(Schema.Unknown))), // CraftingItemStack
  resultSlot: Schema.NullOr(Schema.Unknown), // CraftingItemStack
  selectedRecipe: Schema.NullOr(Schema.String), // RecipeId
  availableRecipes: Schema.Array(Schema.Unknown), // CraftingRecipe[]
  isProcessing: Schema.Boolean,
  isDragging: Schema.Boolean,
  draggedItem: Schema.NullOr(Schema.Unknown), // CraftingItemStack
  draggedFromSlot: Schema.NullOr(Schema.Number),
  hoveredSlot: Schema.NullOr(Schema.Number),
  searchQuery: Schema.String,
  selectedCategory: Schema.String,
  showRecipeBook: Schema.Boolean,
  animations: Schema.Record({ key: Schema.String, value: Schema.Boolean }),
})
export interface CraftingGUIState extends Schema.Schema.Type<typeof CraftingGUIState> {}

// UIイベントのUnion
export const CraftingGUIEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('SlotClicked'),
    slotIndex: Schema.Number,
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    button: Schema.Union(Schema.Literal('left'), Schema.Literal('right')),
    shiftKey: Schema.Boolean,
    ctrlKey: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ItemDragStart'),
    slotIndex: Schema.Number,
    item: Schema.Unknown, // CraftingItemStack
  }),
  Schema.Struct({
    _tag: Schema.Literal('ItemDragEnd'),
    targetSlotIndex: Schema.NullOr(Schema.Number),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ItemDrop'),
    sourceSlot: Schema.Number,
    targetSlot: Schema.Number,
    item: Schema.Unknown, // CraftingItemStack
  }),
  Schema.Struct({
    _tag: Schema.Literal('RecipeSelected'),
    recipeId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('RecipeSearch'),
    query: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CategorySelected'),
    category: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CraftingRequested'),
    recipeId: Schema.NullOr(Schema.String),
    quantity: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('GridCleared'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('RecipeBookToggled'),
  })
)
export type CraftingGUIEvent = Schema.Schema.Type<typeof CraftingGUIEvent>

// アニメーション設定
export const AnimationConfig = Schema.Struct({
  _tag: Schema.Literal('AnimationConfig'),
  duration: Schema.Number,
  easing: Schema.Union(
    Schema.Literal('linear'),
    Schema.Literal('ease-in'),
    Schema.Literal('ease-out'),
    Schema.Literal('ease-in-out')
  ),
  delay: Schema.NullOr(Schema.Number),
})
export interface AnimationConfig extends Schema.Schema.Type<typeof AnimationConfig> {}

// レシピ表示モード
export const RecipeDisplayMode = Schema.Union(Schema.Literal('grid'), Schema.Literal('list'), Schema.Literal('compact'))
export type RecipeDisplayMode = Schema.Schema.Type<typeof RecipeDisplayMode>

// フィルタ設定
export const RecipeFilterConfig = Schema.Struct({
  _tag: Schema.Literal('RecipeFilterConfig'),
  categories: Schema.Array(Schema.String),
  searchQuery: Schema.String,
  showCraftableOnly: Schema.Boolean,
  sortBy: Schema.Union(
    Schema.Literal('name'),
    Schema.Literal('category'),
    Schema.Literal('recently-used'),
    Schema.Literal('most-crafted')
  ),
  displayMode: RecipeDisplayMode,
})
export interface RecipeFilterConfig extends Schema.Schema.Type<typeof RecipeFilterConfig> {}

// ドラッグ&ドロップ状態
export const DragDropState = Schema.Struct({
  _tag: Schema.Literal('DragDropState'),
  isDragging: Schema.Boolean,
  draggedItem: Schema.NullOr(Schema.Unknown), // CraftingItemStack
  sourceSlot: Schema.NullOr(Schema.Number),
  targetSlot: Schema.NullOr(Schema.Number),
  dropEffect: Schema.Union(
    Schema.Literal('none'),
    Schema.Literal('move'),
    Schema.Literal('copy'),
    Schema.Literal('stack')
  ),
  cursorPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
})
export interface DragDropState extends Schema.Schema.Type<typeof DragDropState> {}

// クラフティング結果の表示状態
export const CraftingResultDisplay = Schema.Struct({
  _tag: Schema.Literal('CraftingResultDisplay'),
  result: Schema.optional(Schema.Unknown), // CraftingItemStack
  recipe: Schema.optional(Schema.Unknown), // CraftingRecipe
  canCraft: Schema.Boolean,
  missingIngredients: Schema.Array(Schema.Unknown), // CraftingItemStack[]
  craftCount: Schema.Number,
  showAnimation: Schema.Boolean,
})
export interface CraftingResultDisplay extends Schema.Schema.Type<typeof CraftingResultDisplay> {}

// UIコンフィグ
export const CraftingUIConfig = Schema.Struct({
  _tag: Schema.Literal('CraftingUIConfig'),
  gridSize: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number,
  }),
  slotSize: Schema.Number,
  slotSpacing: Schema.Number,
  enableAnimations: Schema.Boolean,
  enableSounds: Schema.Boolean,
  enableTooltips: Schema.Boolean,
  enableKeyboardShortcuts: Schema.Boolean,
  theme: Schema.Union(Schema.Literal('default'), Schema.Literal('dark'), Schema.Literal('compact')),
})
export interface CraftingUIConfig extends Schema.Schema.Type<typeof CraftingUIConfig> {}

// ツールチップ情報
export const TooltipInfo = Schema.Struct({
  _tag: Schema.Literal('TooltipInfo'),
  title: Schema.String,
  description: Schema.optional(Schema.String),
  ingredients: Schema.optional(Schema.Array(Schema.Unknown)), // CraftingItemStack[]
  craftingTime: Schema.optional(Schema.Number),
  stackSize: Schema.optional(Schema.Number),
  durability: Schema.optional(Schema.Number),
  enchantments: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
})
export interface TooltipInfo extends Schema.Schema.Type<typeof TooltipInfo> {}

// キーボードショートカット
export const KeyboardShortcut = Schema.Struct({
  _tag: Schema.Literal('KeyboardShortcut'),
  key: Schema.String,
  modifiers: Schema.Array(
    Schema.Union(Schema.Literal('ctrl'), Schema.Literal('alt'), Schema.Literal('shift'), Schema.Literal('meta'))
  ),
  action: Schema.String,
  description: Schema.String,
})
export interface KeyboardShortcut extends Schema.Schema.Type<typeof KeyboardShortcut> {}

// クラフティングセッション
export const CraftingSession = Schema.Struct({
  _tag: Schema.Literal('CraftingSession'),
  id: Schema.String,
  playerId: Schema.String,
  startTime: Schema.Number,
  craftingTableType: Schema.Union(
    Schema.Literal('workbench'),
    Schema.Literal('player-inventory'),
    Schema.Literal('furnace'),
    Schema.Literal('enchanting-table'),
    Schema.Literal('anvil'),
    Schema.Literal('smithing-table')
  ),
  grid: Schema.Unknown, // CraftingGrid
  history: Schema.Array(
    Schema.Struct({
      timestamp: Schema.Number,
      action: Schema.String,
      recipe: Schema.optional(Schema.String),
    })
  ),
  stats: Schema.Struct({
    itemsCrafted: Schema.Number,
    recipesUsed: Schema.Number,
    materialsConsumed: Schema.Number,
  }),
})
export interface CraftingSession extends Schema.Schema.Type<typeof CraftingSession> {}
