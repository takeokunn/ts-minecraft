/**
 * @fileoverview World Generator Repository Memory Implementation
 * ワールド生成器リポジトリのインメモリ実装
 *
 * 開発・テスト用途の高速メモリベース実装
 * Effect-TS 3.17+ Layer パターンによる依存性注入対応
 */

import type {
  AllRepositoryErrors,
  GenerationSettings,
  PerformanceMetrics,
  WorldGenerator,
  WorldId,
  WorldSeed,
} from '@domain/world/types'
import { createRepositoryError, createWorldGeneratorNotFoundError } from '@domain/world/types'
import { Clock, DateTime, Effect, Layer, Option, pipe, ReadonlyArray, Ref, Either } from 'effect'
import { Buffer } from 'node:buffer'
import {
  WorldGeneratorRepository,
  type CacheConfiguration,
  type WorldGeneratorBatchResult,
  type WorldGeneratorQuery,
  type WorldGeneratorRepositoryConfig,
  type WorldGeneratorRepository as WorldGeneratorRepositoryService,
  type WorldGeneratorStatistics,
} from './index'

// === Memory Storage State ===

interface MemoryStorage {
  readonly generators: Map<WorldId, WorldGenerator>
  readonly statistics: {
    totalChunksGenerated: number
    lastGenerationTime: Date | null
    performanceMetrics: Map<WorldId, PerformanceMetrics>
  }
  readonly cache: {
    configuration: CacheConfiguration
    statistics: {
      hits: number
      misses: number
      evictions: number
    }
  }
}

const createInitialMemoryStorage = (): MemoryStorage => ({
  generators: new Map(),
  statistics: {
    totalChunksGenerated: 0,
    lastGenerationTime: null,
    performanceMetrics: new Map(),
  },
  cache: {
    configuration: {
      enabled: true,
      maxSize: 1000,
      ttlSeconds: 3600,
      strategy: 'lru',
      compressionEnabled: false,
    },
    statistics: {
      hits: 0,
      misses: 0,
      evictions: 0,
    },
  },
})

// === Memory Implementation ===

