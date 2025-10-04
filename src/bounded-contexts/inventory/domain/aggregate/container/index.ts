/**
 * @fileoverview Container集約のバレルエクスポート
 * DDD原則に基づくクリーンな集約インターフェース
 */

// Types
export type {
  ContainerAccessLevel,
  ContainerAggregate,
  ContainerClosedEvent,
  ContainerConfiguration,
  ContainerDomainEvent,
  ContainerId,
  ContainerOpenedEvent,
  ContainerPermission,
  ContainerPermissionGrantedEvent,
  ContainerSlot,
  ContainerSlotIndex,
  ContainerSortedEvent,
  ContainerType,
  ItemPlacedInContainerEvent,
  ItemRemovedFromContainerEvent,
  WorldPosition,
} from './types.js'

export {
  CONTAINER_CONSTANTS,
  CONTAINER_SLOT_CONFIGURATIONS,
  ContainerAccessLevelSchema,
  ContainerAggregateSchema,
  ContainerClosedEventSchema,
  ContainerConfigurationSchema,
  ContainerDomainEventSchema,
  ContainerError,
  ContainerIdSchema,
  ContainerOpenedEventSchema,
  ContainerPermissionGrantedEventSchema,
  ContainerPermissionSchema,
  ContainerSlotIndexSchema,
  ContainerSlotSchema,
  ContainerSortedEventSchema,
  ContainerTypeSchema,
  ItemPlacedInContainerEventSchema,
  ItemRemovedFromContainerEventSchema,
  WorldPositionSchema,
} from './types.js'

// Factory
export type { ContainerBuilder, ContainerCreateOptions, ContainerFactory } from './factory.js'

export {
  ContainerFactory,
  ContainerFactoryLive,
  addContainerUncommittedEvent,
  clearContainerUncommittedEvents,
  createChest,
  createDoubleChest,
  createEmptyContainerSlot,
  createFurnace,
  createHopper,
  createShulkerBox,
  getMaxSlotsForType,
  getSpecialSlotsForType,
  incrementContainerVersion,
} from './factory.js'

// Operations
export {
  closeContainer,
  findItemSlots,
  getEmptySlotCount,
  getItemCount,
  grantPermission,
  isContainerEmpty,
  isContainerFull,
  isContainerOpen,
  isPlayerViewing,
  openContainer,
  placeItemInContainer,
  removeItemFromContainer,
  sortContainer,
} from './operations.js'
