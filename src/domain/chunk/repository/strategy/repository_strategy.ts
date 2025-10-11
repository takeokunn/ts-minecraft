import { Effect, Layer, Match, pipe } from 'effect'
import { getEffectiveConnectionType } from '../../../../shared/browser/network-info-schema'
import { getPerformanceMemoryOrDefault } from '../../../performance'
import {
  ChunkRepository,
  IndexedDBChunkRepositoryLive,
  InMemoryChunkRepositoryLive,
  WebWorkerChunkRepositoryLive,
} from '../chunk_repository'
import type { RepositoryError } from '../types'
import { RepositoryErrors } from '../types'
import { initialRepositoryConfigBuilderState, type RepositoryConfigBuilderState } from './config_builder_state'

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
export type RepositoryStrategyType = 'memory' | 'indexeddb' | 'webworker' | 'hybrid' | 'auto'

/**
 * string を RepositoryStrategyType に変換
 *
 * Pattern 7（型ガード関数集約）
 * 使用箇所: 戦略選択ロジック内（Match.when）
 */
export const asRepositoryStrategyType = <T extends string>(type: T): RepositoryStrategyType =>
  type as RepositoryStrategyType

/**
 * 環境情報
 */
export interface EnvironmentInfo {
  readonly platform: 'browser' | 'node' | 'webworker' | 'unclassified'
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
    // プラットフォーム検出
    const platform = pipe(
      Match.value({
        hasWindow: typeof window !== 'undefined',
        hasNode: typeof process !== 'undefined' && process.versions?.node,
        hasWebWorker: typeof self !== 'undefined' && typeof importScripts === 'function',
      }),
      Match.when({ hasWindow: true }, () => 'browser' as const),
      Match.when({ hasNode: true }, () => 'node' as const),
      Match.when({ hasWebWorker: true }, () => 'webworker' as const),
      Match.orElse(() => 'unclassified' as const)
    )

    // API利用可能性チェック
    const hasBrowserAPI = typeof window !== 'undefined'
    const hasIndexedDB = typeof indexedDB !== 'undefined'
    const hasWebWorkers = typeof Worker !== 'undefined'
    const hasFileSystem = typeof process !== 'undefined' && typeof require !== 'undefined'

    // メモリ制約推定（Effect内で取得）
    const memoryConstraints = yield* pipe(
      platform,
      Match.value,
      Match.when('browser', () =>
        'memory' in performance
          ? pipe(
              getPerformanceMemoryOrDefault(),
              Effect.map((memory) =>
                memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8
                  ? ('low' as const)
                  : memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.5
                    ? ('medium' as const)
                    : ('high' as const)
              )
            )
          : Effect.succeed('medium' as const)
      ),
      Match.when('node', () =>
        process.memoryUsage
          ? Effect.sync(() =>
              pipe(
                process.memoryUsage(),
                (usage) => usage.heapTotal / (1024 * 1024),
                (totalMB) =>
                  totalMB < 128 ? ('low' as const) : totalMB < 512 ? ('medium' as const) : ('high' as const)
              )
            )
          : Effect.succeed('medium' as const)
      ),
      Match.orElse(() => Effect.succeed('medium' as const))
    )

    // パフォーマンスプロファイル推定（Effect内で取得）
    const performanceProfile = yield* pipe(
      platform,
      Match.value,
      Match.when('browser', () =>
        'connection' in navigator
          ? pipe(
              getEffectiveConnectionType(),
              Effect.map((type) =>
                pipe(
                  type,
                  Match.value,
                  Match.when('slow-2g', () => 'low' as const),
                  Match.when('2g', () => 'low' as const),
                  Match.when('3g', () => 'medium' as const),
                  Match.orElse(() => 'high' as const)
                )
              )
            )
          : Effect.succeed('high' as const)
      ),
      Match.orElse(() => Effect.succeed('high' as const))
    )

    // 並行処理サポート
    const concurrencySupport = hasWebWorkers || platform === 'node'

    return {
      platform,
      hasBrowserAPI,
      hasIndexedDB,
      hasWebWorkers,
      hasFileSystem,
      memoryConstraints,
      performanceProfile,
      concurrencySupport,
    } satisfies EnvironmentInfo
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(RepositoryErrors.storage('environment_detection', 'Failed to detect environment', error))
    )
  )

// ===== Strategy Selection ===== //

/**
 * 環境とパフォーマンス要件に基づいて最適な戦略を選択
 */
