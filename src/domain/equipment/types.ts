export * from './types/core'
export {
  EquipmentSlotSchema,
  type EquipmentSlot,
  type EquipmentSlotLiteral,
  allSlots,
  equipmentSlotLiterals,
  ensureSlotAllowed,
  getSlotCategory,
} from './value_object/slot'
export {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  type EquipmentStats,
  type EquipmentTier,
  mergeStats,
  applyTierWeight,
  ensureWeightWithinLimit,
  parseWeight,
} from './value_object/item-attributes'
export {
  EquipmentPieceSchema,
  type EquipmentPiece,
  EquipmentTagSchema,
  type EquipmentTag,
  createEquipmentPiece,
  assignBonusStats,
  promoteTier,
  ensureFitsSlot,
  withUpdatedTimestamp,
} from './aggregate/equipment-piece'
export {
  EquipmentSetSchema,
  type EquipmentSet,
  type Slots,
  createEquipmentSet,
  equipPiece,
  unequipSlot,
  updatePieces,
  emptyEquipmentSet,
  carriedWeightPercentage,
  findPiece,
} from './aggregate/equipment-set'
export {
  analyseEquipmentSet,
  type EquipmentAnalysisSummary,
} from './domain_service/analysis'
export {
  EquipmentRepositoryTag,
  InMemoryEquipmentRepository,
  type EquipmentRepository,
} from './repository/memory'
export {
  EquipmentServiceTag,
  EquipmentServiceLive,
  type EquipmentService,
} from './application_service/service'
