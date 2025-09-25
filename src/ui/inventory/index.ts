/**
 * Inventory GUI Module
 *
 * Exports all inventory GUI components, hooks, and services
 * Main entry point for the inventory user interface
 */

// Components
export { InventoryPanel } from './components/InventoryPanel.js'
export { ItemSlot } from './components/ItemSlot.js'
export { ItemIcon } from './components/ItemIcon.js'
export { ItemTooltip } from './components/ItemTooltip.js'
export { HotbarPanel } from './components/HotbarPanel.js'
export { ArmorSlots } from './components/ArmorSlots.js'

// Hooks
export { useInventoryKeyboardShortcuts, INVENTORY_SHORTCUTS } from './hooks/useKeyboardShortcuts.js'
export { useInventoryAnimations, ANIMATION_PRESETS } from './hooks/useAnimations.js'

// Service
export { InventoryGUIService, InventoryGUIServiceLive } from './InventoryGUIService.js'

// Types
export type {
  InventorySlot,
  SlotType,
  InventorySection,
  DragState,
  DropResult,
  InventoryGUIEvent,
  InventoryGUIConfig,
  InventoryTheme,
  InventoryPanelProps,
  ItemSlotProps,
  ItemIconProps,
  ItemTooltipProps,
  SlotAnimationState,
  ItemTransferAnimation,
  HotbarState,
  InventoryGUIError
} from './types.js'

export {
  defaultInventoryGUIConfig,
  createSlotPosition,
  getSlotGridPosition,
  isValidSlotTransfer,
  SlotPosition,
  DragItemId
} from './types.js'