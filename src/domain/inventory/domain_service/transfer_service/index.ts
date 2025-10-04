/**
 * Transfer Service Module
 *
 * アイテム転送ドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { BatchTransferError, TransferError, TransferService, TransferServiceLive } from './service'
export type {
  BatchTransferRequest,
  OptimizedTransferOptions,
  TransferConstraint,
  TransferRequest,
  TransferResult,
  TransferabilityDetails,
} from './service'

// Live Implementation
export { TransferServiceLive } from './live'

// Specifications
export {
  CanTransferSpecification,
  SourceItemExistsSpecification,
  StackLimitSpecification,
  TargetSlotAvailableSpecification,
  ValidItemCountSpecification,
  ValidSlotSpecification,
  analyzeTransferability,
} from './specifications'
export type { TransferSpecification } from './specifications'
