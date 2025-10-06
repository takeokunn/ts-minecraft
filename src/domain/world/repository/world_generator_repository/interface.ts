/**
 * @fileoverview World Generator Repository Interface
 * ワールド生成器リポジトリのインターフェース定義
 *
 * DDD Repository Pattern に基づく永続化抽象化
 * Effect-TS 3.17+ Context.GenericTag による依存性注入
 */

import type {
  AllRepositoryErrors,
  GenerationSettings,
  PerformanceMetrics,
  WorldGenerator,
  WorldId,
  WorldSeed,
} from '@domain/world/types'
import { Context, Effect, Option, ReadonlyArray } from 'effect'

// === World Generator Query Types ===

/**
 * World Generator検索クエリ
 */
export interface WorldGeneratorQuery {
  readonly worldId?: WorldId
  readonly seed?: WorldSeed
  readonly settings?: Partial<GenerationSettings>
  readonly createdAfter?: Date
  readonly createdBefore?: Date
  readonly tags?: readonly string[]
  readonly active?: boolean
  readonly limit?: number
  readonly offset?: number
}

/**
 * World Generator統計情報
 */
export interface WorldGeneratorStatistics {
  readonly totalGenerators: number
  readonly activeGenerators: number
  readonly inactiveGenerators: number
  readonly averageChunkGenerationTime: number
  readonly totalChunksGenerated: number
  readonly lastGenerationTime: Date | null
  readonly performanceMetrics: PerformanceMetrics
}

/**
 * World Generator バッチ操作結果
 */
export interface WorldGeneratorBatchResult {
  readonly successful: readonly WorldId[]
  readonly failed: readonly { worldId: WorldId; error: AllRepositoryErrors }[]
  readonly totalProcessed: number
}

/**
 * キャッシュ設定
 */
export interface CacheConfiguration {
  readonly enabled: boolean
  readonly maxSize: number
  readonly ttlSeconds: number
  readonly strategy: 'lru' | 'lfu' | 'ttl' | 'hybrid'
  readonly compressionEnabled: boolean
}

/**
 * バックアップ設定
 */
export interface BackupConfiguration {
  readonly enabled: boolean
  readonly intervalMinutes: number
  readonly maxBackups: number
  readonly compressionLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  readonly encryptionEnabled: boolean
}

// === World Generator Repository Interface ===

/**
 * World Generator Repository インターフェース
 *
 * ワールド生成器の永続化・キャッシュ・検索機能を提供
 */
export interface WorldGeneratorRepository {
  // === CRUD Operations ===

  /**
   * World Generator保存
   * 新規または既存のワールド生成器を保存
   */
  readonly save: (generator: WorldGenerator) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * ID による World Generator取得
   */
  readonly findById: (worldId: WorldId) => Effect.Effect<Option.Option<WorldGenerator>, AllRepositoryErrors>

  /**
   * Seed による World Generator取得
   */
  readonly findBySeed: (seed: WorldSeed) => Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors>

  /**
   * 設定による World Generator検索
   */
  readonly findBySettings: (
    settings: Partial<GenerationSettings>
  ) => Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors>

  /**
   * クエリによる World Generator検索
   */
  readonly findByQuery: (
    query: WorldGeneratorQuery
  ) => Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors>

  /**
   * 全 World Generator取得
   */
  readonly findAll: (
    limit?: number,
    offset?: number
  ) => Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors>

