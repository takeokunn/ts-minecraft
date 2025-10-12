/**
 * Validation Service Module
 *
 * インベントリ検証ドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { CorrectionError, ValidationError, ValidationService } from './service'
export type {
  CorrectionStep,
  CorrectionSuggestion,
  ValidationOptions,
  ValidationResult,
  ValidationSummary,
  ValidationViolation,
  ValidationViolationType,
  ValidationWarning,
} from './service'

// Service Factory
export { makeValidationService } from './live'

// Validators
export * from './service'
export {
  runAllValidators,
  validateArmorSlots,
  validateDurability,
  validateHotbarSlots,
  validateMetadata,
  validateSelectedSlot,
  validateSlotCount,
  validateStackSizes,
} from './service'
