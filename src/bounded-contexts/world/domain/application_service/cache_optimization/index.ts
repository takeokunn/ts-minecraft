/**
 * Cache Optimization Application Service
 *
 * 多階層キャッシュシステムの統合管理と最適化機能を提供します。
 * プリローディング戦略、削除ポリシー、メモリ断片化解消を含む
 * 包括的なキャッシュ最適化システムです。
 */

// === Cache Manager ===
export {
  CacheManagerService,
  CacheManagerServiceLive,
  CacheManagerError,
  CacheEntry,
  CacheLayer,
  CacheConfiguration,
  CacheStatistics,
  DEFAULT_CACHE_CONFIG,
} from './cache-manager.js'

export type {
  CacheManagerErrorType,
  CacheEntryType,
  CacheLayerType,
  CacheConfigurationType,
  CacheStatisticsType,
} from './cache-manager.js'

// === Integrated Cache Optimization Service ===

import { Context, Effect, Layer, Schema, Ref } from 'effect'
import { CacheManagerService } from './cache-manager.js'

/**
 * Cache Optimization Service Error
 */
export const CacheOptimizationError = Schema.TaggedError<CacheOptimizationErrorType>()(
  'CacheOptimizationError',
  {
    message: Schema.String,
    optimizerId: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
)

export interface CacheOptimizationErrorType
  extends Schema.Schema.Type<typeof CacheOptimizationError> {}

/**
 * Preloading Strategy Configuration
 */
export const PreloadingStrategy = Schema.Struct({
  _tag: Schema.Literal('PreloadingStrategy'),
  enabled: Schema.Boolean,
  predictiveDistance: Schema.Number.pipe(Schema.positive()),
  maxPreloadChunks: Schema.Number.pipe(Schema.positive(), Schema.int()),
  preloadPriority: Schema.Union(
    Schema.Literal('high'),
    Schema.Literal('medium'),
    Schema.Literal('low'),
  ),
  adaptivePreloading: Schema.Boolean,
})

/**
 * Cache Optimization Service Interface
 */
export interface CacheOptimizationService {
  /**
   * キャッシュ最適化システムを初期化します
   */
  readonly initialize: () => Effect.Effect<void, CacheOptimizationErrorType>

  /**
   * プリローディングを実行します
   */
  readonly preloadChunks: (
    centerX: number,
    centerZ: number,
    radius: number,
    playerId: string
  ) => Effect.Effect<number, CacheOptimizationErrorType> // プリロードされたチャンク数

  /**
   * 自動キャッシュ最適化を開始します
   */
  readonly startAutoOptimization: () => Effect.Effect<void, CacheOptimizationErrorType>

  /**
   * 自動キャッシュ最適化を停止します
   */
  readonly stopAutoOptimization: () => Effect.Effect<void, CacheOptimizationErrorType>

  /**
   * メモリ断片化を解消します
   */
  readonly defragmentMemory: () => Effect.Effect<{
    freedMemory: number
    compactedEntries: number
  }, CacheOptimizationErrorType>

  /**
   * プリローディング戦略を更新します
   */
  readonly updatePreloadingStrategy: (
    strategy: Partial<Schema.Schema.Type<typeof PreloadingStrategy>>
  ) => Effect.Effect<void, CacheOptimizationErrorType>

  /**
   * キャッシュ効率レポートを取得します
   */
  readonly getEfficiencyReport: () => Effect.Effect<{
    hitRate: number
    memoryUsage: number
    fragmentationLevel: number
    recommendations: string[]
  }, CacheOptimizationErrorType>
}

// === Live Implementation ===

const makeCacheOptimizationService = Effect.gen(function* () {
  const cacheManager = yield* CacheManagerService
  const preloadingStrategy = yield* Ref.make<Schema.Schema.Type<typeof PreloadingStrategy>>(DEFAULT_PRELOADING_STRATEGY)
  const isAutoOptimizing = yield* Ref.make<boolean>(false)

  const initialize = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Cache Optimization システム初期化開始')

      // キャッシュマネージャーの初期化
      // プリローディング戦略の設定

      yield* Effect.logInfo('Cache Optimization システム初期化完了')
    })

  const preloadChunks = (centerX: number, centerZ: number, radius: number, playerId: string) =>
    Effect.gen(function* () {
      const strategy = yield* Ref.get(preloadingStrategy)

      if (!strategy.enabled) {
        return 0
      }

      let preloadedCount = 0
      const maxPreload = Math.min(strategy.maxPreloadChunks, radius * radius * 4)

      for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let z = centerZ - radius; z <= centerZ + radius; z++) {
          if (preloadedCount >= maxPreload) break

          const chunkKey = `chunk_${x}_${z}`
          const hasChunk = yield* cacheManager.has(chunkKey)

          if (!hasChunk) {
            // チャンクデータの生成とキャッシュ（簡略化）
            const chunkData = { x, z, generated: true, playerId }

            yield* cacheManager.set(chunkKey, chunkData, {
              priority: strategy.preloadPriority === 'high' ? 0.8 : 0.3,
              layer: 'l2_memory',
            })

            preloadedCount++
          }
        }
      }

      yield* Effect.logInfo(`プリローディング完了: ${preloadedCount}チャンク`)
      return preloadedCount
    })

  const startAutoOptimization = () =>
    Effect.gen(function* () {
      const isActive = yield* Ref.get(isAutoOptimizing)
      if (isActive) {
        yield* Effect.logWarning('自動最適化は既に開始されています')
        return
      }

      yield* Ref.set(isAutoOptimizing, true)

      // 自動最適化ループを開始
      yield* Effect.fork(optimizationLoop())

      yield* Effect.logInfo('自動キャッシュ最適化開始')
    })

  const stopAutoOptimization = () =>
    Effect.gen(function* () {
      yield* Ref.set(isAutoOptimizing, false)
      yield* Effect.logInfo('自動キャッシュ最適化停止')
    })

  const defragmentMemory = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('メモリ断片化解消開始')

      // キャッシュ最適化実行
      yield* cacheManager.optimize()

      // 統計取得
      const stats = yield* cacheManager.getStatistics()

      const result = {
        freedMemory: stats.evictionCount * 1024, // 推定
        compactedEntries: Math.floor(stats.totalHits * 0.1), // 推定
      }

      yield* Effect.logInfo(`断片化解消完了: ${result.freedMemory}バイト解放, ${result.compactedEntries}エントリ圧縮`)
      return result
    })

  const updatePreloadingStrategy = (strategyUpdate: Partial<Schema.Schema.Type<typeof PreloadingStrategy>>) =>
    Effect.gen(function* () {
      yield* Ref.update(preloadingStrategy, current => ({ ...current, ...strategyUpdate }))
      yield* Effect.logInfo('プリローディング戦略更新完了')
    })

  const getEfficiencyReport = () =>
    Effect.gen(function* () {
      const stats = yield* cacheManager.getStatistics()
      const totalSize = yield* cacheManager.getSize()

      const recommendations = []

      if (stats.hitRate < 0.7) {
        recommendations.push('キャッシュヒット率が低いです。プリローディング戦略を見直してください。')
      }

      if (totalSize > 500 * 1024 * 1024) { // 500MB
        recommendations.push('メモリ使用量が高いです。エビクション設定を調整してください。')
      }

      const report = {
        hitRate: stats.hitRate,
        memoryUsage: totalSize,
        fragmentationLevel: 0.3, // 推定値
        recommendations,
      }

      return report
    })

  // === Helper Functions ===

  const optimizationLoop = () =>
    Effect.gen(function* () {
      yield* Effect.repeat(
        Effect.gen(function* () {
          const isActive = yield* Ref.get(isAutoOptimizing)
          if (!isActive) return false

          // 定期的な最適化実行
          yield* cacheManager.optimize()

          // 効率レポートチェック
          const report = yield* getEfficiencyReport()

          if (report.hitRate < 0.5) {
            yield* Effect.logWarning(`キャッシュ効率が低下: ヒット率=${(report.hitRate * 100).toFixed(1)}%`)
          }

          return true
        }),
        { schedule: Effect.Schedule.spaced('30 seconds') }
      )
    })

  return CacheOptimizationService.of({
    initialize,
    preloadChunks,
    startAutoOptimization,
    stopAutoOptimization,
    defragmentMemory,
    updatePreloadingStrategy,
    getEfficiencyReport,
  })
})