  /**
   * World Generator削除
   */
  readonly delete: (worldId: WorldId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 複数 World Generator削除
   */
  readonly deleteMany: (
    worldIds: ReadonlyArray<WorldId>
  ) => Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors>

  /**
   * World Generator存在確認
   */
  readonly exists: (worldId: WorldId) => Effect.Effect<boolean, AllRepositoryErrors>

  // === Batch Operations ===

  /**
   * 複数 World Generator保存
   */
  readonly saveMany: (
    generators: ReadonlyArray<WorldGenerator>
  ) => Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors>

  /**
   * 複数 World Generator取得
   */
  readonly findManyByIds: (
    worldIds: ReadonlyArray<WorldId>
  ) => Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors>

  // === Statistics & Monitoring ===

  /**
   * 統計情報取得
   */
  readonly getStatistics: () => Effect.Effect<WorldGeneratorStatistics, AllRepositoryErrors>

  /**
   * World Generator数取得
   */
  readonly count: (query?: Partial<WorldGeneratorQuery>) => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 最新生成時刻取得
   */
  readonly getLastGenerationTime: (worldId: WorldId) => Effect.Effect<Option.Option<Date>, AllRepositoryErrors>

  /**
   * パフォーマンスメトリクス取得
   */
  readonly getPerformanceMetrics: (
    worldId: WorldId
  ) => Effect.Effect<Option.Option<PerformanceMetrics>, AllRepositoryErrors>

  // === Cache Management ===

  /**
   * キャッシュ設定更新
   */
  readonly updateCacheConfiguration: (config: CacheConfiguration) => Effect.Effect<void, AllRepositoryErrors>

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

  // === Backup & Recovery ===

  /**
   * バックアップ作成
   */
  readonly createBackup: (worldId?: WorldId) => Effect.Effect<string, AllRepositoryErrors>

  /**
   * バックアップ復元
   */
  readonly restoreFromBackup: (backupId: string, worldId?: WorldId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * バックアップリスト取得
   */
  readonly listBackups: () => Effect.Effect<
    ReadonlyArray<{
      readonly id: string
      readonly worldId: WorldId | null
      readonly createdAt: Date
      readonly size: number
    }>,
    AllRepositoryErrors
  >

  /**
   * 古いバックアップ削除
   */
  readonly cleanupOldBackups: (keepCount?: number) => Effect.Effect<number, AllRepositoryErrors>

  // === Maintenance ===

  /**
   * データ整合性チェック
   */
  readonly validateIntegrity: () => Effect.Effect<
    {
      readonly isValid: boolean
      readonly errors: ReadonlyArray<string>
      readonly warnings: ReadonlyArray<string>
    },
    AllRepositoryErrors
  >

  /**
   * データ最適化（デフラグメンテーション等）
   */
  readonly optimize: () => Effect.Effect<
    {
      readonly beforeSize: number
      readonly afterSize: number
      readonly optimizationTime: number
    },
    AllRepositoryErrors
  >

  /**
   * リポジトリ初期化
   */
  readonly initialize: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * リポジトリクリーンアップ（リソース解放）
   */
  readonly cleanup: () => Effect.Effect<void, AllRepositoryErrors>
}

// === Context Tag Definition ===

/**
 * World Generator Repository Context Tag
 * DI コンテナでの依存性注入に使用
 */
export const WorldGeneratorRepository = Context.GenericTag<WorldGeneratorRepository>(
  '@minecraft/domain/world/repository/WorldGeneratorRepository'
)

// === Helper Types ===

/**
 * Repository設定
 */
export interface WorldGeneratorRepositoryConfig {
  readonly storage: {
    readonly type: 'memory' | 'indexeddb' | 'filesystem'
    readonly location?: string
    readonly maxSize?: number
  }
  readonly cache: CacheConfiguration
  readonly backup: BackupConfiguration
  readonly performance: {
    readonly enableMetrics: boolean
    readonly enableProfiling: boolean
    readonly batchSize: number
  }
}

/**
 * Repository実装ファクトリー
 */
export type WorldGeneratorRepositoryFactory = (config: WorldGeneratorRepositoryConfig) => WorldGeneratorRepository

// === Repository Creation Helpers ===

/**
 * デフォルトキャッシュ設定
 */
export const defaultCacheConfiguration: CacheConfiguration = {
  enabled: true,
  maxSize: 1000,
  ttlSeconds: 3600, // 1時間
  strategy: 'lru',
  compressionEnabled: false,
}

/**
 * デフォルトバックアップ設定
 */
export const defaultBackupConfiguration: BackupConfiguration = {
  enabled: true,
  intervalMinutes: 60, // 1時間
  maxBackups: 10,
  compressionLevel: 6,
  encryptionEnabled: false,
}

/**
 * デフォルトRepository設定
 */
export const defaultWorldGeneratorRepositoryConfig: WorldGeneratorRepositoryConfig = {
  storage: {
    type: 'memory',
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  cache: defaultCacheConfiguration,
  backup: defaultBackupConfiguration,
  performance: {
    enableMetrics: true,
    enableProfiling: false,
    batchSize: 100,
  },
}

// === Type Exports ===

export type {
  BackupConfiguration,
  CacheConfiguration,
  WorldGeneratorBatchResult,
  WorldGeneratorQuery,
  WorldGeneratorRepositoryConfig,
  WorldGeneratorRepositoryFactory,
  WorldGeneratorStatistics,
}
