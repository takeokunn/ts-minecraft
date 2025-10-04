import { Effect, Layer, Match, pipe } from 'effect'
import { ChunkRepository } from '../chunk_repository/interface'
import { InMemoryChunkRepositoryLive } from '../chunk_repository/memory_implementation'
import { IndexedDBChunkRepositoryLive } from '../chunk_repository/indexeddb_implementation'
import { WebWorkerChunkRepositoryLive } from '../chunk_repository/webworker_implementation'
import type { RepositoryError } from '../types/repository_error'
import { RepositoryErrors } from '../types/repository_error'

/**
 * Repository Strategy Pattern Implementation
 *
 * 環境とユースケースに応じて最適なRepository実装を選択
 * Strategy Pattern + Factory Pattern + Environment Detection
 */

// ===== Strategy Types ===== //

/**
 * Repository戦略タイプ
 */
export type RepositoryStrategyType =
  | 'memory'
  | 'indexeddb'
  | 'webworker'
  | 'hybrid'
  | 'auto'

/**
 * 環境情報
 */
export interface EnvironmentInfo {
  readonly platform: 'browser' | 'node' | 'webworker' | 'unknown'
  readonly hasBrowserAPI: boolean
  readonly hasIndexedDB: boolean
  readonly hasWebWorkers: boolean
  readonly hasFileSystem: boolean
  readonly memoryConstraints: 'low' | 'medium' | 'high'
  readonly performanceProfile: 'low' | 'medium' | 'high'
  readonly concurrencySupport: boolean
}

/**
 * Repository設定
 */
export interface RepositoryConfig {
  readonly strategy: RepositoryStrategyType
  readonly environment?: EnvironmentInfo
  readonly options?: {
    readonly maxMemoryUsage?: number
    readonly preferredStorage?: 'memory' | 'persistent'
    readonly enableWebWorkers?: boolean
    readonly maxWorkers?: number
    readonly cacheSize?: number
    readonly compressionEnabled?: boolean
    readonly encryptionEnabled?: boolean
  }
}

/**
 * パフォーマンス要件
 */
export interface PerformanceRequirements {
  readonly maxLatency: number // ms
  readonly minThroughput: number // operations/sec
  readonly memoryBudget: number // MB
  readonly concurrentOperations: number
  readonly dataConsistency: 'eventual' | 'strong'
  readonly durability: 'none' | 'session' | 'persistent'
}

// ===== Environment Detection ===== //

/**
 * 実行環境を自動検出
 */
export const detectEnvironment = (): Effect.Effect<EnvironmentInfo, RepositoryError> =>
  Effect.gen(function* () {
    try {
      // プラットフォーム検出
      const platform = (() => {
        if (typeof window !== 'undefined') return 'browser'
        if (typeof process !== 'undefined' && process.versions?.node) return 'node'
        if (typeof self !== 'undefined' && typeof importScripts === 'function') return 'webworker'
        return 'unknown'
      })()

      // API利用可能性チェック
      const hasBrowserAPI = typeof window !== 'undefined'
      const hasIndexedDB = typeof indexedDB !== 'undefined'
      const hasWebWorkers = typeof Worker !== 'undefined'
      const hasFileSystem = typeof process !== 'undefined' && typeof require !== 'undefined'

      // メモリ制約推定
      const memoryConstraints = (() => {
        if (platform === 'browser' && 'memory' in performance) {
          const memory = (performance as any).memory
          if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) return 'low'
          if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.5) return 'medium'
          return 'high'
        }
        if (platform === 'node' && process.memoryUsage) {
          const usage = process.memoryUsage()
          const totalMB = usage.heapTotal / (1024 * 1024)
          if (totalMB < 128) return 'low'
          if (totalMB < 512) return 'medium'
          return 'high'
        }
        return 'medium' // デフォルト
      })()

      // パフォーマンスプロファイル推定
      const performanceProfile = (() => {
        if (platform === 'browser') {
          const connection = (navigator as any).connection
          if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
            return 'low'
          }
          if (connection?.effectiveType === '3g') return 'medium'
          return 'high'
        }
        return 'high' // Node.jsはデフォルトで高性能
      })()

      // 並行処理サポート
      const concurrencySupport = hasWebWorkers || platform === 'node'

      const envInfo: EnvironmentInfo = {
        platform,
        hasBrowserAPI,
        hasIndexedDB,
        hasWebWorkers,
        hasFileSystem,
        memoryConstraints,
        performanceProfile,
        concurrencySupport
      }

      return envInfo
    } catch (error) {
      return yield* Effect.fail(
        RepositoryErrors.storage('environment_detection', 'Failed to detect environment', error)
      )
    }
  })

// ===== Strategy Selection ===== //

/**
 * 環境とパフォーマンス要件に基づいて最適な戦略を選択
 */
