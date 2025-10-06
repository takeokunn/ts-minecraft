/**
 * @fileoverview Equipment値オブジェクトのバレルエクスポート
 * 装備スロットとアイテム属性
 */

// Slot
export {
  EquipmentSlotSchema,
  allSlots,
  decodeSlot,
  encodeSlot,
  equipmentSlotLiterals,
  getSlotCategory,
} from './item_attributes'
export type { EquipmentSlot, EquipmentSlotLiteral, SlotCategory } from './item_attributes'

// Item Attributes
export * from './item_attributes'
export {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  getTierMultiplier,
  mergeStats,
  parseWeight,
} from './item_attributes'
export type { EquipmentStats, EquipmentTier } from './item_attributes'
export * from './slot'
