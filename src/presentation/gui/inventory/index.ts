/**
 * Inventory GUI Module
 *
 * Exports all inventory GUI components, hooks, and services
 * Main entry point for the inventory user interface
 */

// Components
export { ArmorSlots } from './components/ArmorSlots'
export { HotbarPanel } from './components/HotbarPanel'
export { InventoryPanel } from './components/InventoryPanel'
export { ItemIcon } from './components/ItemIcon'
export { ItemSlot } from './components/ItemSlot'
export { ItemTooltip } from './components/ItemTooltip'

// Hooks
export { ANIMATION_PRESETS, useInventoryAnimations } from './hooks/useAnimations'
export { INVENTORY_SHORTCUTS, useInventoryKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// Service
export { InventoryGUIService, InventoryGUIServiceLive } from './InventoryGUIService'

// Types
export type {
  DragState,
  DropResult,
  HotbarState,
  InventoryGUIConfig,
  InventoryGUIError,
  InventoryGUIEvent,
  InventoryPanelProps,
  InventorySection,
  InventorySlot,
  InventoryTheme,
  ItemIconProps,
  ItemSlotProps,
  ItemTooltipProps,
  ItemTransferAnimation,
  SlotAnimationState,
  SlotType,
} from './types'

export {
  DragItemId,
  SlotPosition,
  createSlotPosition,
  defaultInventoryGUIConfig,
  getSlotGridPosition,
  isValidSlotTransfer,
} from './types'
