/**
 * Inventory Domain Services Layer
 *
 * 全インベントリドメインサービスの統合レイヤー
 */

import { Layer } from 'effect'
import { CraftingIntegrationServiceLive } from './crafting_integration'
import { ItemRegistryServiceLive } from './item_registry'
import { StackingServiceLive } from './stacking_service'
import { TransferServiceLive } from './transfer_service'
import { ValidationServiceLive } from './validation_service'

/**
 * 全インベントリドメインサービスの統合レイヤー
 *
 * 全てのドメインサービスを一度に提供する便利なレイヤー。
 * 各サービスは独立して使用することも可能。
 *
 * @example
 * ```typescript
 * // 全サービスを提供
 * const program = Effect.gen(function* () {
 *   const transferService = yield* TransferService
 *   const stackingService = yield* StackingService
 *   const validationService = yield* ValidationService
 *   const itemRegistry = yield* ItemRegistryService
 *   const craftingIntegration = yield* CraftingIntegrationService
 *
 *   // サービスを使用した処理...
 * })
 *
 * Effect.provide(program, InventoryDomainServicesLive)
 * ```
 */
export const InventoryDomainServicesLive = Layer.mergeAll(
  TransferServiceLive,
  StackingServiceLive,
  ValidationServiceLive,
  ItemRegistryServiceLive,
  CraftingIntegrationServiceLive
)
