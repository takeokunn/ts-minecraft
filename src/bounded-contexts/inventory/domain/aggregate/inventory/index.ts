/**
 * @fileoverview Inventory集約のバレルエクスポート
 * DDD原則に基づくクリーンな集約インターフェース
 */

// Types
export type {
  ArmorSlot,
  HotbarChangedEvent,
  HotbarSlot,
  InventoryAggregate,
  InventoryBusinessRule,
  InventoryDomainEvent,
  InventoryId,
  InventorySlot,
  ItemAddedEvent,
  ItemRemovedEvent,
  ItemsSwappedEvent,
  SlotIndex,
} from './types.js'

export {
  ArmorSlotSchema,
  HotbarChangedEventSchema,
  HotbarSlotSchema,
  INVENTORY_CONSTANTS,
  InventoryAggregateError,
  InventoryAggregateSchema,
  InventoryBusinessRuleSchema,
  InventoryDomainEventSchema,
  InventoryIdSchema,
  InventorySlotSchema,
  ItemAddedEventSchema,
  ItemRemovedEventSchema,
  ItemsSwappedEventSchema,
  SlotIndexSchema,
} from './types.js'

// Factory
export {
  InventoryFactory,
  InventoryFactoryLive,
  addUncommittedEvent,
  clearUncommittedEvents,
  createDefaultHotbar,
  createEmptyArmorSlot,
  createEmptySlot,
  incrementVersion,
} from './factory.js'
export type { InventoryBuilder, InventoryFactory } from './factory.js'

// Operations
export {
  addItem,
  changeSelectedHotbarSlot,
  findItemSlots,
  getEmptySlotCount,
  getItemCount,
  getSelectedHotbarItem,
  isEmpty,
  isFull,
  removeAllItems,
  removeItem,
  swapItems,
} from './operations.js'

// Specifications
export {
  AndSpecification,
  CanAddItemSpecification,
  CanRemoveItemSpecification,
  HasSufficientSpaceSpecification,
  INVENTORY_BUSINESS_RULES,
  InventoryIntegritySpecification,
  NotSpecification,
  OrSpecification,
  ValidHotbarSlotSpecification,
  ValidSlotIndexSpecification,
  ValidStackSizeSpecification,
  validateMultipleSpecifications,
  validateSpecification,
} from './specifications.js'
export type { InventorySpecification } from './specifications.js'
