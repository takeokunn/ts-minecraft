/**
 * Transfer Service Module
 *
 * アイテム転送ドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { BatchTransferError, TransferError, TransferService, TransferServiceLive } from './index'
export type {
  BatchTransferRequest,
  OptimizedTransferOptions,
  TransferConstraint,
  TransferRequest,
  TransferResult,
  TransferabilityDetails,
} from './index'

// Live Implementation
export { TransferServiceLive } from './index'

// Specifications
export {
  CanTransferSpecification,
  SourceItemExistsSpecification,
  StackLimitSpecification,
  TargetSlotAvailableSpecification,
  ValidItemCountSpecification,
  ValidSlotSpecification,
  analyzeTransferability,
} from './index'
export type { TransferSpecification } from './index'
export * from './index';
export * from './index';
export * from './service';
