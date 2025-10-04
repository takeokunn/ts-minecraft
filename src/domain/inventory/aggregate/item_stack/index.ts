/**
 * @fileoverview ItemStackエンティティのバレルエクスポート
 * DDD原則に基づくクリーンなエンティティインターフェース
 */

// Types
export type {
  Durability,
  Enchantment,
  ItemCount,
  ItemNBTData,
  ItemStackConsumedEvent,
  ItemStackDamageEvent,
  ItemStackDomainEvent,
  ItemStackEntity,
  ItemStackId,
  ItemStackMergedEvent,
  ItemStackSplitEvent,
} from './types.js'

export {
  DurabilitySchema,
  EnchantmentSchema,
  ITEM_STACK_CONSTANTS,
  ItemCountSchema,
  ItemNBTDataSchema,
  ItemStackConsumedEventSchema,
  ItemStackDamageEventSchema,
  ItemStackDomainEventSchema,
  ItemStackEntitySchema,
  ItemStackError,
  ItemStackIdSchema,
  ItemStackMergedEventSchema,
  ItemStackSplitEventSchema,
} from './types.js'

// Factory
export type { ItemStackBuilder, ItemStackCreateOptions, ItemStackFactory } from './factory.js'

export {
  ItemStackFactory,
  ItemStackFactoryLive,
  createDurableItemStack,
  createEnchantedItemStack,
  createSimpleItemStack,
  incrementEntityVersion,
} from './factory.js'

// Operations
export {
  areItemStacksIdentical,
  canStackWith,
  consumeItemStack,
  damageItemStack,
  getMaxStackableQuantity,
  isBroken,
  isEnchanted,
  isFullDurability,
  mergeItemStacks,
  repairItemStack,
  splitItemStack,
} from './operations.js'