export const selectOptimalStrategy = (
  environment: EnvironmentInfo,
  requirements: PerformanceRequirements
): RepositoryStrategyType => {
  // メモリ制約が厳しい場合
  if (environment.memoryConstraints === 'low' || requirements.memoryBudget < 64) {
    if (environment.hasIndexedDB) return 'indexeddb'
    return 'memory' // フォールバック
  }

  // 高い並行性が必要な場合
  if (requirements.concurrentOperations > 10 && environment.hasWebWorkers) {
    return 'webworker'
  }

  // 強い一貫性が必要な場合
  if (requirements.dataConsistency === 'strong') {
    return 'memory' // インメモリが最も一貫性が高い
  }

  // 永続化が必要な場合
  if (requirements.durability === 'persistent') {
    if (environment.hasIndexedDB) return 'indexeddb'
    if (environment.hasFileSystem) return 'memory' // Node.jsでは外部永続化と組み合わせ
  }

  // 低遅延が最優先の場合
  if (requirements.maxLatency < 10) {
    return 'memory'
  }

  // バランス型の場合
  if (environment.hasIndexedDB && environment.memoryConstraints === 'high') {
    return 'hybrid'
  }

  // デフォルト選択
  return 'memory'
}

/**
 * 自動戦略選択
 */
export const autoSelectStrategy = (
  requirements?: Partial<PerformanceRequirements>
): Effect.Effect<RepositoryStrategyType, RepositoryError> =>
  Effect.gen(function* () {
    const environment = yield* detectEnvironment()

    const defaultRequirements: PerformanceRequirements = {
      maxLatency: 100,
      minThroughput: 10,
      memoryBudget: 256,
      concurrentOperations: 5,
      dataConsistency: 'eventual',
      durability: 'session'
    }

    const finalRequirements = { ...defaultRequirements, ...requirements }
    return selectOptimalStrategy(environment, finalRequirements)
  })

// ===== Strategy Factory ===== //

/**
 * 戦略に基づいてRepository Layerを作成
 */
export const createRepositoryLayer = (
  strategy: RepositoryStrategyType
): Layer.Layer<ChunkRepository, RepositoryError> =>
  pipe(
    strategy,
    Match.value,
    Match.when('memory', () => InMemoryChunkRepositoryLive),
    Match.when('indexeddb', () => IndexedDBChunkRepositoryLive),
    Match.when('webworker', () => WebWorkerChunkRepositoryLive),
    Match.when('hybrid', () => createHybridRepository()),
    Match.when('auto', () => createAutoRepository()),
    Match.exhaustive
  )

/**
 * ハイブリッドRepository（複数実装の組み合わせ）
 */
const createHybridRepository = (): Layer.Layer<ChunkRepository, RepositoryError> =>
  Layer.effect(
    ChunkRepository,
    Effect.gen(function* () {
      // メモリ + IndexedDBのハイブリッド実装
      const memoryRepo = yield* Effect.service(ChunkRepository).pipe(
        Effect.provide(InMemoryChunkRepositoryLive)
      )

      const persistentRepo = yield* Effect.service(ChunkRepository).pipe(
        Effect.provide(IndexedDBChunkRepositoryLive)
      )

      return {
        // 読み取りはメモリから高速実行
        findById: memoryRepo.findById,
        findByPosition: memoryRepo.findByPosition,
        findByRegion: memoryRepo.findByRegion,
        findByIds: memoryRepo.findByIds,
        findByPositions: memoryRepo.findByPositions,
        exists: memoryRepo.exists,
        existsByPosition: memoryRepo.existsByPosition,
        count: memoryRepo.count,
        countByRegion: memoryRepo.countByRegion,
        findByQuery: memoryRepo.findByQuery,
        findRecentlyLoaded: memoryRepo.findRecentlyLoaded,
        findModified: memoryRepo.findModified,
        getStatistics: memoryRepo.getStatistics,

        // 書き込みは両方に実行（メモリは同期、永続化は非同期）
        save: (chunk) =>
          Effect.gen(function* () {
            // メモリに即座に保存
            const result = yield* memoryRepo.save(chunk)

            // バックグラウンドで永続化（エラーがあってもメイン処理は続行）
            yield* Effect.fork(
              persistentRepo.save(chunk).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`Persistent save failed: ${JSON.stringify(error)}`)
                )
              )
            )

            return result
          }),

        saveAll: (chunks) =>
          Effect.gen(function* () {
            // メモリに一括保存
            const result = yield* memoryRepo.saveAll(chunks)

            // バックグラウンドで永続化
            yield* Effect.fork(
              persistentRepo.saveAll(chunks).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`Persistent batch save failed: ${JSON.stringify(error)}`)
                )
              )
            )

            return result
          }),

        // 削除は両方から実行
        delete: (id) =>
          Effect.gen(function* () {
            yield* memoryRepo.delete(id)
            yield* persistentRepo.delete(id).pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent delete failed: ${JSON.stringify(error)}`)
              )
            )
          }),

        deleteByPosition: (position) =>
          Effect.gen(function* () {
            yield* memoryRepo.deleteByPosition(position)
            yield* persistentRepo.deleteByPosition(position).pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent delete by position failed: ${JSON.stringify(error)}`)
              )
            )
          }),

        deleteAll: (ids) =>
          Effect.gen(function* () {
            yield* memoryRepo.deleteAll(ids)
            yield* persistentRepo.deleteAll(ids).pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent delete all failed: ${JSON.stringify(error)}`)
              )
            )
          }),

        // バッチ操作
        batchSave: memoryRepo.batchSave,
        batchDelete: memoryRepo.batchDelete,

        // メンテナンス操作
        initialize: () =>
          Effect.gen(function* () {
            yield* memoryRepo.initialize()
            yield* persistentRepo.initialize().pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent initialize failed: ${JSON.stringify(error)}`)
              )
            )
          }),

        clear: () =>
          Effect.gen(function* () {
            yield* memoryRepo.clear()
            yield* persistentRepo.clear().pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent clear failed: ${JSON.stringify(error)}`)
              )
            )
          }),

        validateIntegrity: memoryRepo.validateIntegrity,

        clearCache: () =>
          Effect.gen(function* () {
            yield* memoryRepo.clearCache()
            yield* persistentRepo.clearCache().pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent cache clear failed: ${JSON.stringify(error)}`)
              )
            )
          }),

        cleanup: () =>
          Effect.gen(function* () {
            yield* memoryRepo.cleanup()
            yield* persistentRepo.cleanup().pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`Persistent cleanup failed: ${JSON.stringify(error)}`)
              )
            )
          })
      }
    })
  )