const makeWorldGeneratorRepositoryMemory = (
  config: WorldGeneratorRepositoryConfig = {
    storage: { type: 'memory' },
    cache: {
      enabled: true,
      maxSize: 1000,
      ttlSeconds: 3600,
      strategy: 'lru',
      compressionEnabled: false,
    },
    backup: {
      enabled: false,
      intervalMinutes: 60,
      maxBackups: 5,
      compressionLevel: 6,
      encryptionEnabled: false,
    },
    performance: {
      enableMetrics: true,
      enableProfiling: false,
      batchSize: 100,
    },
  }
): Effect.Effect<WorldGeneratorRepositoryService, never, never> =>
  Effect.gen(function* () {
    const storageRef = yield* Ref.make(createInitialMemoryStorage())

    const updateCacheStats = (
      fn: (stats: MemoryStorage['cache']['statistics']) => MemoryStorage['cache']['statistics']
    ) =>
      Ref.update(storageRef, (storage) => ({
        ...storage,
        cache: {
          ...storage.cache,
          statistics: fn(storage.cache.statistics),
        },
      }))

    // === CRUD Operations ===

    const save = (generator: WorldGenerator): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const newGenerators = new Map(storage.generators)
        newGenerators.set(generator.worldId, generator)

        const summary = summarizeGenerators(newGenerators.values())
        const newPerformanceMetrics = new Map(storage.statistics.performanceMetrics)
        newPerformanceMetrics.set(generator.worldId, buildPerformanceMetric(generator))

        const lastGenerationTime =
          config.performance.enableMetrics && summary.totalChunks > storage.statistics.totalChunksGenerated
            ? yield* DateTime.nowAsDate
            : storage.statistics.lastGenerationTime

        yield* Ref.set(storageRef, {
          generators: newGenerators,
          statistics: {
            totalChunksGenerated: summary.totalChunks,
            lastGenerationTime,
            performanceMetrics: newPerformanceMetrics,
          },
          cache: storage.cache,
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to save world generator: ${error}`, 'save', error))
        )
      )

    const findById = (worldId: WorldId): Effect.Effect<Option.Option<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const generator = storage.generators.get(worldId)

        // Option.matchパターン: キャッシュヒット/ミス判定
        yield* Effect.when(config.cache.enabled, () =>
          pipe(
            Option.fromNullable(generator),
            Option.match({
              onNone: () => updateCacheStats((stats) => ({ ...stats, misses: stats.misses + 1 })),
              onSome: () => updateCacheStats((stats) => ({ ...stats, hits: stats.hits + 1 })),
            })
          )
        )

        return generator ? Option.some(generator) : Option.none()
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find world generator by ID: ${error}`, 'findById', error))
        )
      )

    const findBySeed = (seed: WorldSeed): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const generators = Array.from(storage.generators.values()).filter((generator) => generator.seed === seed)

        return generators
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find world generators by seed: ${error}`, 'findBySeed', error))
        )
      )

    const findBySettings = (
      settings: Partial<GenerationSettings>
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const generators = Array.from(storage.generators.values()).filter((generator) =>
          Object.entries(settings).every(([key, value]) => {
            const typedKey = key as keyof GenerationSettings
            const generatorValue = generator.settings[typedKey]
            return value === undefined || generatorValue === value
          })
        )

        return generators
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            createRepositoryError(`Failed to find world generators by settings: ${error}`, 'findBySettings', error)
          )
        )
      )

    const findByQuery = (
      query: WorldGeneratorQuery
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        let generators = Array.from(storage.generators.values())

        // Option.matchパターン: クエリフィルター適用
        generators = pipe(
          Option.fromNullable(query.worldId),
          Option.match({
            onNone: () => generators,
            onSome: (worldId) => generators.filter((g) => g.worldId === worldId),
          })
        )

        generators = pipe(
          Option.fromNullable(query.seed),
          Option.match({
            onNone: () => generators,
            onSome: (seed) => generators.filter((g) => g.seed === seed),
          })
        )

        generators = pipe(
          Option.fromNullable(query.settings),
          Option.match({
            onNone: () => generators,
            onSome: (settings) =>
              generators.filter((g) =>
                Object.entries(settings).every(([key, value]) => {
                  const typedKey = key as keyof GenerationSettings
                  const generatorValue = g.settings[typedKey]
                  return value === undefined || generatorValue === value
                })
              ),
          })
        )

        generators = pipe(
          Option.fromNullable(query.active),
          Option.match({
            onNone: () => generators,
            onSome: (active) => generators.filter((g) => isGeneratorActive(g) === active),
          })
        )

        // Apply pagination
        const offset = query.offset ?? 0
        const limit = query.limit ?? generators.length

        return generators.slice(offset, offset + limit)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find world generators by query: ${error}`, 'findByQuery', error))
        )
      )

    const findAll = (
      limit?: number,
      offset?: number
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const generators = Array.from(storage.generators.values())
        const startIndex = offset ?? 0
        const endIndex = limit ? startIndex + limit : generators.length

        return generators.slice(startIndex, endIndex)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to find all world generators: ${error}`, 'findAll', error))
        )
      )

    const deleteGenerator = (worldId: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)

        // Option.matchパターン: 存在チェック
        yield* pipe(
          Option.fromNullable(storage.generators.get(worldId)),
          Option.match({
            onNone: () => Effect.fail(createWorldGeneratorNotFoundError(worldId)),
            onSome: () => Effect.void,
          })
        )

        const newGenerators = new Map(storage.generators)
        newGenerators.delete(worldId)

        const newPerformanceMetrics = new Map(storage.statistics.performanceMetrics)
        newPerformanceMetrics.delete(worldId)

        const summary = summarizeGenerators(newGenerators.values())

        yield* Ref.set(storageRef, {
          generators: newGenerators,
          statistics: {
            totalChunksGenerated: summary.totalChunks,
            lastGenerationTime: storage.statistics.lastGenerationTime,
            performanceMetrics: newPerformanceMetrics,
          },
          cache: storage.cache,
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to delete world generator: ${error}`, 'delete', error))
        )
      )

    const exists = (worldId: WorldId): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        return storage.generators.has(worldId)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to check world generator existence: ${error}`, 'exists', error))
        )
      )

    // === Batch Operations ===

    const saveMany = (
      generators: ReadonlyArray<WorldGenerator>
    ): Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          generators,
          (generator) => Effect.either(save(generator)).pipe(Effect.map((result) => ({ generator, result }))),
          { concurrency: Math.min(generators.length, 4) }
        )

        const aggregated = pipe(
          results,
          ReadonlyArray.reduce(
            {
              successful: [] as ReadonlyArray<WorldId>,
              failed: [] as ReadonlyArray<{ worldId: WorldId; error: AllRepositoryErrors }>,
            },
            (acc, { generator, result }) =>
              result._tag === 'Right'
                ? {
                    ...acc,
                    successful: pipe(acc.successful, ReadonlyArray.append(generator.worldId)),
                  }
                : {
                    ...acc,
                    failed: pipe(
                      acc.failed,
                      ReadonlyArray.append({ worldId: generator.worldId, error: result.left })
                    ),
                  }
          )
        )

        return {
          successful: aggregated.successful,
          failed: aggregated.failed,
          totalProcessed: generators.length,
        }
      })

    const deleteMany = (
      worldIds: ReadonlyArray<WorldId>
    ): Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          worldIds,
          (worldId) => Effect.either(deleteGenerator(worldId)).pipe(Effect.map((result) => ({ worldId, result }))),
          { concurrency: Math.min(worldIds.length, 4) }
        )

        const aggregated = pipe(
          results,
          ReadonlyArray.reduce(
            {
              successful: [] as ReadonlyArray<WorldId>,
              failed: [] as ReadonlyArray<{ worldId: WorldId; error: AllRepositoryErrors }>,
            },
            (acc, { worldId, result }) =>
              result._tag === 'Right'
                ? {
                    ...acc,
                    successful: pipe(acc.successful, ReadonlyArray.append(worldId)),
                  }
                : {
                    ...acc,
                    failed: pipe(acc.failed, ReadonlyArray.append({ worldId, error: result.left })),
                  }
          )
        )

        return {
          successful: aggregated.successful,
          failed: aggregated.failed,
          totalProcessed: worldIds.length,
        }
      })

    const findManyByIds = (
      worldIds: ReadonlyArray<WorldId>
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const generators = worldIds
          .map((id) => storage.generators.get(id))
          .filter((generator): generator is WorldGenerator => generator !== undefined)

        return generators
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            createRepositoryError(`Failed to find multiple world generators: ${error}`, 'findManyByIds', error)
          )
        )
      )

    // === Statistics & Monitoring ===

    const getStatistics = (): Effect.Effect<WorldGeneratorStatistics, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const generators = Array.from(storage.generators.values())
        const summary = summarizeGenerators(generators.values())

        const cacheStats = storage.cache.statistics
        const cacheTotal = cacheStats.hits + cacheStats.misses
        const cacheHitRate = cacheTotal > 0 ? cacheStats.hits / cacheTotal : 0
        const totalAttempts = summary.totalChunks + summary.failureCount
        const errorRate = totalAttempts > 0 ? summary.failureCount / totalAttempts : 0
        const averageChunkGenerationTime = summary.totalChunks > 0 ? summary.totalTime / summary.totalChunks : 0

        return {
          totalGenerators: generators.length,
          activeGenerators: summary.activeCount,
          inactiveGenerators: generators.length - summary.activeCount,
          averageChunkGenerationTime,
          totalChunksGenerated: summary.totalChunks,
          lastGenerationTime: storage.statistics.lastGenerationTime,
          performanceMetrics: {
            averageGenerationTimeMs: averageChunkGenerationTime,
            peakMemoryUsageMB: summary.memoryBytes / (1024 * 1024),
            cacheHitRate,
            errorRate,
          } satisfies PerformanceMetrics,
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to get statistics: ${error}`, 'getStatistics', error))
        )
      )

    const count = (query?: Partial<WorldGeneratorQuery>): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Option.matchパターン: クエリの有無による分岐
        return yield* pipe(
          Option.fromNullable(query),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const storage = yield* Ref.get(storageRef)
                return storage.generators.size
              }),
            onSome: (q) =>
              Effect.gen(function* () {
                const generators = yield* findByQuery(q)
                return generators.length
              }),
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to count world generators: ${error}`, 'count', error))
        )
      )

    // === Cache Management (Mock implementations for memory) ===

    const updateCacheConfiguration = (cacheConfig: CacheConfiguration): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.update(storageRef, (storage) => ({
          ...storage,
          cache: {
            ...storage.cache,
            configuration: cacheConfig,
          },
        }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            createRepositoryError(`Failed to update cache configuration: ${error}`, 'updateCacheConfiguration', error)
          )
        )
      )

    const clearCache = (worldId?: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // For memory implementation, this is essentially a no-op
        // as the data is already in memory
        yield* updateCacheStats((stats) => ({
          hits: 0,
          misses: 0,
          evictions: stats.evictions,
        }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to clear cache: ${error}`, 'clearCache', error))
        )
      )

    const getCacheStatistics = (): Effect.Effect<
      {
        readonly hitRate: number
        readonly missRate: number
        readonly size: number
        readonly maxSize: number
        readonly evictionCount: number
      },
      AllRepositoryErrors
    > =>
      Effect.gen(function* () {
        const storage = yield* Ref.get(storageRef)
        const { hits, misses, evictions } = storage.cache.statistics
        const total = hits + misses

        return {
          hitRate: total > 0 ? hits / total : 0,
          missRate: total > 0 ? misses / total : 0,
          size: storage.generators.size,
          maxSize: storage.cache.configuration.maxSize,
          evictionCount: evictions,
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`Failed to get cache statistics: ${error}`, 'getCacheStatistics', error))
        )
      )

    // === Simplified implementations for other methods ===

    const getLastGenerationTime = (worldId: WorldId): Effect.Effect<Option.Option<Date>, AllRepositoryErrors> =>
      Effect.succeed(Option.fromNullable(null)) // Mock implementation

    const getPerformanceMetrics = (
      worldId: WorldId
    ): Effect.Effect<Option.Option<PerformanceMetrics>, AllRepositoryErrors> => Effect.succeed(Option.none()) // Mock implementation

    const warmupCache = (worldIds: ReadonlyArray<WorldId>): Effect.Effect<void, AllRepositoryErrors> => Effect.void // Mock implementation

    const createBackup = (worldId?: WorldId): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        return `backup-${timestamp}`
      })

    const restoreFromBackup = (backupId: string, worldId?: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.void // Mock implementation

    const listBackups = (): Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly worldId: WorldId | null
        readonly createdAt: Date
        readonly size: number
      }>,
      AllRepositoryErrors
    > => Effect.succeed([]) // Mock implementation

    const cleanupOldBackups = (keepCount?: number): Effect.Effect<number, AllRepositoryErrors> => Effect.succeed(0) // Mock implementation

    const validateIntegrity = (): Effect.Effect<
      {
        readonly isValid: boolean
        readonly errors: ReadonlyArray<string>
        readonly warnings: ReadonlyArray<string>
      },
      AllRepositoryErrors
    > =>
      Effect.succeed({
        isValid: true,
        errors: [],
        warnings: [],
      }) // Mock implementation

    const optimize = (): Effect.Effect<
      {
        readonly beforeSize: number
        readonly afterSize: number
        readonly optimizationTime: number
      },
      AllRepositoryErrors
    > =>
      Effect.succeed({
        beforeSize: 0,
        afterSize: 0,
        optimizationTime: 0,
      }) // Mock implementation

    const initialize = (): Effect.Effect<void, AllRepositoryErrors> => Effect.void

    const cleanup = (): Effect.Effect<void, AllRepositoryErrors> => Effect.void

    return {
      save,
      findById,
      findBySeed,
      findBySettings,
      findByQuery,
      findAll,
      delete: deleteGenerator,
      deleteMany,
      exists,
      saveMany,
      findManyByIds,
      getStatistics,
      count,
      getLastGenerationTime,
      getPerformanceMetrics,
      updateCacheConfiguration,
      clearCache,
      getCacheStatistics,
      warmupCache,
      createBackup,
      restoreFromBackup,
      listBackups,
      cleanupOldBackups,
      validateIntegrity,
      optimize,
      initialize,
      cleanup,
    }
  })

