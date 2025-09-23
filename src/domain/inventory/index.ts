/**
 * InventoryService - Complete inventory management system
 *
 * Provides comprehensive inventory operations including:
 * - 36-slot inventory management
 * - Item stacking and merging
 * - Hotbar management (9 slots)
 * - Armor slots (4 pieces)
 * - Offhand slot
 * - Drag & drop support
 * - Persistence support
 */

// Service interface
export { InventoryService, InventoryError } from './InventoryService.js'

// Service implementation
export { InventoryServiceLive } from './InventoryServiceLive.js'

// Core types and schemas
export {
  ItemId,
  PlayerId,
  ItemMetadata,
  ItemStack,
  Inventory,
  AddItemResult,
  InventoryState,
  InventoryErrorReason,
  createEmptyInventory,
  validateItemStack,
  validateInventory,
  validateAddItemResult,
  validateInventoryState,
} from './InventoryTypes.js'

// Type-only exports for schemas
export type {
  ItemMetadata as ItemMetadataType,
  ItemStack as ItemStackType,
  Inventory as InventoryType,
  AddItemResult as AddItemResultType,
  InventoryState as InventoryStateType,
  InventoryErrorReason as InventoryErrorReasonType,
} from './InventoryTypes.js'

// Item Registry
export { ItemRegistry } from './ItemRegistry.js'
export type { ItemDefinition, ItemCategory } from './ItemRegistry.js'

// Slot Manager (utility exports)
export { SlotManager } from './SlotManager.js'

// Stack Processor (utility exports)
export { StackProcessor } from './StackProcessor.js'

// Re-export commonly used functions
export const INVENTORY_CONSTANTS = {
  MAX_SLOTS: 36,
  HOTBAR_SIZE: 9,
  MAX_STACK_SIZE: 64,
  ARMOR_SLOTS: 4,
} as const

// Version info
export const INVENTORY_VERSION = '1.0.0' as const
