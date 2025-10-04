import { Context, Effect, Layer } from 'effect'
import {
  ContainerRepository,
  ContainerRepositoryMemory,
  ContainerRepositoryPersistent,
  ContainerRepositoryPersistentDefault,
  DefaultContainerPersistentConfig,
  type ContainerPersistentConfig,
} from './container-repository'
import {
  DefaultPersistentConfig as DefaultInventoryPersistentConfig,
  InventoryRepository,
  InventoryRepositoryMemory,
  InventoryRepositoryPersistent,
  InventoryRepositoryPersistentDefault,
  type PersistentConfig as InventoryPersistentConfig,
} from './inventory-repository'
import {
  DefaultJsonFileConfig,
  ItemDefinitionRepository,
  ItemDefinitionRepositoryJsonFile,
  ItemDefinitionRepositoryJsonFileDefault,
  ItemDefinitionRepositoryMemory,
  type JsonFileConfig,
} from './item-definition-repository'

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

      if (isBrowser) {
        return InventoryRepositoryLayers.persistentDefault
      } else {
        // Node.js環境では永続化未対応のためメモリ実装
        return InventoryRepositoryLayers.memory
      }
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

      if (isNodeJS) {
        return ItemDefinitionRepositoryLayers.jsonFileDefault
      } else {
        // ブラウザ環境ではファイルアクセス不可のためメモリ実装
        return ItemDefinitionRepositoryLayers.memory
      }
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

      if (isBrowser) {
        return ContainerRepositoryLayers.persistentDefault
      } else {
        // Node.js環境では永続化未対応のためメモリ実装
        return ContainerRepositoryLayers.memory
      }
    })
  ),
} as const

// =============================================================================
// Unified Inventory Repository Layer
// =============================================================================

/**
 * 統合Inventory Repository
 *
 * InventoryRepository、ItemDefinitionRepository、ContainerRepositoryを
 * 組み合わせた統合インターフェース
 */
export interface UnifiedInventoryRepository {
  readonly inventory: InventoryRepository
  readonly itemDefinition: ItemDefinitionRepository
  readonly container: ContainerRepository
}

export const UnifiedInventoryRepository = Context.GenericTag<UnifiedInventoryRepository>(
  '@minecraft/domain/inventory/repository/UnifiedInventoryRepository'
)

/**
 * 統合Inventory Repository実装
 */
export const UnifiedInventoryRepositoryLive = Layer.effect(
  UnifiedInventoryRepository,
  Effect.gen(function* () {
    const inventoryRepo = yield* InventoryRepository
    const itemDefRepo = yield* ItemDefinitionRepository
    const containerRepo = yield* ContainerRepository

    return UnifiedInventoryRepository.of({
      inventory: inventoryRepo,
      itemDefinition: itemDefRepo,
      container: containerRepo,
    })
  })
).pipe(
  Layer.provide(InventoryRepositoryLayers.auto),
  Layer.provide(ItemDefinitionRepositoryLayers.auto),
  Layer.provide(ContainerRepositoryLayers.auto)
)

/**
 * カスタム実装組み合わせ用の統合Layer
 */
export const createUnifiedInventoryRepository = (
  inventoryLayer: Layer.Layer<InventoryRepository>,
  itemDefinitionLayer: Layer.Layer<ItemDefinitionRepository>,
  containerLayer: Layer.Layer<ContainerRepository>
) =>
  Layer.effect(
    UnifiedInventoryRepository,
    Effect.gen(function* () {
      const inventoryRepo = yield* InventoryRepository
      const itemDefRepo = yield* ItemDefinitionRepository
      const containerRepo = yield* ContainerRepository

      return UnifiedInventoryRepository.of({
        inventory: inventoryRepo,
        itemDefinition: itemDefRepo,
        container: containerRepo,
      })
    })
  ).pipe(Layer.provide(inventoryLayer), Layer.provide(itemDefinitionLayer), Layer.provide(containerLayer))

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
export const createInventoryRepositoryLayer = (config: InventoryRepositoryConfig) => {
  switch (config.environment) {
    case 'development':
      return DevelopmentInventoryRepositoryLayers

    case 'test':
      return TestInventoryRepositoryLayers

    case 'production':
      return ProductionInventoryRepositoryLayers

    case 'browser':
      const inventoryLayer = config.inventoryConfig?.persistent
        ? InventoryRepositoryLayers.persistent(config.inventoryConfig.persistent)
        : InventoryRepositoryLayers.persistentDefault

      const containerLayer = config.containerConfig?.persistent
        ? ContainerRepositoryLayers.persistent(config.containerConfig.persistent)
        : ContainerRepositoryLayers.persistentDefault

      return createUnifiedInventoryRepository(inventoryLayer, ItemDefinitionRepositoryLayers.memory, containerLayer)

    case 'server':
      const itemDefLayer = config.itemDefinitionConfig?.jsonFile
        ? ItemDefinitionRepositoryLayers.jsonFile(config.itemDefinitionConfig.jsonFile)
        : ItemDefinitionRepositoryLayers.jsonFileDefault

      return createUnifiedInventoryRepository(
        InventoryRepositoryLayers.memory,
        itemDefLayer,
        ContainerRepositoryLayers.memory
      )

    case 'hybrid':
      return HybridInventoryRepositoryLayers

    default:
      return ProductionInventoryRepositoryLayers
  }
}

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