const estimateGeneratorMemoryBytes = (generator: WorldGenerator): number =>
  pipe(
    Either.try({
      try: () =>
        Buffer.byteLength(
          JSON.stringify({
            context: generator.context,
            statistics: generator.state.statistics,
          })
        ),
      catch: () => 0,
    }),
    Either.getOrElse((fallback) => fallback)
  )

const buildPerformanceMetric = (generator: WorldGenerator): PerformanceMetrics => {
  const stats = generator.state.statistics
  const attempts = stats.totalChunksGenerated + stats.failureCount
  return {
    averageGenerationTimeMs: stats.averageGenerationTime,
    peakMemoryUsageMB: estimateGeneratorMemoryBytes(generator) / (1024 * 1024),
    cacheHitRate: 0,
    errorRate: attempts > 0 ? stats.failureCount / attempts : 0,
  }
}

const hasIsActiveFlag = (candidate: WorldGenerator): candidate is WorldGenerator & { readonly isActive: boolean } =>
  Object.prototype.hasOwnProperty.call(candidate, 'isActive') &&
  typeof (candidate as { isActive: boolean }).isActive === 'boolean'

const isGeneratorActive = (generator: WorldGenerator): boolean =>
  hasIsActiveFlag(generator) ? generator.isActive : generator.state.status !== 'idle'

