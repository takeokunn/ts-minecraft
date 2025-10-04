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
  // Inventory Aggregate
  InventoryAggregate,
  InventoryId,
  InventoryDomainEvent,
  InventoryBusinessRule,

  // Container Aggregate
  ContainerAggregate,
  ContainerId,
  ContainerType,
  ContainerDomainEvent,

  // ItemStack Entity
  ItemStackEntity,
  ItemStackId,
  ItemStackDomainEvent,
} from './aggregate/index.js'

// 値オブジェクト
export type {
  // Core Value Objects
  ItemId,
  SlotPosition,
  StackSize,
  ItemMetadata,
  InventoryType,
  Slot,
} from './value_object/index.js'

// ドメインサービス
export {
  // Item Registry
  ItemRegistryService,
  ItemRegistryServiceLive,

  // Transfer Service
  TransferService,
  TransferServiceLive,

  // Stacking Service
  StackingService,
  StackingServiceLive,

  // Validation Service
  ValidationService,
  ValidationServiceLive,

  // Crafting Integration
  CraftingIntegrationService,
  CraftingIntegrationServiceLive,
} from './domain_service/index.js'

// アプリケーションサービス
export {
  // Inventory Manager
  InventoryManagerService,
  InventoryManagerServiceLive,

  // Container Manager
  ContainerManagerService,
  ContainerManagerServiceLive,

  // Transaction Manager
  TransactionManagerService,
  TransactionManagerServiceLive,
} from './application_service/index.js'

// ファクトリー
export {
  // Aggregate Factories
  InventoryFactory,
  InventoryFactoryLive,
  ContainerFactory,
  ContainerFactoryLive,
  ItemStackFactory,
  ItemStackFactoryLive,

  // Utility Factories
  ItemFactory,
  ItemFactoryLive,
} from './factory/index.js'

// リポジトリ
export {
  // Repository Interfaces
  InventoryRepository,
  ContainerRepository,
  ItemDefinitionRepository,

  // Repository Implementations
  InventoryRepositoryMemory,
  InventoryRepositoryPersistent,
  ContainerRepositoryMemory,
  ContainerRepositoryPersistent,
  ItemDefinitionRepositoryMemory,
  ItemDefinitionRepositoryJsonFile,

  // Repository Layers
  InventoryRepositoryLayer,
} from './repository/index.js'

// ドメインエラー
export {
  // Core Domain Errors
  InventoryAggregateError,
  ContainerError,
  ItemStackError,

  // Repository Errors
  RepositoryError,
} from './types/index.js'

// ドメイン定数
export {
  // Business Constants
  INVENTORY_CONSTANTS,
  CONTAINER_CONSTANTS,
  ITEM_STACK_CONSTANTS,
} from './types/index.js'