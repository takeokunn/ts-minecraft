/**
 * @fileoverview Inventory Domain Layer
 * Domain層の依存関係を提供（Repository層 + Domain Service層 + Factory層）
 */

import { Layer } from 'effect'

// ===== Domain Services Layer =====
import {
  CraftingIntegrationServiceLive,
  ItemRegistryServiceLive,
  StackingServiceLive,
  TransferServiceLive,
  ValidationServiceLive,
} from './domain_service/index'

// ===== Factory Layer =====
import { ContainerFactoryLayer } from './aggregate/container/factory'
import { InventoryFactoryLayer as InventoryAggregateFactoryLayer } from './aggregate/inventory/factory'
import { ItemStackFactoryLayer } from './aggregate/item_stack/factory'
import { ItemFactoryLayer } from './factory/item_factory/factory'

// ===== Repository Layer =====
import { InventoryRepositoryLayer } from './repository/index'

/**
 * Inventory Domain Services Layer
 *
 * 全てのInventoryドメインサービスを統合したレイヤー。
 * 複数集約にまたがるビジネスロジックを提供。
 */
export const InventoryDomainServicesLayer = Layer.mergeAll(
  ItemRegistryServiceLive,
  TransferServiceLive,
  StackingServiceLive,
  ValidationServiceLive,
  CraftingIntegrationServiceLive
)

/**
 * Inventory Factory Layer
 *
 * 全てのInventoryファクトリーを統合したレイヤー。
 * 複雑な集約・エンティティの構築を担当。
 */
export const InventoryFactoryLayer = Layer.mergeAll(
  InventoryAggregateFactoryLayer,
  ContainerFactoryLayer,
  ItemStackFactoryLayer,
  ItemFactoryLayer
)

/**
 * Inventory Domain Layer
 *
 * ドメインサービス群、ファクトリー群、リポジトリ群を統合したレイヤー。
 * 純粋なドメインロジックとインフラストラクチャを提供。
 *
 * FR-1により、Application ServiceはDomain層から分離されました。
 */
export const InventoryDomainLive = Layer.mergeAll(
  InventoryDomainServicesLayer,
  InventoryFactoryLayer,
  InventoryRepositoryLayer
)

// ===== レイヤー使用例 =====

/**
 * 使用例1: 完全なInventoryシステム
 *
 * ```typescript
 * import { InventoryCompleteLayer } from './domain/inventory/layers'
 *
 * const program = Effect.gen(function* () {
 *   const inventoryManager = yield* InventoryManagerApplicationService
 *   const result = yield* inventoryManager.createPlayerInventory(playerId)
 *   return result
 * })
 *
 * Effect.provide(program, InventoryCompleteLayer)
 * ```
 */

/**
 * 使用例2: ドメインロジックのみ
 *
 * ```typescript
 * import { InventoryDomainLayer } from './domain/inventory/layers'
 *
 * const program = Effect.gen(function* () {
 *   const transferService = yield* TransferService
 *   const result = yield* transferService.transferItem(request)
 *   return result
 * })
 *
 * Effect.provide(program, InventoryDomainLayer)
 * ```
 */

/**
 * 使用例3: テスト環境
 *
 * ```typescript
 * import { InventoryTestLayer } from './domain/inventory/layers'
 *
 * const testProgram = Effect.gen(function* () {
 *   // 高速なインメモリテスト
 * })
 *
 * Effect.provide(testProgram, InventoryTestLayer)
 * ```
 */
