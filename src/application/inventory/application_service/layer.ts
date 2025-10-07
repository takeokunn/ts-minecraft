/**
 * Inventory Application Service Layer
 *
 * 全アプリケーションサービスの統合Layer
 */

import { Layer } from 'effect'
import { ContainerManagerApplicationServiceLive } from './container_manager'
import { InventoryManagerApplicationServiceLive } from './inventory_manager'
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
