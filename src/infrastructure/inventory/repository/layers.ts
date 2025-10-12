import {
  ContainerRepositoryMemory,
  ContainerRepositoryPersistent,
  ContainerRepositoryPersistentDefault,
  DefaultContainerPersistentConfig,
  type ContainerPersistentConfig,
} from '@domain/inventory/repository/container_repository'
import { InventoryRepositoryMemory } from '@domain/inventory/repository/inventory_repository'
import { ItemDefinitionRepositoryMemory } from '@domain/inventory/repository/item_definition_repository'
import { createUnifiedInventoryRepository, UnifiedInventoryRepository } from '@domain/inventory/repository/unified'
import { Effect, Layer, Match, pipe } from 'effect'
import {
  DefaultPersistentConfig as DefaultInventoryPersistentConfig,
  InventoryRepositoryPersistent,
  InventoryRepositoryPersistentDefault,
  type PersistentConfig as InventoryPersistentConfig,
} from './inventory/persistent'
import {
  DefaultJsonFileConfig,
  ItemDefinitionRepositoryJsonFile,
  ItemDefinitionRepositoryJsonFileDefault,
  type JsonFileConfig,
} from './item_definition/json-file'

// =============================================================================
// Inventory Repository Layers
// =============================================================================

/**
 * Inventory Repository 実装選択Layer
 */
export const InventoryRepositoryLayers = {
  /**
   * メモリ実装（テスト・開発用途）
   */
  memory: InventoryRepositoryMemory,

  /**
   * 永続化実装（ブラウザ用途）
   */
  persistent: (config?: InventoryPersistentConfig) =>
    config ? InventoryRepositoryPersistent(config) : InventoryRepositoryPersistentDefault,

  /**
   * 永続化実装（デフォルト設定）
   */
  persistentDefault: InventoryRepositoryPersistentDefault,

  /**
   * 環境に応じた自動選択
   * - ブラウザ環境: 永続化実装（LocalStorage/IndexedDB）
   * - Node.js環境: メモリ実装（永続化は未対応）
   */
  auto: Layer.unwrapEffect(
    Effect.gen(function* () {
      const isBrowser = yield* Effect.sync(() => typeof window !== 'undefined' && typeof localStorage !== 'undefined')
      return pipe(
        Match.value(isBrowser),
        Match.when(true, () => InventoryRepositoryLayers.persistentDefault),
        Match.orElse(() => InventoryRepositoryLayers.memory)
      )
    })
  ),
} as const

// =============================================================================
// Item Definition Repository Layers
// =============================================================================

/**
 * Item Definition Repository 実装選択Layer
 */
export const ItemDefinitionRepositoryLayers = {
  /**
   * メモリ実装（テスト・開発用途）
   */
  memory: ItemDefinitionRepositoryMemory,

  /**
   * JSONファイル実装（サーバーサイド・デスクトップ用途）
   */
  jsonFile: (config?: JsonFileConfig) =>
    config ? ItemDefinitionRepositoryJsonFile(config) : ItemDefinitionRepositoryJsonFileDefault,

  /**
   * JSONファイル実装（デフォルト設定）
   */
  jsonFileDefault: ItemDefinitionRepositoryJsonFileDefault,

  /**
   * 環境に応じた自動選択
   * - Node.js環境: JSONファイル実装
   * - ブラウザ環境: メモリ実装（ファイルアクセス不可）
   */
  auto: Layer.unwrapEffect(
    Effect.gen(function* () {
      const isNodeJS = yield* Effect.sync(() => typeof process !== 'undefined' && process.versions?.node)
      return pipe(
        Match.value(Boolean(isNodeJS)),
        Match.when(true, () => ItemDefinitionRepositoryLayers.jsonFileDefault),
        Match.orElse(() => ItemDefinitionRepositoryLayers.memory)
      )
    })
  ),
} as const

// =============================================================================
// Container Repository Layers
// =============================================================================

/**
 * Container Repository 実装選択Layer
 */
export const ContainerRepositoryLayers = {
  /**
   * メモリ実装（テスト・開発用途）
   */
  memory: ContainerRepositoryMemory,

  /**
   * 永続化実装（ブラウザ用途）
   */
  persistent: (config?: ContainerPersistentConfig) =>
    config ? ContainerRepositoryPersistent(config) : ContainerRepositoryPersistentDefault,

  /**
   * 永続化実装（デフォルト設定）
   */
  persistentDefault: ContainerRepositoryPersistentDefault,

  /**
   * 環境に応じた自動選択
   * - ブラウザ環境: 永続化実装（LocalStorage/IndexedDB）
   * - Node.js環境: メモリ実装（永続化は未対応）
   */
  auto: Layer.unwrapEffect(
    Effect.gen(function* () {
      const isBrowser = yield* Effect.sync(() => typeof window !== 'undefined' && typeof localStorage !== 'undefined')
      return pipe(
        Match.value(isBrowser),
        Match.when(true, () => ContainerRepositoryLayers.persistentDefault),
        Match.orElse(() => ContainerRepositoryLayers.memory)
      )
    })
  ),
} as const

export const UnifiedInventoryRepositoryLive = createUnifiedInventoryRepository(
  InventoryRepositoryLayers.auto,
  ItemDefinitionRepositoryLayers.auto,
  ContainerRepositoryLayers.auto
)

