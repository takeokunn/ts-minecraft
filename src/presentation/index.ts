/**
 * Presentation Layer - ユーザーインターフェースとプレゼンテーション
 *
 * このレイヤーはユーザーインターフェースの実装を提供し、
 * ユーザーとの対話を管理します。
 */

// Crafting GUI exports
export {
  // Types
  type CraftingGUIState,
  type CraftingGUIEvent,
  type CraftingSession,
  type CraftingResultDisplay,
  type RecipeFilterConfig,
  type DragDropState,
  type TooltipInfo,
  type CraftingUIConfig,
  type KeyboardShortcut,
  type RecipeDisplayMode,

  // Service
  CraftingGUIService,
  CraftingGUIServiceLive,

  // React Components
  CraftingTableGUI,
  CraftingGrid,
  CraftingGridStyles,
  RecipeDisplay,
  RecipeBook,
  CraftingResult
} from './crafting'
