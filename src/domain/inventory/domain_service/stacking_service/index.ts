/**
 * Stacking Service Module
 *
 * アイテムスタッキングドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { StackOptimizationError, StackingError, StackingService, StackingServiceLive } from './service'
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

// Live Implementation
export { StackingServiceLive } from './live'

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
