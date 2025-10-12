/**
 * Stacking Service Module
 *
 * アイテムスタッキングドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { StackOptimizationError, StackingError, StackingService } from './service'
export type {
  MetadataConflict,
  MetadataResolutionStrategy,
  StackCompatibility,
  StackIncompatibilityReason,
  StackOperation,
  StackOptimizationOptions,
  StackOptimizationResult,
  StackSplitRequest,
  StackSplitResult,
} from './service'

// Service Factory
export { makeStackingService } from './live'

// Rules and Constraints
export * from './service'
export {
  checkCompleteStackCompatibility,
  checkDurabilityCompatibility,
  checkItemIdCompatibility,
  checkMetadataCompatibility,
  checkStackLimitRule,
  resolveMetadataConflicts,
} from './service'