/**
 * 自動Repository（環境自動検出）
 */
const createAutoRepository = (): Layer.Layer<ChunkRepository, RepositoryError> =>
  Layer.effect(
    ChunkRepository,
    Effect.gen(function* () {
      const strategy = yield* autoSelectStrategy()

      // 再帰的に適切な戦略のRepositoryを作成
      if (strategy === 'auto') {
        // 無限再帰防止：autoが選ばれた場合はmemoryにフォールバック
        return yield* Effect.service(ChunkRepository).pipe(
          Effect.provide(InMemoryChunkRepositoryLive)
        )
      }

      return yield* Effect.service(ChunkRepository).pipe(
        Effect.provide(createRepositoryLayer(strategy))
      )
    })
  )

// ===== Configuration Builder ===== //

/**
 * Repository設定ビルダー
 */
export class RepositoryConfigBuilder {
  private config: Partial<RepositoryConfig> = {}

  strategy(strategy: RepositoryStrategyType): RepositoryConfigBuilder {
    this.config.strategy = strategy
    return this
  }

  maxMemoryUsage(mb: number): RepositoryConfigBuilder {
    this.config.options = { ...this.config.options, maxMemoryUsage: mb }
    return this
  }

  preferredStorage(storage: 'memory' | 'persistent'): RepositoryConfigBuilder {
    this.config.options = { ...this.config.options, preferredStorage: storage }
    return this
  }

  enableWebWorkers(enable: boolean = true, maxWorkers?: number): RepositoryConfigBuilder {
    this.config.options = {
      ...this.config.options,
      enableWebWorkers: enable,
      maxWorkers: maxWorkers
    }
    return this
  }

  cacheSize(size: number): RepositoryConfigBuilder {
    this.config.options = { ...this.config.options, cacheSize: size }
    return this
  }

  enableCompression(enable: boolean = true): RepositoryConfigBuilder {
    this.config.options = { ...this.config.options, compressionEnabled: enable }
    return this
  }

  enableEncryption(enable: boolean = true): RepositoryConfigBuilder {
    this.config.options = { ...this.config.options, encryptionEnabled: enable }
    return this
  }

  build(): RepositoryConfig {
    if (!this.config.strategy) {
      throw new Error('Strategy must be specified')
    }

    return this.config as RepositoryConfig
  }

  buildLayer(): Layer.Layer<ChunkRepository, RepositoryError> {
    const config = this.build()
    return createRepositoryLayer(config.strategy)
  }
}

// ===== Convenience Functions ===== //

/**
 * 設定ビルダーを作成
 */
export const configureRepository = (): RepositoryConfigBuilder =>
  new RepositoryConfigBuilder()

/**
 * 環境に最適化されたRepository Layerを作成
 */
export const createOptimizedRepositoryLayer = (
  requirements?: Partial<PerformanceRequirements>
): Layer.Layer<ChunkRepository, RepositoryError> =>
  Layer.effect(
    ChunkRepository,
    Effect.gen(function* () {
      const strategy = yield* autoSelectStrategy(requirements)
      return yield* Effect.service(ChunkRepository).pipe(
        Effect.provide(createRepositoryLayer(strategy))
      )
    })
  )

/**
 * 開発環境用のRepository Layer
 */
export const DevelopmentRepositoryLayer = InMemoryChunkRepositoryLive

/**
 * テスト環境用のRepository Layer
 */
export const TestRepositoryLayer = InMemoryChunkRepositoryLive

/**
 * 本番環境用のRepository Layer
 */
export const ProductionRepositoryLayer = createOptimizedRepositoryLayer({
  dataConsistency: 'strong',
  durability: 'persistent',
  memoryBudget: 512,
  maxLatency: 50,
  minThroughput: 100
})