const summarizeGenerators = (generators: Iterable<WorldGenerator>) =>
  pipe(
    ReadonlyArray.fromIterable(generators),
    ReadonlyArray.reduce(
      {
        totalChunks: 0,
        totalTime: 0,
        failureCount: 0,
        activeCount: 0,
        memoryBytes: 0,
      },
      (acc, generator) => {
        const stats = generator.state.statistics
        return {
          totalChunks: acc.totalChunks + stats.totalChunksGenerated,
          totalTime: acc.totalTime + stats.totalGenerationTime,
          failureCount: acc.failureCount + stats.failureCount,
          activeCount: acc.activeCount + (isGeneratorActive(generator) ? 1 : 0),
          memoryBytes: acc.memoryBytes + estimateGeneratorMemoryBytes(generator),
        }
      }
    )
  )

// === Layer Creation ===

/**
 * World Generator Repository Memory Implementation Layer
 */
export const WorldGeneratorRepositoryMemory = Layer.effect(
  WorldGeneratorRepository,
  makeWorldGeneratorRepositoryMemory()
)

/**
 * Configurable World Generator Repository Memory Implementation Layer
 */
export const WorldGeneratorRepositoryMemoryWith = (config: WorldGeneratorRepositoryConfig) =>
  Layer.effect(WorldGeneratorRepository, makeWorldGeneratorRepositoryMemory(config))
