/**
 * Inventory Domain Layer - DDD原理主義による完全実装
 *
 * Domain-Driven Design原則に完全準拠した純粋ドメイン層。
 * 技術的依存関係を一切含まない、ビジネスロジックの中核。
 */

// ===== DDD Aggregates =====
// ドメインの中核となる集約ルート群
export * from './aggregate/index.js'

// ===== DDD Value Objects =====
// 不変性を保証する値オブジェクト群
export * from './value_object/index.js'

// ===== DDD Domain Services =====
// 複数集約にまたがる複雑なビジネスロジック
export * from './domain_service/index.js'

// ===== DDD Application Services =====
// ユースケース実行とドメイン協調
export * from './application_service/index.js'

// ===== DDD Factories =====
// 複雑な集約・エンティティの構築
export * from './factory/index.js'

// ===== DDD Repositories =====
// 永続化層の抽象インターフェース
export * from './repository/index.js'

// ===== Domain Types =====
// ドメイン固有型とコアビジネスルール
export * from './types/index.js'

// ===== Integration Layers =====
// 全ドメイン統合レイヤー群
export * from './layers.js'

// ===== 主要な再エクスポート（後方互換性のため） =====

// 集約ルート
export type {
  // Container Aggregate
  ContainerAggregate,
  ContainerDomainEvent,
  ContainerId,
  ContainerType,
  // Inventory Aggregate
  InventoryAggregate,
  InventoryBusinessRule,
  InventoryDomainEvent,
  InventoryId,
  ItemStackDomainEvent,
  // ItemStack Entity
  ItemStackEntity,
  ItemStackId,
} from './aggregate/index.js'

// 値オブジェクト
export type {
  InventoryType,
  // Core Value Objects
  ItemId,
  ItemMetadata,
  Slot,
  SlotPosition,
  StackSize,
} from './value_object/index.js'

// ドメインサービス
export {
  // Crafting Integration
  CraftingIntegrationService,
  CraftingIntegrationServiceLive,
  // Item Registry
  ItemRegistryService,
  ItemRegistryServiceLive,
  // Stacking Service
  StackingService,
  StackingServiceLive,
  // Transfer Service
  TransferService,
  TransferServiceLive,
  // Validation Service
  ValidationService,
  ValidationServiceLive,
} from './domain_service/index.js'

// アプリケーションサービス
export {
  // Container Manager
  ContainerManagerService,
  ContainerManagerServiceLive,
  // Inventory Manager
  InventoryManagerService,
  InventoryManagerServiceLive,
  // Transaction Manager
  TransactionManagerService,
  TransactionManagerServiceLive,
} from './application_service/index.js'

// ファクトリー
export {
  ContainerFactory,
  ContainerFactoryLive,
  // Aggregate Factories
  InventoryFactory,
  InventoryFactoryLive,
  // Utility Factories
  ItemFactory,
  ItemFactoryLive,
  ItemStackFactory,
  ItemStackFactoryLive,
} from './factory/index.js'

// リポジトリ
export {
  ContainerRepository,
  ContainerRepositoryMemory,
  ContainerRepositoryPersistent,
  // Repository Interfaces
  InventoryRepository,
  // Repository Layers
  InventoryRepositoryLayer,
  // Repository Implementations
  InventoryRepositoryMemory,
  InventoryRepositoryPersistent,
  ItemDefinitionRepository,
  ItemDefinitionRepositoryJsonFile,
  ItemDefinitionRepositoryMemory,
} from './repository/index.js'

// ドメインエラー
export {
  ContainerError,
  // Core Domain Errors
  InventoryAggregateError,
  ItemStackError,

  // Repository Errors
  RepositoryError,
} from './types/index.js'

// ドメイン定数
export {
  CONTAINER_CONSTANTS,
  // Business Constants
  INVENTORY_CONSTANTS,
  ITEM_STACK_CONSTANTS,
} from './types/index.js'
