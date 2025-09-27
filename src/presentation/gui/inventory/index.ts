/**
 * Inventory GUI Module
 *
 * Exports all inventory GUI components, hooks, and services
 * Main entry point for the inventory user interface
 */

// Components
export { InventoryPanel } from './components/InventoryPanel'
export { ItemSlot } from './components/ItemSlot'
export { ItemIcon } from './components/ItemIcon'
export { ItemTooltip } from './components/ItemTooltip'
export { HotbarPanel } from './components/HotbarPanel'
export { ArmorSlots } from './components/ArmorSlots'

// Hooks
export { useInventoryKeyboardShortcuts, INVENTORY_SHORTCUTS } from './hooks/useKeyboardShortcuts'
export { useInventoryAnimations, ANIMATION_PRESETS } from './hooks/useAnimations'

// Service
export { InventoryGUIService, InventoryGUIServiceLive } from './InventoryGUIService'

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
  InventoryGUIError,
} from './types'

export {
  defaultInventoryGUIConfig,
  createSlotPosition,
  getSlotGridPosition,
  isValidSlotTransfer,
  SlotPosition,
  DragItemId,
} from './types'
