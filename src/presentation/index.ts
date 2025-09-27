/**
 * Presentation Layer - ユーザーインターフェースとプレゼンテーション
 *
 * このレイヤーはユーザーインターフェースの実装を提供し、
 * ユーザーとの対話を管理します。
 */

// Inventory GUI exports
export * from './gui/inventory'

// Crafting GUI exports
export {
  // Service
  CraftingGUIService,
  CraftingGUIServiceLive,
  CraftingGrid,
  CraftingGridStyles,
  CraftingResult,
  // React Components
  CraftingTableGUI,
  RecipeBook,
  RecipeDisplay,
  type CraftingGUIEvent,
  // Types
  type CraftingGUIState,
  type CraftingResultDisplay,
  type CraftingSession,
  type CraftingUIConfig,
  type DragDropState,
  type KeyboardShortcut,
  type RecipeDisplayMode,
  type RecipeFilterConfig,
  type TooltipInfo,
} from './gui/crafting'
