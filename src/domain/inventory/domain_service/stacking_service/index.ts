/**
 * Stacking Service Module
 *
 * アイテムスタッキングドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { StackOptimizationError, StackingError, StackingService, StackingServiceLive } from './index'
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
} from './index'

// Live Implementation
export { StackingServiceLive } from './index'

// Rules and Constraints
export {
  checkCompleteStackCompatibility,
  checkDurabilityCompatibility,
  checkItemIdCompatibility,
  checkMetadataCompatibility,
  checkStackLimitRule,
  resolveMetadataConflicts,
} from './index'
export * from './index';
export * from './index';
export * from './service';
