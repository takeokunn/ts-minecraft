/**
 * @fileoverview World Metadata Repository Interface
 * ワールドメタデータリポジトリのインターフェース定義
 *
 * ワールドメタデータの管理・圧縮・バージョニング
 * 高度なメタデータ検索とパフォーマンス最適化
 */

import type {
  AllRepositoryErrors,
  WorldCoordinate,
  WorldCoordinate2D,
  WorldGeneratorId,
  WorldId,
  WorldSeed,
} from '@domain/world/types'
import type { JsonValue } from '@shared/schema/json'
import { Context, Effect, Option, ReadonlyArray, Schema } from 'effect'

// === Metadata Core Types ===

/**
 * ワールドメタデータ
 */
export interface WorldMetadata {
  readonly id: WorldId
  readonly name: string
  readonly description: string
  readonly seed: WorldSeed
  readonly generatorId: WorldGeneratorId
  readonly version: string
  readonly gameVersion: string
  readonly createdAt: Date
  readonly lastModified: Date
  readonly lastAccessed: Date
  readonly tags: ReadonlyArray<string>
  readonly properties: Record<string, JsonValue>
  readonly settings: WorldSettings
  readonly statistics: WorldStatistics
  readonly checksum: string
}

/**
 * ワールド設定
 */
export interface WorldSettings {
  readonly gameMode: 'survival' | 'creative' | 'adventure' | 'spectator'
  readonly difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
  readonly worldType: 'default' | 'superflat' | 'amplified' | 'customized'
  readonly generateStructures: boolean
  readonly generateBonusChest: boolean
  readonly allowCheats: boolean
  readonly hardcore: boolean
  readonly pvp: boolean
  readonly spawnProtection: number
  readonly worldBorder: {
    readonly center: WorldCoordinate2D
    readonly size: number
    readonly warningBlocks: number
    readonly warningTime: number
    readonly damageAmount: number
    readonly damageBuffer: number
  }
  readonly gameRules: Record<string, boolean | number | string>
  readonly dataPackSettings: {
    readonly enabled: ReadonlyArray<string>
    readonly disabled: ReadonlyArray<string>
    readonly available: ReadonlyArray<string>
  }
}

/**
 * ワールド統計情報
 */
export interface WorldStatistics {
  readonly size: {
    readonly totalChunks: number
    readonly loadedChunks: number
    readonly generatedChunks: number
    readonly compressedSize: number
    readonly uncompressedSize: number
  }
  readonly performance: {
    readonly averageGenerationTime: number
    readonly averageLoadTime: number
    readonly totalGenerationTime: number
    readonly cacheHitRate: number
    readonly compressionRatio: number
  }
  readonly content: {
    readonly biomeCount: Record<string, number>
    readonly structureCount: Record<string, number>
    readonly entityCount: Record<string, number>
    readonly tileEntityCount: Record<string, number>
  }
  readonly player: {
    readonly playerCount: number
    readonly totalPlayTime: number
    readonly lastPlayerActivity: Date
    readonly spawnLocations: ReadonlyArray<{
      readonly playerId: string
      readonly location: WorldCoordinate
    }>
  }
  readonly lastUpdated: Date
}

// === Versioning Types ===

/**
 * メタデータバージョン
 */
export interface MetadataVersion {
  readonly version: string
  readonly timestamp: Date
  readonly changes: ReadonlyArray<MetadataChange>
  readonly checksum: string
  readonly size: number
  readonly parentVersion?: string
}

/**
 * メタデータ変更
 */
export interface MetadataChange {
  readonly type: 'create' | 'update' | 'delete'
  readonly path: string
  readonly oldValue?: JsonValue
  readonly newValue?: JsonValue
  readonly timestamp: Date
  readonly reason?: string
}

/**
 * バージョン履歴
 */
export interface VersionHistory {
  readonly worldId: WorldId
  readonly versions: ReadonlyArray<MetadataVersion>
  readonly currentVersion: string
  readonly totalVersions: number
  readonly totalSize: number
  readonly oldestVersion: string
  readonly newestVersion: string
}

// === Compression Types ===

/**
 * 圧縮設定
 */
export interface CompressionConfig {
  readonly algorithm: 'gzip' | 'deflate' | 'brotli' | 'lz4'
  readonly level: number // 0-9
  readonly chunkSize: number
  readonly enableDictionary: boolean
  readonly enableStreaming: boolean
  readonly enableDeduplication: boolean
}

