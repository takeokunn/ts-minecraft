/**
 * Transfer Service Module
 *
 * アイテム転送ドメインサービスのバレルエクスポート。
 * DDD原則に従い、純粋なドメインロジックとして実装されています。
 */

// Service Interface and Implementation
export { BatchTransferError, TransferError, TransferService } from './service'
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
export * from './service'
export {
  CanTransferSpecification,
  SourceItemExistsSpecification,
  StackLimitSpecification,
  TargetSlotAvailableSpecification,
  ValidItemCountSpecification,
  ValidSlotSpecification,
  analyzeTransferability,
} from './service'
export type { TransferSpecification } from './service'