export const selectOptimalStrategy = (
  environment: EnvironmentInfo,
  requirements: PerformanceRequirements
): RepositoryStrategyType =>
  pipe(
    // 優先度順に条件をチェック
    Match.value({
      // メモリ制約が厳しい場合の判定
      isLowMemory: environment.memoryConstraints === 'low' || requirements.memoryBudget < 64,
      // 高い並行性が必要な場合の判定
      needsHighConcurrency: requirements.concurrentOperations > 10 && environment.hasWebWorkers,
      // 強い一貫性が必要な場合の判定
      needsStrongConsistency: requirements.dataConsistency === 'strong',
      // 永続化が必要な場合の判定
      needsPersistence: requirements.durability === 'persistent',
      // 低遅延が最優先の場合の判定
      needsLowLatency: requirements.maxLatency < 10,
      // バランス型の判定
      isBalanced: environment.hasIndexedDB && environment.memoryConstraints === 'high',
      // 環境情報
      environment,
    }),
    // メモリ制約が厳しい場合
    Match.when({ isLowMemory: true }, ({ environment }) =>
      environment.hasIndexedDB ? ('indexeddb' as const) : ('memory' as const)
    ),
    // 高い並行性が必要な場合
    Match.when({ needsHighConcurrency: true }, () => 'webworker' as const),
    // 強い一貫性が必要な場合
    Match.when({ needsStrongConsistency: true }, () => 'memory' as const),
    // 永続化が必要な場合
    Match.when({ needsPersistence: true }, ({ environment }) =>
      environment.hasIndexedDB
        ? ('indexeddb' as const)
        : environment.hasFileSystem
          ? ('memory' as const)
          : ('memory' as const)
    ),
    // 低遅延が最優先の場合
    Match.when({ needsLowLatency: true }, () => 'memory' as const),
    // バランス型の場合
    Match.when({ isBalanced: true }, () => 'hybrid' as const),
    // デフォルト選択
    Match.orElse(() => 'memory' as const)
  )

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
      durability: 'session',
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
      const memoryRepo = yield* Effect.service(ChunkRepository).pipe(Effect.provide(InMemoryChunkRepositoryLive))

      const persistentRepo = yield* Effect.service(ChunkRepository).pipe(Effect.provide(IndexedDBChunkRepositoryLive))

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
              persistentRepo
                .save(chunk)
                .pipe(Effect.catchAll((error) => Effect.logWarning(`Persistent save failed: ${JSON.stringify(error)}`)))
            )

            return result
          }),

        saveAll: (chunks) =>
          Effect.gen(function* () {
            // メモリに一括保存
            const result = yield* memoryRepo.saveAll(chunks)

            // バックグラウンドで永続化
            yield* Effect.fork(
              persistentRepo
                .saveAll(chunks)
                .pipe(
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
            yield* persistentRepo
              .delete(id)
              .pipe(Effect.catchAll((error) => Effect.logWarning(`Persistent delete failed: ${JSON.stringify(error)}`)))
          }),

        deleteByPosition: (position) =>
          Effect.gen(function* () {
            yield* memoryRepo.deleteByPosition(position)
            yield* persistentRepo
              .deleteByPosition(position)
              .pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`Persistent delete by position failed: ${JSON.stringify(error)}`)
                )
              )
          }),

        deleteAll: (ids) =>
          Effect.gen(function* () {
            yield* memoryRepo.deleteAll(ids)
            yield* persistentRepo
              .deleteAll(ids)
              .pipe(
                Effect.catchAll((error) => Effect.logWarning(`Persistent delete all failed: ${JSON.stringify(error)}`))
              )
          }),

        // バッチ操作
        batchSave: memoryRepo.batchSave,
        batchDelete: memoryRepo.batchDelete,

        // メンテナンス操作
        initialize: () =>
          Effect.gen(function* () {
            yield* memoryRepo.initialize()
            yield* persistentRepo
              .initialize()
              .pipe(
                Effect.catchAll((error) => Effect.logWarning(`Persistent initialize failed: ${JSON.stringify(error)}`))
              )
          }),

        clear: () =>
          Effect.gen(function* () {
            yield* memoryRepo.clear()
            yield* persistentRepo
              .clear()
              .pipe(Effect.catchAll((error) => Effect.logWarning(`Persistent clear failed: ${JSON.stringify(error)}`)))
          }),

        validateIntegrity: memoryRepo.validateIntegrity,

        clearCache: () =>
          Effect.gen(function* () {
            yield* memoryRepo.clearCache()
            yield* persistentRepo
              .clearCache()
              .pipe(
                Effect.catchAll((error) => Effect.logWarning(`Persistent cache clear failed: ${JSON.stringify(error)}`))
              )
          }),

        cleanup: () =>
          Effect.gen(function* () {
            yield* memoryRepo.cleanup()
            yield* persistentRepo
              .cleanup()
              .pipe(
                Effect.catchAll((error) => Effect.logWarning(`Persistent cleanup failed: ${JSON.stringify(error)}`))
              )
          }),
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
      // 無限再帰防止：autoが選ばれた場合はmemoryにフォールバック
      return yield* pipe(
        strategy,
        Match.value,
        Match.when('auto', () => Effect.service(ChunkRepository).pipe(Effect.provide(InMemoryChunkRepositoryLive))),
        Match.orElse((s) => Effect.service(ChunkRepository).pipe(Effect.provide(createRepositoryLayer(s))))
      )
    })
  )

// ===== Configuration Builder ===== //

// ===== Convenience Functions ===== //

/**
 * 設定ビルダーを作成
 *
 * @returns 初期状態のRepositoryConfigBuilderState
 */
export const configureRepository = (): RepositoryConfigBuilderState => initialRepositoryConfigBuilderState

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
      return yield* Effect.service(ChunkRepository).pipe(Effect.provide(createRepositoryLayer(strategy)))
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
  minThroughput: 100,
})