// === Context Tag ===

export const CacheOptimizationService = Context.GenericTag<CacheOptimizationService>(
  '@minecraft/domain/world/CacheOptimizationService'
)

// === Layer ===

export const CacheOptimizationServiceLive = Layer.effect(
  CacheOptimizationService,
  makeCacheOptimizationService
).pipe(
  Layer.provide(CacheManagerServiceLive)
)

// === Complete Service Layer ===

export const CacheOptimizationServicesLayer = Layer.mergeAll(
  CacheManagerServiceLive,
  CacheOptimizationServiceLive
)

// === Default Configuration ===

export const DEFAULT_PRELOADING_STRATEGY: Schema.Schema.Type<typeof PreloadingStrategy> = {
  _tag: 'PreloadingStrategy',
  enabled: true,
  predictiveDistance: 5.0,
  maxPreloadChunks: 50,
  preloadPriority: 'medium',
  adaptivePreloading: true,
}

// === Helper Functions ===

export const CacheOptimizationUtils = {
  /**
   * チャンクの重要度を計算
   */
  calculateChunkImportance: (
    chunkX: number,
    chunkZ: number,
    playerX: number,
    playerZ: number,
    viewDistance: number
  ) => {
    const distance = Math.sqrt((chunkX - playerX) ** 2 + (chunkZ - playerZ) ** 2)
    const normalizedDistance = Math.min(distance / viewDistance, 1.0)
    return 1.0 - normalizedDistance
  },

  /**
   * メモリ使用量の推定
   */
  estimateChunkMemoryUsage: (chunkComplexity: number = 1.0) => {
    const baseSize = 64 * 1024 // 64KB基本サイズ
    return Math.floor(baseSize * chunkComplexity)
  },

  /**
   * キャッシュ戦略の推奨
   */
  recommendCacheStrategy: (
    hitRate: number,
    memoryPressure: number,
    accessPattern: 'sequential' | 'random' | 'clustered'
  ) => {
    if (hitRate < 0.5) {
      return 'aggressive_preloading'
    } else if (memoryPressure > 0.8) {
      return 'conservative_eviction'
    } else if (accessPattern === 'sequential') {
      return 'predictive_caching'
    } else {
      return 'adaptive_hybrid'
    }
  },
}

export type {
  CacheOptimizationErrorType,
  PreloadingStrategy as PreloadingStrategyType,
} from './index.js'