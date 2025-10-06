/**
 * Validation Service Module
 *
 * インベントリ検証ドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { CorrectionError, ValidationError, ValidationService, ValidationServiceLive } from './index'
export type {
  CorrectionStep,
  CorrectionSuggestion,
  ValidationOptions,
  ValidationResult,
  ValidationSummary,
  ValidationViolation,
  ValidationViolationType,
  ValidationWarning,
} from './index'

// Live Implementation
export { ValidationServiceLive } from './index'

// Validators
export {
  runAllValidators,
  validateArmorSlots,
  validateDurability,
  validateHotbarSlots,
  validateMetadata,
  validateSelectedSlot,
  validateSlotCount,
  validateStackSizes,
} from './index'
export * from './index';
export * from './index';
export * from './service';