// =============================================================================
// Environment-specific Layer Configurations
// =============================================================================

/**
 * 開発環境用Layer（全メモリ実装）
 */
export const DevelopmentInventoryRepositoryLayers = createUnifiedInventoryRepository(
  InventoryRepositoryLayers.memory,
  ItemDefinitionRepositoryLayers.memory,
  ContainerRepositoryLayers.memory
)

/**
 * テスト環境用Layer（全メモリ実装）
 */
export const TestInventoryRepositoryLayers = createUnifiedInventoryRepository(
  InventoryRepositoryLayers.memory,
  ItemDefinitionRepositoryLayers.memory,
  ContainerRepositoryLayers.memory
)

/**
 * プロダクション環境用Layer（環境自動判定）
 */
export const ProductionInventoryRepositoryLayers = UnifiedInventoryRepositoryLive

/**
 * ブラウザ環境用Layer（永続化 + メモリ）
 */
export const BrowserInventoryRepositoryLayers = createUnifiedInventoryRepository(
  InventoryRepositoryLayers.persistentDefault,
  ItemDefinitionRepositoryLayers.memory,
  ContainerRepositoryLayers.persistentDefault
)

/**
 * サーバー環境用Layer（JSONファイル + メモリ）
 */
export const ServerInventoryRepositoryLayers = createUnifiedInventoryRepository(
  InventoryRepositoryLayers.memory,
  ItemDefinitionRepositoryLayers.jsonFileDefault,
  ContainerRepositoryLayers.memory
)

/**
 * ハイブリッド環境用Layer（永続化 + JSONファイル + 永続化）
 */
export const HybridInventoryRepositoryLayers = createUnifiedInventoryRepository(
  InventoryRepositoryLayers.persistentDefault,
  ItemDefinitionRepositoryLayers.jsonFileDefault,
  ContainerRepositoryLayers.persistentDefault
)

// =============================================================================
// Configuration Helpers
// =============================================================================

/**
 * Repository設定オプション
 */
export interface InventoryRepositoryConfig {
  readonly environment: 'development' | 'test' | 'production' | 'browser' | 'server' | 'hybrid'
  readonly inventoryConfig?: {
    readonly persistent?: InventoryPersistentConfig
  }
  readonly itemDefinitionConfig?: {
    readonly jsonFile?: JsonFileConfig
  }
  readonly containerConfig?: {
    readonly persistent?: ContainerPersistentConfig
  }
}

/**
 * 設定に基づいてRepository Layerを作成
 */
export const createInventoryRepositoryLayer = (config: InventoryRepositoryConfig) =>
  pipe(
    Match.value(config.environment),
    Match.when('development', () => DevelopmentInventoryRepositoryLayers),
    Match.when('test', () => TestInventoryRepositoryLayers),
    Match.when('production', () => ProductionInventoryRepositoryLayers),
    Match.when('browser', () => {
      const inventoryLayer = config.inventoryConfig?.persistent
        ? InventoryRepositoryLayers.persistent(config.inventoryConfig.persistent)
        : InventoryRepositoryLayers.persistentDefault

      const containerLayer = config.containerConfig?.persistent
        ? ContainerRepositoryLayers.persistent(config.containerConfig.persistent)
        : ContainerRepositoryLayers.persistentDefault

      return createUnifiedInventoryRepository(inventoryLayer, ItemDefinitionRepositoryLayers.memory, containerLayer)
    }),
    Match.when('server', () => {
      const itemDefLayer = config.itemDefinitionConfig?.jsonFile
        ? ItemDefinitionRepositoryLayers.jsonFile(config.itemDefinitionConfig.jsonFile)
        : ItemDefinitionRepositoryLayers.jsonFileDefault

      return createUnifiedInventoryRepository(
        InventoryRepositoryLayers.memory,
        itemDefLayer,
        ContainerRepositoryLayers.memory
      )
    }),
    Match.when('hybrid', () => HybridInventoryRepositoryLayers),
    Match.orElse(() => ProductionInventoryRepositoryLayers)
  )

/**
 * デフォルト設定
 */
export const DefaultInventoryRepositoryConfig: InventoryRepositoryConfig = {
  environment: 'production',
  inventoryConfig: {
    persistent: DefaultInventoryPersistentConfig,
  },
  itemDefinitionConfig: {
    jsonFile: DefaultJsonFileConfig,
  },
  containerConfig: {
    persistent: DefaultContainerPersistentConfig,
  },
}

// =============================================================================
// Repository Helper Functions
// =============================================================================

/**
 * Repository初期化ヘルパー
 */
export const initializeInventoryRepositories = Effect.gen(function* () {
  const unified = yield* UnifiedInventoryRepository

  // 各リポジトリの初期化
  yield* unified.inventory.initialize()
  yield* unified.itemDefinition.initialize()
  yield* unified.container.initialize()
})

/**
 * Repositoryクリーンアップヘルパー
 */
export const cleanupInventoryRepositories = Effect.gen(function* () {
  const unified = yield* UnifiedInventoryRepository

  // 各リポジトリのクリーンアップ
  yield* unified.inventory.cleanup()
  yield* unified.itemDefinition.cleanup()
  yield* unified.container.cleanup()
})
