export {
  EquipmentPieceSchema,
  EquipmentTagSchema,
  assignBonusStats,
  createEquipmentPiece,
  ensureFitsSlot,
  promoteTier,
  withUpdatedTimestamp,
  type EquipmentPiece,
  type EquipmentTag,
} from './aggregate/equipment_piece'
export {
  EquipmentSetSchema,
  carriedWeightPercentage,
  createEquipmentSet,
  emptyEquipmentSet,
  equipPiece,
  findPiece,
  unequipSlot,
  updatePieces,
  type EquipmentSet,
  type Slots,
} from './aggregate/equipment_set'
export { EquipmentServiceLive, EquipmentServiceTag, type EquipmentService } from './application_service/service'
export { analyseEquipmentSet, type EquipmentAnalysisSummary } from './domain_service/analysis'
export { EquipmentRepositoryTag, InMemoryEquipmentRepository, type EquipmentRepository } from './repository/memory'
export * from './types/core'
export {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  applyTierWeight,
  ensureWeightWithinLimit,
  mergeStats,
  parseWeight,
  type EquipmentStats,
  type EquipmentTier,
} from './value_object/item_attributes'
export {
  EquipmentSlotSchema,
  allSlots,
  ensureSlotAllowed,
  equipmentSlotLiterals,
  getSlotCategory,
  type EquipmentSlot,
  type EquipmentSlotLiteral,
} from './value_object/slot'
