/**
 * Inventory Domain Integration Layers
 *
 * DDD原理主義に基づくInventoryドメインの統合レイヤー群。
 * 全てのドメインサービス、アプリケーションサービス、リポジトリを統合。
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

// ===== Application Services Layer =====
import {
  ContainerManagerServiceLive,
  InventoryManagerServiceLive,
  TransactionManagerServiceLive,
} from './application_service/index'

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
 * Inventory Application Services Layer
 *
 * 全てのInventoryアプリケーションサービスを統合したレイヤー。
 * ユースケース実行とドメイン協調を担当。
 */
export const InventoryApplicationServicesLayer = Layer.mergeAll(
  InventoryManagerServiceLive,
  ContainerManagerServiceLive,
  TransactionManagerServiceLive
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
 * ドメインサービス群とファクトリー群を統合したレイヤー。
 * 純粋なドメインロジックを提供。
 */
export const InventoryDomainLayer = Layer.mergeAll(InventoryDomainServicesLayer, InventoryFactoryLayer)

/**
 * Inventory Application Layer
 *
 * アプリケーションサービス群とドメイン層を統合したレイヤー。
 * ユースケース実行に必要な全要素を提供。
 */
export const InventoryApplicationLayer = Layer.mergeAll(InventoryDomainLayer, InventoryApplicationServicesLayer)

/**
 * Inventory Infrastructure Layer
 *
 * リポジトリレイヤーを統合。
 * 永続化・技術的詳細を分離。
 */
export const InventoryInfrastructureLayer = Layer.mergeAll(InventoryRepositoryLayer)

/**
 * Inventory Complete Layer
 *
 * Inventoryドメインの全レイヤーを統合した完全なレイヤー。
 * アプリケーション開発で使用する統合レイヤー。
 *
 * 含まれる要素:
 * - 全ドメインサービス
 * - 全アプリケーションサービス
 * - 全ファクトリー
 * - 全リポジトリ
 */
export const InventoryCompleteLayer = Layer.mergeAll(InventoryApplicationLayer, InventoryInfrastructureLayer)

/**
 * Inventory Test Layer
 *
 * テスト用の軽量レイヤー。
 * インメモリ実装のみを使用し、高速なテスト実行を可能にする。
 */
export const InventoryTestLayer = Layer.mergeAll(
  InventoryDomainServicesLayer,
  InventoryFactoryLayer,
  // テスト用はメモリリポジトリのみ使用
  Layer.mergeAll(
    // TODO: メモリ実装のみの軽量リポジトリレイヤーを作成
    InventoryRepositoryLayer
  )
)

// ===== レイヤー使用例 =====

/**
 * 使用例1: 完全なInventoryシステム
 *
 * ```typescript
 * import { InventoryCompleteLayer } from './domain/inventory/layers'
 *
 * const program = Effect.gen(function* () {
 *   const inventoryManager = yield* InventoryManagerService
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
