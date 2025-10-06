/**
 * @fileoverview Equipment値オブジェクトのバレルエクスポート
 * 装備スロットとアイテム属性
 */

// Slot
export type { EquipmentSlot, EquipmentSlotLiteral, SlotCategory } from './index'
export {
  EquipmentSlotSchema,
  allSlots,
  decodeSlot,
  encodeSlot,
  equipmentSlotLiterals,
  getSlotCategory,
} from './index'

// Item Attributes
export type { EquipmentStats, EquipmentTier } from './index'
export {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  getTierMultiplier,
  mergeStats,
  parseWeight,
} from './index'
export * from './slot';
export * from './item_attributes';