/**
 * 圧縮統計
 */
export interface CompressionStatistics {
  readonly algorithm: string
  readonly originalSize: number
  readonly compressedSize: number
  readonly compressionRatio: number
  readonly compressionTime: number
  readonly decompressionTime: number
  readonly dictionarySize: number
  readonly chunksProcessed: number
  readonly deduplicationSavings: number
}

// === Query Types ===

/**
 * メタデータクエリ
 */
export interface MetadataQuery {
  readonly worldId?: WorldId
  readonly name?: string
  readonly tags?: ReadonlyArray<string>
  readonly generatorId?: WorldGeneratorId
  readonly gameMode?: string
  readonly difficulty?: string
  readonly worldType?: string
  readonly createdAfter?: Date
  readonly createdBefore?: Date
  readonly modifiedAfter?: Date
  readonly modifiedBefore?: Date
  readonly minSize?: number
  readonly maxSize?: number
  readonly limit?: number
  readonly sortBy?: 'name' | 'created' | 'modified' | 'size' | 'accessed'
  readonly sortOrder?: 'asc' | 'desc'
  readonly includeStatistics?: boolean
  readonly includeVersionHistory?: boolean
}

/**
 * メタデータ検索結果
 */
export interface MetadataSearchResult {
  readonly metadata: WorldMetadata
  readonly relevanceScore: number
  readonly matchedFields: ReadonlyArray<string>
  readonly snippet?: string
}

// === Backup Types ===

/**
 * バックアップ設定
 */
export interface BackupConfig {
  readonly enabled: boolean
  readonly retentionDays: number
  readonly compressionEnabled: boolean
  readonly encryptionEnabled: boolean
  readonly incrementalBackup: boolean
  readonly scheduleInterval: number
  readonly maxBackupSize: number
  readonly excludePatterns: ReadonlyArray<string>
}

/**
 * バックアップ情報
 */
export interface BackupInfo {
  readonly backupId: string
  readonly worldId: WorldId
  readonly timestamp: Date
  readonly type: 'full' | 'incremental' | 'differential'
  readonly size: number
  readonly compressedSize: number
  readonly checksum: string
  readonly isEncrypted: boolean
  readonly parentBackupId?: string
  readonly description?: string
}

// === Repository Interface ===

/**
 * World Metadata Repository インターフェース
 */
export interface WorldMetadataRepository {
  // === Metadata Management ===

  /**
   * メタデータ保存
   */
  readonly saveMetadata: (metadata: WorldMetadata) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * メタデータ取得
   */
  readonly findMetadata: (worldId: WorldId) => Effect.Effect<Option.Option<WorldMetadata>, AllRepositoryErrors>

  /**
   * 全メタデータ取得
   */
  readonly findAllMetadata: () => Effect.Effect<ReadonlyArray<WorldMetadata>, AllRepositoryErrors>

