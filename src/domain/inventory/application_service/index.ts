/**
 * Inventory Application Service Layer
 *
 * DDD原理主義 - アプリケーションサービス層統合エクスポート
 * CQRSパターンと複雑なワークフロー管理を提供
 */

// アプリケーションサービス
export * from './inventory_manager'
export * from './container_manager'
export * from './transaction_manager'

// 型定義
export * from './types/errors'

// Layer統合
import { Layer } from 'effect'
import { InventoryManagerApplicationServiceLive } from './inventory_manager'
import { ContainerManagerApplicationServiceLive } from './container_manager'
import { TransactionManagerApplicationServiceLive } from './transaction_manager'

/**
 * 全アプリケーションサービスの統合Layer
 *
 * 使用例:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const inventoryManager = yield* InventoryManagerApplicationService
 *   const containerManager = yield* ContainerManagerApplicationService
 *   const transactionManager = yield* TransactionManagerApplicationService
 *
 *   // アプリケーションロジック
 * }).pipe(Effect.provide(InventoryApplicationServicesLayer))
 * ```
 */
export const InventoryApplicationServicesLayer = Layer.mergeAll(
  InventoryManagerApplicationServiceLive,
  ContainerManagerApplicationServiceLive,
  TransactionManagerApplicationServiceLive
)