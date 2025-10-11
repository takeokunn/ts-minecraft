/**
 * Cache Optimization Service Layers
 *
 * キャッシュ最適化サービスのLayer定義
 */

import { ErrorCauseSchema } from '@shared/schema/error'
import { Context, Effect, Layer, Option, ReadonlyArray, Ref, Schema, pipe } from 'effect'
import { CacheManagerService, CacheManagerServiceLive } from './cache_manager'

/**
 * Preloading Strategy Configuration
 */
export const PreloadingStrategy = Schema.Struct({
  _tag: Schema.Literal('PreloadingStrategy'),
  enabled: Schema.Boolean,
  predictiveDistance: Schema.Number.pipe(Schema.positive()),
  maxPreloadChunks: Schema.Number.pipe(Schema.positive(), Schema.int()),
  preloadPriority: Schema.Union(Schema.Literal('high'), Schema.Literal('medium'), Schema.Literal('low')),
  adaptivePreloading: Schema.Boolean,
})

/**
 * Cache Optimization Service Error
 */
export const CacheOptimizationError = Schema.TaggedError<CacheOptimizationErrorType>()('CacheOptimizationError', {
  message: Schema.String,
  optimizerId: Schema.String,
  cause: Schema.optional(ErrorCauseSchema),
})

export interface CacheOptimizationErrorType extends Schema.Schema.Type<typeof CacheOptimizationError> {}

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
  readonly defragmentMemory: () => Effect.Effect<
    {
      freedMemory: number
      compactedEntries: number
    },
    CacheOptimizationErrorType
  >

  /**
   * プリローディング戦略を更新します
   */
  readonly updatePreloadingStrategy: (
    strategy: Partial<Schema.Schema.Type<typeof PreloadingStrategy>>
  ) => Effect.Effect<void, CacheOptimizationErrorType>

  /**
   * キャッシュ効率レポートを取得します
   */
  readonly getEfficiencyReport: () => Effect.Effect<
    {
      hitRate: number
      memoryUsage: number
      fragmentationLevel: number
      recommendations: string[]
    },
    CacheOptimizationErrorType
  >
}

// === Default Configuration ===

export const DEFAULT_PRELOADING_STRATEGY: Schema.Schema.Type<typeof PreloadingStrategy> = {
  _tag: 'PreloadingStrategy',
  enabled: true,
  predictiveDistance: 5.0,
  maxPreloadChunks: 50,
  preloadPriority: 'medium',
  adaptivePreloading: true,
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

      return yield* pipe(
        strategy,
        Option.some,
        Option.filter((s) => s.enabled),
        Option.match({
          onNone: () => Effect.succeed(0),
          onSome: (s) =>
            Effect.gen(function* () {
              const maxPreload = Math.min(s.maxPreloadChunks, radius * radius * 4)

              // 2重ネストループを関数型パターンに変換（並行処理）
              const positions = pipe(
                ReadonlyArray.range(centerX - radius, centerX + radius + 1),
                ReadonlyArray.flatMap((x) =>
                  pipe(
                    ReadonlyArray.range(centerZ - radius, centerZ + radius + 1),
                    ReadonlyArray.map((z) => ({ x, z }))
                  )
                ),
                ReadonlyArray.take(maxPreload)
              )

              const preloadedCount = yield* pipe(
                positions,
                Effect.reduce(0, (count, { x, z }) =>
                  Effect.gen(function* () {
                    const chunkKey = `chunk_${x}_${z}`
                    const hasChunk = yield* cacheManager.has(chunkKey)

                    // if早期return → Effect.if利用
                    return yield* Effect.if(hasChunk, {
                      onTrue: () => Effect.succeed(count),
                      onFalse: () =>
                        Effect.gen(function* () {
                          // チャンクデータの生成とキャッシュ（簡略化）
                          const chunkData = { x, z, generated: true, playerId }

                          yield* cacheManager.set(chunkKey, chunkData, {
                            priority: s.preloadPriority === 'high' ? 0.8 : 0.3,
                            layer: 'l2_memory',
                          })

                          return count + 1
                        }),
                    })
                  })
                )
              )

              yield* Effect.logInfo(`プリローディング完了: ${preloadedCount}チャンク`)
              return preloadedCount
            }),
        })
      )
    })

  const startAutoOptimization = () =>
    Effect.gen(function* () {
      const isActive = yield* Ref.get(isAutoOptimizing)

      return yield* pipe(
        isActive,
        (active) => !active,
        (canStart) =>
          canStart
            ? Effect.gen(function* () {
                yield* Ref.set(isAutoOptimizing, true)

                // 自動最適化ループを開始
                yield* Effect.forkScoped(optimizationLoop())

                yield* Effect.logInfo('自動キャッシュ最適化開始')
              })
            : Effect.logWarning('自動最適化は既に開始されています')
      )
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
      yield* Ref.update(preloadingStrategy, (current) => ({ ...current, ...strategyUpdate }))
      yield* Effect.logInfo('プリローディング戦略更新完了')
    })

  const getEfficiencyReport = () =>
    Effect.gen(function* () {
      const stats = yield* cacheManager.getStatistics()
      const totalSize = yield* cacheManager.getSize()

      const recommendations: string[] = []

      yield* pipe(
        stats.hitRate,
        (hitRate) => hitRate < 0.7,
        (isLowHitRate) =>
          isLowHitRate
            ? Effect.sync(() => {
                recommendations.push('キャッシュヒット率が低いです。プリローディング戦略を見直してください。')
              })
            : Effect.void
      )

      yield* pipe(
        totalSize,
        (size) => size > 500 * 1024 * 1024, // 500MB
        (isHighMemory) =>
          isHighMemory
            ? Effect.sync(() => {
                recommendations.push('メモリ使用量が高いです。エビクション設定を調整してください。')
              })
            : Effect.void
      )

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

          // if早期return → Effect.if利用
          return yield* Effect.if(isActive, {
            onTrue: () =>
              Effect.gen(function* () {
                // 定期的な最適化実行
                yield* cacheManager.optimize()

                // 効率レポートチェック
                const report = yield* getEfficiencyReport()

                yield* Effect.when(report.hitRate < 0.5, () =>
                  Effect.logWarning(`キャッシュ効率が低下: ヒット率=${(report.hitRate * 100).toFixed(1)}%`)
                )

                return true
              }),
            onFalse: () => Effect.succeed(false),
          })
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

export const CacheOptimizationServiceLive = Layer.scoped(CacheOptimizationService, makeCacheOptimizationService).pipe(
  Layer.provide(CacheManagerServiceLive)
)

// === Complete Service Layer ===

export const CacheOptimizationServicesLayer = Layer.mergeAll(CacheManagerServiceLive, CacheOptimizationServiceLive)