  /**
   * メタデータ更新
   */
  readonly updateMetadata: (metadata: WorldMetadata) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * メタデータ削除
   */
  readonly deleteMetadata: (worldId: WorldId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * メタデータ検索
   */
  readonly searchMetadata: (
    query: MetadataQuery
  ) => Effect.Effect<ReadonlyArray<MetadataSearchResult>, AllRepositoryErrors>

  // === Settings Management ===

  /**
   * ワールド設定更新
   */
  readonly updateSettings: (
    worldId: WorldId,
    settings: Partial<WorldSettings>
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * ワールド設定取得
   */
  readonly getSettings: (worldId: WorldId) => Effect.Effect<Option.Option<WorldSettings>, AllRepositoryErrors>

  /**
   * ゲームルール設定
   */
  readonly setGameRule: (
    worldId: WorldId,
    rule: string,
    value: boolean | number | string
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * ゲームルール取得
   */
  readonly getGameRule: (
    worldId: WorldId,
    rule: string
  ) => Effect.Effect<Option.Option<boolean | number | string>, AllRepositoryErrors>

  // === Statistics Management ===

  /**
   * 統計情報更新
   */
  readonly updateStatistics: (
    worldId: WorldId,
    statistics: Partial<WorldStatistics>
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 統計情報取得
   */
  readonly getStatistics: (worldId: WorldId) => Effect.Effect<Option.Option<WorldStatistics>, AllRepositoryErrors>

  /**
   * パフォーマンス統計記録
   */
  readonly recordPerformanceMetric: (
    worldId: WorldId,
    metric: string,
    value: number,
    timestamp?: Date
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * コンテンツ統計更新
   */
  readonly updateContentStatistics: (
    worldId: WorldId,
    contentType: string,
    count: number
  ) => Effect.Effect<void, AllRepositoryErrors>

  // === Versioning System ===

  /**
   * バージョン作成
   */
  readonly createVersion: (
    worldId: WorldId,
    changes: ReadonlyArray<MetadataChange>,
    description?: string
  ) => Effect.Effect<string, AllRepositoryErrors>

  /**
   * バージョン取得
   */
  readonly getVersion: (
    worldId: WorldId,
    version: string
  ) => Effect.Effect<Option.Option<MetadataVersion>, AllRepositoryErrors>

  /**
   * バージョン履歴取得
   */
  readonly getVersionHistory: (worldId: WorldId) => Effect.Effect<VersionHistory, AllRepositoryErrors>

  /**
   * バージョン復元
   */
  readonly restoreVersion: (worldId: WorldId, version: string) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * バージョン比較
   */
  readonly compareVersions: (
    worldId: WorldId,
    version1: string,
    version2: string
  ) => Effect.Effect<ReadonlyArray<MetadataChange>, AllRepositoryErrors>

  /**
   * 古いバージョンクリーンアップ
   */
  readonly cleanupOldVersions: (
    worldId: WorldId,
    retentionPolicy: { maxVersions?: number; maxAgeDays?: number }
  ) => Effect.Effect<number, AllRepositoryErrors>

  // === Compression System ===

  /**
   * メタデータ圧縮
   */
  readonly compressMetadata: (
    worldId: WorldId,
    config?: CompressionConfig
  ) => Effect.Effect<CompressionStatistics, AllRepositoryErrors>

  /**
   * メタデータ展開
   */
  readonly decompressMetadata: (worldId: WorldId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 圧縮統計取得
   */
  readonly getCompressionStatistics: (
    worldId: WorldId
  ) => Effect.Effect<Option.Option<CompressionStatistics>, AllRepositoryErrors>

  /**
   * 圧縮設定更新
   */
  readonly updateCompressionConfig: (
    worldId: WorldId,
    config: CompressionConfig
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 自動圧縮有効化
   */
  readonly enableAutoCompression: (worldId: WorldId, threshold: number) => Effect.Effect<void, AllRepositoryErrors>

  // === Backup System ===

  /**
   * バックアップ作成
   */
  readonly createBackup: (
    worldId: WorldId,
    type: 'full' | 'incremental',
    description?: string
  ) => Effect.Effect<BackupInfo, AllRepositoryErrors>

  /**
   * バックアップ一覧取得
   */
  readonly listBackups: (worldId: WorldId) => Effect.Effect<ReadonlyArray<BackupInfo>, AllRepositoryErrors>

  /**
   * バックアップ復元
   */
  readonly restoreBackup: (worldId: WorldId, backupId: string) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * バックアップ削除
   */
  readonly deleteBackup: (backupId: string) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * バックアップ検証
   */
  readonly verifyBackup: (
    backupId: string
  ) => Effect.Effect<{ isValid: boolean; issues: ReadonlyArray<string> }, AllRepositoryErrors>

  /**
   * 自動バックアップ設定
   */
  readonly configureAutoBackup: (worldId: WorldId, config: BackupConfig) => Effect.Effect<void, AllRepositoryErrors>

  // === Index Management ===

  /**
   * インデックス再構築
   */
  readonly rebuildIndexes: (worldId?: WorldId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * インデックス最適化
   */
  readonly optimizeIndexes: () => Effect.Effect<
    { beforeSize: number; afterSize: number; improvementRatio: number },
    AllRepositoryErrors
  >

  /**
   * インデックス統計取得
   */
  readonly getIndexStatistics: () => Effect.Effect<
    {
      readonly totalIndexes: number
      readonly totalSize: number
      readonly fragmentationRatio: number
      readonly lastOptimized: Date
    },
    AllRepositoryErrors
  >

  // === Cache Management ===

  /**
   * メタデータキャッシュ更新
   */
  readonly updateMetadataCache: (worldId: WorldId, metadata: WorldMetadata) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * キャッシュクリア
   */
  readonly clearCache: (worldId?: WorldId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * キャッシュ統計取得
   */
  readonly getCacheStatistics: () => Effect.Effect<
    {
      readonly hitRate: number
      readonly missRate: number
      readonly size: number
      readonly maxSize: number
      readonly evictionCount: number
    },
    AllRepositoryErrors
  >

  /**
   * キャッシュウォームアップ
   */
  readonly warmupCache: (worldIds: ReadonlyArray<WorldId>) => Effect.Effect<void, AllRepositoryErrors>

  // === Bulk Operations ===

  /**
   * 複数メタデータ保存
   */
  readonly saveMultipleMetadata: (metadataList: ReadonlyArray<WorldMetadata>) => Effect.Effect<
    {
      readonly successful: number
      readonly failed: number
      readonly errors: ReadonlyArray<AllRepositoryErrors>
    },
    AllRepositoryErrors
  >

  /**
   * 複数メタデータ更新
   */
  readonly updateMultipleMetadata: (
    updates: ReadonlyArray<{ worldId: WorldId; metadata: Partial<WorldMetadata> }>
  ) => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 複数メタデータ削除
   */
  readonly deleteMultipleMetadata: (worldIds: ReadonlyArray<WorldId>) => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 一括圧縮
   */
  readonly bulkCompress: (
    worldIds: ReadonlyArray<WorldId>,
    config?: CompressionConfig
  ) => Effect.Effect<ReadonlyArray<CompressionStatistics>, AllRepositoryErrors>

  // === Repository Management ===

  /**
   * リポジトリ初期化
   */
  readonly initialize: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * リポジトリクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * データ整合性検証
   */
  readonly validateIntegrity: () => Effect.Effect<
    {
      readonly isValid: boolean
      readonly errors: ReadonlyArray<string>
      readonly warnings: ReadonlyArray<string>
      readonly corruptedMetadata: ReadonlyArray<WorldId>
    },
    AllRepositoryErrors
  >

  /**
   * リポジトリ統計取得
   */
  readonly getRepositoryStatistics: () => Effect.Effect<
    {
      readonly totalWorlds: number
      readonly totalSize: number
      readonly averageWorldSize: number
      readonly compressionRatio: number
      readonly oldestWorld: Date
      readonly newestWorld: Date
      readonly mostActiveWorld: WorldId
    },
    AllRepositoryErrors
  >
}

// === Context Tag Definition ===

/**
 * World Metadata Repository Context Tag
 */
export const WorldMetadataRepository = Context.GenericTag<WorldMetadataRepository>(
  '@minecraft/domain/world/repository/WorldMetadataRepository'
)

// === Configuration Types ===

/**
 * Repository設定
 */
export interface WorldMetadataRepositoryConfig {
  readonly storage: {
    readonly type: 'memory' | 'indexeddb' | 'filesystem'
    readonly location?: string
    readonly maxWorlds?: number
    readonly enableEncryption?: boolean
  }
  readonly compression: CompressionConfig
  readonly versioning: {
    readonly enabled: boolean
    readonly maxVersionsPerWorld: number
    readonly automaticVersioning: boolean
    readonly versioningStrategy: 'time-based' | 'change-based' | 'size-based'
  }
  readonly backup: BackupConfig
  readonly indexing: {
    readonly enabled: boolean
    readonly indexTypes: ReadonlyArray<'name' | 'tags' | 'created' | 'modified' | 'size'>
    readonly rebuildInterval: number
    readonly optimizationInterval: number
  }
  readonly cache: {
    readonly enabled: boolean
    readonly maxSize: number
    readonly ttlSeconds: number
    readonly enableStatisticsCache: boolean
    readonly enableSettingsCache: boolean
  }
  readonly performance: {
    readonly enableProfiling: boolean
    readonly enableMetrics: boolean
    readonly batchSize: number
    readonly concurrencyLimit: number
  }
}

export const WorldMetadataRepositoryConfigSchema = Schema.Struct({
  storage: Schema.Struct({
    type: Schema.Literal('memory', 'indexeddb', 'filesystem'),
    location: Schema.optional(Schema.String),
    maxWorlds: Schema.optional(Schema.Number),
    enableEncryption: Schema.optional(Schema.Boolean),
  }),
  compression: Schema.Struct({
    algorithm: Schema.Literal('gzip', 'deflate', 'brotli', 'lz4'),
    level: Schema.Number,
    chunkSize: Schema.Number,
    enableDictionary: Schema.Boolean,
    enableStreaming: Schema.Boolean,
    enableDeduplication: Schema.Boolean,
  }),
  versioning: Schema.Struct({
    enabled: Schema.Boolean,
    maxVersionsPerWorld: Schema.Number,
    automaticVersioning: Schema.Boolean,
    versioningStrategy: Schema.Literal('time-based', 'change-based', 'size-based'),
  }),
  backup: Schema.Struct({
    enabled: Schema.Boolean,
    retentionDays: Schema.Number,
    compressionEnabled: Schema.Boolean,
    encryptionEnabled: Schema.Boolean,
    incrementalBackup: Schema.Boolean,
    scheduleInterval: Schema.Number,
    maxBackupSize: Schema.Number,
    excludePatterns: Schema.Array(Schema.String),
  }),
  indexing: Schema.Struct({
    enabled: Schema.Boolean,
    indexTypes: Schema.Array(Schema.Literal('name', 'tags', 'created', 'modified', 'size')),
    rebuildInterval: Schema.Number,
    optimizationInterval: Schema.Number,
  }),
  cache: Schema.Struct({
    enabled: Schema.Boolean,
    maxSize: Schema.Number,
    ttlSeconds: Schema.Number,
    enableStatisticsCache: Schema.Boolean,
    enableSettingsCache: Schema.Boolean,
  }),
  performance: Schema.Struct({
    enableProfiling: Schema.Boolean,
    enableMetrics: Schema.Boolean,
    batchSize: Schema.Number,
    concurrencyLimit: Schema.Number,
  }),
})

// === Default Configuration ===

export const defaultWorldMetadataRepositoryConfig: WorldMetadataRepositoryConfig = {
  storage: {
    type: 'memory',
    maxWorlds: 1000,
    enableEncryption: false,
  },
  compression: {
    algorithm: 'gzip',
    level: 6,
    chunkSize: 64 * 1024, // 64KB
    enableDictionary: true,
    enableStreaming: false,
    enableDeduplication: true,
  },
  versioning: {
    enabled: true,
    maxVersionsPerWorld: 10,
    automaticVersioning: true,
    versioningStrategy: 'change-based',
  },
  backup: {
    enabled: true,
    retentionDays: 30,
    compressionEnabled: true,
    encryptionEnabled: false,
    incrementalBackup: true,
    scheduleInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxBackupSize: 100 * 1024 * 1024, // 100MB
    excludePatterns: [],
  },
  indexing: {
    enabled: true,
    indexTypes: ['name', 'tags', 'created', 'modified', 'size'],
    rebuildInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
    optimizationInterval: 24 * 60 * 60 * 1000, // 24 hours
  },
  cache: {
    enabled: true,
    maxSize: 1000,
    ttlSeconds: 600, // 10 minutes
    enableStatisticsCache: true,
    enableSettingsCache: true,
  },
  performance: {
    enableProfiling: false,
    enableMetrics: true,
    batchSize: 100,
    concurrencyLimit: 10,
  },
}

export { WorldMetadataRepositoryConfigSchema }

// === Utility Functions ===

/**
 * メタデータチェックサム計算
 */
export const calculateMetadataChecksum = (metadata: WorldMetadata): string => {
  // Simple hash implementation - in real world would use crypto
  const data = JSON.stringify({
    ...metadata,
    lastModified: undefined,
    lastAccessed: undefined,
    checksum: undefined,
  })
  const hash = pipe(
    ReadonlyArray.range(0, data.length),
    ReadonlyArray.reduce(0, (hash, i) => {
      const char = data.charCodeAt(i)
      const newHash = (hash << 5) - hash + char
      return newHash & newHash // Convert to 32-bit integer
    })
  )
  return hash.toString(16)
}

/**
 * バージョン文字列生成
 */
export const generateVersionString = (timestamp: number, sequence: number): string => {
  const timePart = timestamp.toString(36)
  const sequencePart = sequence.toString(36)
  return `v${timePart}-${sequencePart}`
}

/**
 * メタデータサイズ推定
 */
export const estimateMetadataSize = (metadata: WorldMetadata): number => {
  const jsonString = JSON.stringify(metadata)
  return new TextEncoder().encode(jsonString).length
}

// === Type Exports ===

export type {
  BackupConfig,
  BackupInfo,
  CompressionConfig,
  CompressionStatistics,
  MetadataChange,
  MetadataQuery,
  MetadataSearchResult,
  MetadataVersion,
  VersionHistory,
  WorldMetadata,
  WorldMetadataRepositoryConfig,
  WorldSettings,
  WorldStatistics,
}
