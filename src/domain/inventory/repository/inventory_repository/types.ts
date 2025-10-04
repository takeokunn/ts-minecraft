/**
 * Inventory Repository Type Definitions
 */

/**
 * Repository の初期化設定
 */
export interface InventoryRepositoryConfig {
  readonly type: 'memory' | 'persistent'
  readonly persistentConfig?: {
    readonly storageKey: string
    readonly autoSaveInterval?: number
    readonly compressionEnabled?: boolean
    readonly encryptionEnabled?: boolean
  }
}

/**
 * Repository のパフォーマンス設定
 */
export interface InventoryRepositoryPerformanceConfig {
  readonly cacheSize?: number
  readonly batchSize?: number
  readonly debounceMs?: number
  readonly enableMetrics?: boolean
}

/**
 * Repository の機能設定
 */
export interface InventoryRepositoryFeatureConfig {
  readonly enableSnapshots?: boolean
  readonly enableTransfer?: boolean
  readonly enableStackOperations?: boolean
  readonly enableAutoCleanup?: boolean
}

/**
 * 統合Repository設定
 */
export interface InventoryRepositorySettings {
  readonly config: InventoryRepositoryConfig
  readonly performance?: InventoryRepositoryPerformanceConfig
  readonly features?: InventoryRepositoryFeatureConfig
}

/**
 * デフォルト設定
 */
export const DefaultInventoryRepositoryConfig: InventoryRepositoryConfig = {
  type: 'memory',
  persistentConfig: {
    storageKey: 'minecraft-inventory-repository',
    autoSaveInterval: 30000,
    compressionEnabled: false,
    encryptionEnabled: false,
  },
}

export const DefaultInventoryRepositoryPerformanceConfig: InventoryRepositoryPerformanceConfig = {
  cacheSize: 1000,
  batchSize: 100,
  debounceMs: 1000,
  enableMetrics: false,
}

export const DefaultInventoryRepositoryFeatureConfig: InventoryRepositoryFeatureConfig = {
  enableSnapshots: true,
  enableTransfer: true,
  enableStackOperations: true,
  enableAutoCleanup: true,
}

export const DefaultInventoryRepositorySettings: InventoryRepositorySettings = {
  config: DefaultInventoryRepositoryConfig,
  performance: DefaultInventoryRepositoryPerformanceConfig,
  features: DefaultInventoryRepositoryFeatureConfig,
}
