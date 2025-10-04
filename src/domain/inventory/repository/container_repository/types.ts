/**
 * Container Repository Type Definitions
 */

/**
 * Repository の設定タイプ
 */
export type ContainerRepositoryType = 'memory' | 'persistent'

/**
 * Repository の初期化設定
 */
export interface ContainerRepositoryConfig {
  readonly type: ContainerRepositoryType
  readonly persistentConfig?: {
    readonly storageKey: string
    readonly autoSaveInterval?: number
    readonly compressionEnabled?: boolean
    readonly indexedDBEnabled?: boolean
  }
}

/**
 * Repository の空間インデックス設定
 */
export interface ContainerRepositorySpatialConfig {
  readonly enableSpatialIndex?: boolean
  readonly indexGranularity?: number
  readonly maxIndexSize?: number
  readonly autoOptimize?: boolean
}

/**
 * Repository のアクセス制御設定
 */
export interface ContainerRepositoryAccessConfig {
  readonly enablePermissions?: boolean
  readonly defaultPublicAccess?: boolean
  readonly ownershipRequired?: boolean
  readonly adminBypass?: boolean
}

/**
 * 統合Repository設定
 */
export interface ContainerRepositorySettings {
  readonly config: ContainerRepositoryConfig
  readonly spatial?: ContainerRepositorySpatialConfig
  readonly access?: ContainerRepositoryAccessConfig
}

/**
 * デフォルト設定
 */
export const DefaultContainerRepositoryConfig: ContainerRepositoryConfig = {
  type: 'memory',
  persistentConfig: {
    storageKey: 'minecraft-container-repository',
    autoSaveInterval: 60000,
    compressionEnabled: false,
    indexedDBEnabled: true,
  },
}

export const DefaultContainerRepositorySpatialConfig: ContainerRepositorySpatialConfig = {
  enableSpatialIndex: true,
  indexGranularity: 16, // チャンクサイズ
  maxIndexSize: 10000,
  autoOptimize: true,
}

export const DefaultContainerRepositoryAccessConfig: ContainerRepositoryAccessConfig = {
  enablePermissions: true,
  defaultPublicAccess: false,
  ownershipRequired: true,
  adminBypass: true,
}

export const DefaultContainerRepositorySettings: ContainerRepositorySettings = {
  config: DefaultContainerRepositoryConfig,
  spatial: DefaultContainerRepositorySpatialConfig,
  access: DefaultContainerRepositoryAccessConfig,
}
