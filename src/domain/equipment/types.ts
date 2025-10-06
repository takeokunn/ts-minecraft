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
} from './aggregate'
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
} from './aggregate'
export { EquipmentServiceLive, EquipmentServiceTag, type EquipmentService } from './application_service'
export { analyseEquipmentSet, type EquipmentAnalysisSummary } from './domain_service'
export { EquipmentRepositoryTag, InMemoryEquipmentRepository, type EquipmentRepository } from './repository'
export * from '@domain/equipment/types'
export {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  applyTierWeight,
  ensureWeightWithinLimit,
  mergeStats,
  parseWeight,
  type EquipmentStats,
  type EquipmentTier,
} from './value_object'
export {
  EquipmentSlotSchema,
  allSlots,
  ensureSlotAllowed,
  equipmentSlotLiterals,
  getSlotCategory,
  type EquipmentSlot,
  type EquipmentSlotLiteral,
} from './value_object'
