/**
 * @fileoverview World Generator Repository Persistence Implementation
 * ワールド生成器リポジトリの永続化実装
 *
 * ファイルシステムベースの永続化実装
 * JSON形式でのデータ保存・読み込み・バックアップ対応
 */

import {
  WorldGenerationAdapterService,
  type WorldGeneratorEncoded,
} from '@/domain/world_generation/adapter/world_generation_adapter'
import {
  createDataIntegrityError,
  createPersistenceError,
  createWorldGeneratorNotFoundError,
  WorldIdSchema,
  type AllRepositoryErrors,
  type GenerationSettings,
  type PerformanceMetrics,
  type WorldGenerator,
  type WorldId,
  type WorldSeed,
} from '@domain/world/types'
import { WorldGeneratorSchema as AggregateWorldGeneratorSchema } from '@domain/world_generation/aggregate/world_generator'
import {
  CacheConfiguration,
  WorldGeneratorBatchResult,
  WorldGeneratorQuery,
  WorldGeneratorRepository,
  WorldGeneratorRepositoryConfig,
  WorldGeneratorStatistics,
} from '@domain/world_generation/repository/world_generator_repository'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import { Clock, DateTime, Effect, Either, Layer, Option, pipe, ReadonlyArray, Ref, Schema } from 'effect'
import { Buffer } from 'node:buffer'

// === Persistence Storage Schema ===

const RepositoryPerformanceMetricsSchema = Schema.Struct({
  averageGenerationTimeMs: Schema.Number.pipe(Schema.nonNegative()),
  peakMemoryUsageMB: Schema.Number.pipe(Schema.nonNegative()),
  cacheHitRate: Schema.Number.pipe(Schema.between(0, 1)),
  errorRate: Schema.Number.pipe(Schema.between(0, 1)),
})

type RepositoryPerformanceMetrics = typeof RepositoryPerformanceMetricsSchema.Type

const WorldGeneratorPersistenceSchema = AggregateWorldGeneratorSchema.pipe(
  Schema.extend(
    Schema.Struct({
      worldId: WorldIdSchema,
    })
  )
)

const PersistenceDataSchema = Schema.Struct({
  generators: Schema.Record(Schema.String, WorldGeneratorPersistenceSchema),
  metadata: Schema.Struct({
    version: Schema.String,
    createdAt: Schema.String,
    lastModified: Schema.String,
    checksum: Schema.String,
  }),
  statistics: Schema.Struct({
    totalChunksGenerated: Schema.Number,
    lastGenerationTime: Schema.Union(Schema.String, Schema.Null),
    performanceMetrics: Schema.Record(Schema.String, RepositoryPerformanceMetricsSchema),
  }),
})

type PersistenceData = typeof PersistenceDataSchema.Type

// === Backup Schema ===

const BackupMetadataSchema = Schema.Struct({
  id: Schema.String,
  worldId: Schema.Union(Schema.String, Schema.Null),
  createdAt: Schema.String,
  size: Schema.Number,
  checksum: Schema.String,
  compressionLevel: Schema.Number,
})

type BackupMetadata = typeof BackupMetadataSchema.Type

// === Persistence Configuration ===

interface PersistenceConfig extends WorldGeneratorRepositoryConfig {
  readonly dataDirectory: string
  readonly backupDirectory: string
  readonly enableCompression: boolean
  readonly enableChecksums: boolean
  readonly autoBackup: boolean
}

const defaultPersistenceConfig: PersistenceConfig = {
  storage: { type: 'filesystem', location: './data/world-generators' },
  cache: {
    enabled: true,
    maxSize: 1000,
    ttlSeconds: 3600,
    strategy: 'lru',
    compressionEnabled: false,
  },
  backup: {
    enabled: true,
    intervalMinutes: 60,
    maxBackups: 10,
    compressionLevel: 6,
    encryptionEnabled: false,
  },
  performance: {
    enableMetrics: true,
    enableProfiling: false,
    batchSize: 100,
  },
  dataDirectory: './data/world-generators',
  backupDirectory: './data/backups/world-generators',
  enableCompression: true,
  enableChecksums: true,
  autoBackup: true,
}

// === Utility Functions ===

const calculateChecksum = (data: string): string => {
  // Simple checksum calculation (in production, use proper hash functions)
  const hash = pipe(
    data.split(''),
    ReadonlyArray.reduce(0, (hash, char) => {
      const charCode = char.charCodeAt(0)
      const newHash = (hash << 5) - hash + charCode
      return newHash & newHash // Convert to 32-bit integer
    })
  )
  return hash.toString(16)
}

const compressData = (data: string, level: number): Effect.Effect<string, AllRepositoryErrors> =>
  Effect.gen(function* () {
    // Mock compression implementation
    // In production, use zlib or similar
    return data
  })

const decompressData = (data: string): Effect.Effect<string, AllRepositoryErrors> =>
  Effect.gen(function* () {
    // Mock decompression implementation
    return data
  })

// === Persistence Implementation ===

const makeWorldGeneratorRepositoryPersistence = (
  config: PersistenceConfig = defaultPersistenceConfig
): Effect.Effect<WorldGeneratorRepository, AllRepositoryErrors, NodeFileSystem.FileSystem | NodePath.Path> =>
  Effect.gen(function* () {
    const fs = yield* NodeFileSystem.FileSystem
    const path = yield* NodePath.Path
    const adapter = yield* WorldGenerationAdapterService

    // Helper to encode generators for persistence
    const encodeGeneratorsForPersistence = (
      generators: Record<string, WorldGenerator>
    ): Effect.Effect<Record<string, WorldGeneratorEncoded>, Schema.ParseError> =>
      pipe(
        Object.entries(generators),
        Effect.forEach(
          ([id, generator]) =>
            pipe(
              adapter.encodeWorldGenerator(generator),
              Effect.map((encoded) => [id, encoded] as const)
            ),
          { concurrency: 4 }
        ),
        Effect.map((entries) => Object.fromEntries(entries))
      )

    // Initialize storage directories
    const dataPath = path.resolve(config.dataDirectory)
    const backupPath = path.resolve(config.backupDirectory)
    const dataFile = path.join(dataPath, 'generators.json')
    const metadataFile = path.join(dataPath, 'metadata.json')

    // In-memory cache for performance
    const cacheRef = yield* Ref.make<Map<WorldId, WorldGenerator>>(new Map())
    const statisticsRef = yield* Ref.make({
      totalChunksGenerated: 0,
      lastGenerationTime: null,
      performanceMetrics: new Map<WorldId, PerformanceMetrics>(),
    })

    // === File Operations ===

    const ensureDirectoryExists = (dirPath: string): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(dirPath)
        // Effect.whenパターン: ディレクトリが存在しない場合のみ作成
        yield* Effect.when(!exists, () => fs.makeDirectory(dirPath, { recursive: true }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to create directory: ${dirPath}`, 'filesystem', error))
        )
      )

    const loadDataFromFile = (): Effect.Effect<PersistenceData, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(dataFile)

        // Option.matchパターン: ファイル存在チェック（早期return）
        return yield* pipe(
          Option.fromNullable(exists ? true : null),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const now = yield* DateTime.nowAsDate
                return {
                  generators: {},
                  metadata: {
                    version: '1.0.0',
                    createdAt: now.toISOString(),
                    lastModified: now.toISOString(),
                    checksum: '',
                  },
                  statistics: {
                    totalChunksGenerated: 0,
                    lastGenerationTime: null,
                    performanceMetrics: {},
                  },
                }
              }),
            onSome: () =>
              Effect.gen(function* () {
                const content = yield* fs.readFileString(dataFile)

                // Effect.whenパターン: チェックサム検証
                yield* Effect.when(config.enableChecksums, () =>
                  Effect.gen(function* () {
                    const metadataExists = yield* fs.exists(metadataFile)
                    yield* Effect.when(metadataExists, () =>
                      Effect.gen(function* () {
                        const metadataContent = yield* fs.readFileString(metadataFile)
                        // パターンB: Effect.try + JSON.parse
                        const metadata = yield* Effect.try({
                          try: () => JSON.parse(metadataContent),
                          catch: (error) =>
                            createDataIntegrityError(
                              `Metadata JSON parse failed: ${String(error)}`,
                              ['metadata'],
                              metadataContent,
                              error
                            ),
                        })
                        const actualChecksum = calculateChecksum(content)

                        yield* pipe(
                          Option.fromNullable(metadata.checksum === actualChecksum ? true : null),
                          Option.match({
                            onNone: () =>
                              Effect.fail(
                                createDataIntegrityError(
                                  'Data checksum mismatch - file may be corrupted',
                                  ['checksum'],
                                  metadata.checksum,
                                  actualChecksum
                                )
                              ),
                            onSome: () => Effect.void,
                          })
                        )
                      })
                    )
                  })
                )

                // Pattern B: Effect.try + Effect.flatMap + Schema.decodeUnknown
                const validated = yield* Effect.try({
                  try: () => JSON.parse(content),
                  catch: (error) =>
                    new Error(
                      `Failed to parse generator data JSON: ${error instanceof Error ? error.message : String(error)}`
                    ),
                }).pipe(
                  Effect.flatMap(Schema.decodeUnknown(PersistenceDataSchema)),
                  Effect.mapError((error) => ({
                    _tag: 'SchemaValidationError' as const,
                    message: `PersistenceDataSchema validation failed: ${error}`,
                    context: 'loadDataFromFile',
                    cause: error,
                  }))
                )

                return validated
              }),
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to load data from file: ${error}`, 'filesystem', error))
        )
      )

    const saveDataToFile = (data: PersistenceData): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(dataPath)

        const encodedGenerators = yield* encodeGeneratorsForPersistence(data.generators)
        const contentPayload = {
          ...data,
          generators: encodedGenerators,
        }
        const content = JSON.stringify(contentPayload, null, 2)

        // Effect.whenパターン: チェックサム計算・保存
        yield* Effect.when(config.enableChecksums, () =>
          Effect.gen(function* () {
            const now = yield* DateTime.nowAsDate
            const checksum = calculateChecksum(content)
            const metadata = {
              ...data.metadata,
              checksum,
              lastModified: now.toISOString(),
            }

            yield* fs.writeFileString(metadataFile, JSON.stringify(metadata, null, 2))
          })
        )

        // Option.matchパターン: 圧縮有効化判定
        const finalContent = yield* pipe(
          Option.fromNullable(config.enableCompression ? true : null),
          Option.match({
            onNone: () => Effect.succeed(content),
            onSome: () => compressData(content, config.backup.compressionLevel),
          })
        )

        yield* fs.writeFileString(dataFile, finalContent)

        // Effect.whenパターン: 自動バックアップ
        yield* Effect.when(config.autoBackup && config.backup.enabled, () => createBackupInternal(data))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to save data to file: ${error}`, 'filesystem', error))
        )
      )

    const createBackupInternal = (data: PersistenceData): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(backupPath)

        const timestamp = yield* Clock.currentTimeMillis
        const now = yield* DateTime.nowAsDate
        const backupId = `backup-${timestamp}`
        const backupFile = path.join(backupPath, `${backupId}.json`)
        const encodedGenerators = yield* encodeGeneratorsForPersistence(data.generators)
        const content = JSON.stringify(
          {
            ...data,
            generators: encodedGenerators,
          },
          null,
          2
        )

        const compressedContent = yield* compressData(content, config.backup.compressionLevel)
        yield* fs.writeFileString(backupFile, compressedContent)

        // Save backup metadata
        const metadata: BackupMetadata = {
          id: backupId,
          worldId: null, // Full backup
          createdAt: now.toISOString(),
          size: compressedContent.length,
          checksum: calculateChecksum(compressedContent),
          compressionLevel: config.backup.compressionLevel,
        }

        const metadataFile = path.join(backupPath, `${backupId}.meta.json`)
        yield* fs.writeFileString(metadataFile, JSON.stringify(metadata, null, 2))

        return backupId
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to create backup: ${error}`, 'filesystem', error))
        )
      )

    // === Repository Operations ===

    const save = (generator: WorldGenerator): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Update cache
        yield* Ref.update(cacheRef, (cache) => new Map(cache).set(generator.worldId, generator))

        // Load current data
        const data = yield* loadDataFromFile()

        const now = yield* DateTime.nowAsDate

        const updatedGenerators = {
          ...data.generators,
          [generator.worldId]: generator,
        }

        const generatorsArray = Object.values(updatedGenerators)
        const summary = summarizeGenerators(generatorsArray)
        const metricsEntries = generatorsArray.map((gen) => [gen.worldId, buildPerformanceMetric(gen)] as const)
        const newMetrics = new Map<WorldId, PerformanceMetrics>(metricsEntries)
        const statsSnapshot = yield* Ref.get(statisticsRef)
        const lastGenerationTime =
          config.performance.enableMetrics && summary.totalChunks > statsSnapshot.totalChunksGenerated
            ? now
            : statsSnapshot.lastGenerationTime

        const updatedData: PersistenceData = {
          ...data,
          generators: updatedGenerators,
          metadata: {
            ...data.metadata,
            lastModified: now.toISOString(),
          },
          statistics: {
            totalChunksGenerated: summary.totalChunks,
            lastGenerationTime: lastGenerationTime ? lastGenerationTime.toISOString() : null,
            performanceMetrics: Object.fromEntries(metricsEntries),
          },
        }

        // Save to file
        yield* saveDataToFile(updatedData)

        yield* Ref.set(statisticsRef, {
          totalChunksGenerated: summary.totalChunks,
          lastGenerationTime,
          performanceMetrics: newMetrics,
        })
      })

    const findById = (worldId: WorldId): Effect.Effect<Option.Option<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Option.matchパターン: キャッシュヒット判定（早期return）
        const cache = yield* Ref.get(cacheRef)
        const cached = cache.get(worldId)

        return yield* pipe(
          Option.fromNullable(cached),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                // Load from file
                const data = yield* loadDataFromFile()
                const generator = data.generators[worldId]

                return yield* pipe(
                  Option.fromNullable(generator),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none()),
                    onSome: (gen) =>
                      Effect.gen(function* () {
                        // Update cache
                        yield* Ref.update(cacheRef, (cache) => new Map(cache).set(worldId, gen))
                        return Option.some(gen)
                      }),
                  })
                )
              }),
            onSome: (cachedGen) => Effect.succeed(Option.some(cachedGen)),
          })
        )
      })

    const findAll = (
      limit?: number,
      offset?: number
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadDataFromFile()
        const generators = Object.values(data.generators)

        const startIndex = offset ?? 0
        const endIndex = limit ? startIndex + limit : generators.length

        return generators.slice(startIndex, endIndex)
      })

    const deleteGenerator = (worldId: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check if exists
        const data = yield* loadDataFromFile()

        // Option.matchパターン: 存在チェック（早期return）
        yield* pipe(
          Option.fromNullable(data.generators[worldId]),
          Option.match({
            onNone: () => Effect.fail(createWorldGeneratorNotFoundError(worldId)),
            onSome: () => Effect.void,
          })
        )

        // Remove from cache
        yield* Ref.update(cacheRef, (cache) => {
          const newCache = new Map(cache)
          newCache.delete(worldId)
          return newCache
        })

        // Update data
        const { [worldId]: removed, ...remainingGenerators } = data.generators
        const now = yield* DateTime.nowAsDate
        const generatorsArray = Object.values(remainingGenerators)
        const summary = summarizeGenerators(generatorsArray)
        const metricsEntries = generatorsArray.map((gen) => [gen.worldId, buildPerformanceMetric(gen)] as const)
        const newMetrics = new Map<WorldId, PerformanceMetrics>(metricsEntries)
        const statsSnapshot = yield* Ref.get(statisticsRef)

        const updatedData: PersistenceData = {
          ...data,
          generators: remainingGenerators,
          metadata: {
            ...data.metadata,
            lastModified: now.toISOString(),
          },
          statistics: {
            totalChunksGenerated: summary.totalChunks,
            lastGenerationTime: statsSnapshot.lastGenerationTime
              ? statsSnapshot.lastGenerationTime.toISOString()
              : null,
            performanceMetrics: Object.fromEntries(metricsEntries),
          },
        }

        yield* saveDataToFile(updatedData)

        yield* Ref.set(statisticsRef, {
          totalChunksGenerated: summary.totalChunks,
          lastGenerationTime: statsSnapshot.lastGenerationTime,
          performanceMetrics: newMetrics,
        })
      })

    const exists = (worldId: WorldId): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Option.matchパターン: キャッシュヒット判定（早期return）
        const cache = yield* Ref.get(cacheRef)

        return yield* pipe(
          Option.fromNullable(cache.has(worldId) ? true : null),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                // Check file
                const data = yield* loadDataFromFile()
                return worldId in data.generators
              }),
            onSome: () => Effect.succeed(true),
          })
        )
      })

    // === Simplified implementations for other required methods ===
    // (These would be fully implemented in a production system)

    const findBySeed = (seed: WorldSeed): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const all = yield* findAll()
        return all.filter((g) => g.seed === seed)
      })

    const findBySettings = (
      settings: Partial<GenerationSettings>
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const all = yield* findAll()
        return all.filter((g) =>
          Object.entries(settings).every(([key, value]) => {
            const typedKey = key as keyof GenerationSettings
            const generatorValue = g.settings[typedKey]
            return value === undefined || generatorValue === value
          })
        )
      })

    const findByQuery = (
      query: WorldGeneratorQuery
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        let generators = yield* findAll()

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
          Option.fromNullable(query.active),
          Option.match({
            onNone: () => generators,
            onSome: (active) => generators.filter((g) => isGeneratorActive(g) === active),
          })
        )

        const offset = query.offset ?? 0
        const limit = query.limit ?? generators.length
        return generators.slice(offset, offset + limit)
      })

    // Mock implementations for remaining methods
    const saveMany = (
      generators: ReadonlyArray<WorldGenerator>
    ): Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          generators,
          (generator) => Effect.either(save(generator)).pipe(Effect.map((result) => ({ generator, result }))),
          { concurrency: Math.min(generators.length, config.performance.batchSize ?? 4) }
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
                    failed: pipe(acc.failed, ReadonlyArray.append({ worldId: generator.worldId, error: result.left })),
                  }
          )
        )

        return {
          successful: aggregated.successful,
          failed: aggregated.failed,
          totalProcessed: generators.length,
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            createPersistenceError(`Failed to save multiple world generators: ${String(error)}`, 'filesystem', error)
          )
        )
      )

    const deleteMany = (
      worldIds: ReadonlyArray<WorldId>
    ): Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          worldIds,
          (worldId) => Effect.either(deleteGenerator(worldId)).pipe(Effect.map((result) => ({ worldId, result }))),
          { concurrency: Math.min(worldIds.length, config.performance.batchSize ?? 4) }
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
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            createPersistenceError(`Failed to delete multiple world generators: ${String(error)}`, 'filesystem', error)
          )
        )
      )

    const findManyByIds = (
      worldIds: ReadonlyArray<WorldId>
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      pipe(
        worldIds,
        Effect.forEach((id) =>
          pipe(
            findById(id),
            Effect.map((generator) => (Option.isSome(generator) ? Option.some(generator.value) : Option.none()))
          )
        ),
        Effect.map(ReadonlyArray.filterMap(identity))
      )

    // Statistics and monitoring mock implementations
    const getStatistics = (): Effect.Effect<WorldGeneratorStatistics, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const all = yield* findAll()
        const statsSnapshot = yield* Ref.get(statisticsRef)
        const summary = summarizeGenerators(all)

        const averageChunkGenerationTime = summary.totalChunks > 0 ? summary.totalTime / summary.totalChunks : 0
        const totalAttempts = summary.totalChunks + summary.failureCount
        const errorRate = totalAttempts > 0 ? summary.failureCount / totalAttempts : 0

        return {
          totalGenerators: all.length,
          activeGenerators: summary.activeCount,
          inactiveGenerators: all.length - summary.activeCount,
          averageChunkGenerationTime,
          totalChunksGenerated: summary.totalChunks,
          lastGenerationTime: statsSnapshot.lastGenerationTime,
          performanceMetrics: {
            averageGenerationTimeMs: averageChunkGenerationTime,
            peakMemoryUsageMB: summary.memoryBytes / (1024 * 1024),
            cacheHitRate: 0,
            errorRate,
          },
        }
      })

    const count = (query?: Partial<WorldGeneratorQuery>): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Option.matchパターン: クエリの有無による分岐
        return yield* pipe(
          Option.fromNullable(query),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const all = yield* findAll()
                return all.length
              }),
            onSome: (q) =>
              Effect.gen(function* () {
                const filtered = yield* findByQuery(q)
                return filtered.length
              }),
          })
        )
      })

    // Cache management implementations
    const updateCacheConfiguration = (cacheConfig: CacheConfiguration): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.void

    const clearCache = (worldId?: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Option.matchパターン: worldId指定の有無による分岐
        yield* pipe(
          Option.fromNullable(worldId),
          Option.match({
            onNone: () => Ref.set(cacheRef, new Map()),
            onSome: (id) =>
              Ref.update(cacheRef, (cache) => {
                const newCache = new Map(cache)
                newCache.delete(id)
                return newCache
              }),
          })
        )
      })

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
        const cache = yield* Ref.get(cacheRef)
        return {
          hitRate: 0.85, // Mock value
          missRate: 0.15, // Mock value
          size: cache.size,
          maxSize: config.cache.maxSize,
          evictionCount: 0,
        }
      })

    // Backup and recovery implementations
    const createBackup = (worldId?: WorldId): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadDataFromFile()
        return yield* createBackupInternal(data)
      })

    const restoreFromBackup = (backupId: string, worldId?: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const backupFile = path.join(backupPath, `${backupId}.json`)
        const content = yield* fs.readFileString(backupFile)
        const decompressed = yield* decompressData(content)
        // パターンB前半: Effect.try + JSON.parse（Schema検証は将来追加）
        const data = yield* Effect.try({
          try: () => JSON.parse(decompressed),
          catch: (error) =>
            createDataIntegrityError(`Backup JSON parse failed: ${String(error)}`, ['backupData'], decompressed, error),
        }).pipe(
          Effect.flatMap(Schema.decodeUnknown(PersistenceDataSchema)),
          Effect.mapError((error) =>
            createDataIntegrityError('Backup schema validation failed', ['backupData'], decompressed, error)
          )
        )

        yield* saveDataToFile(data)
        yield* Ref.set(cacheRef, new Map()) // Clear cache to force reload
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to restore from backup: ${error}`, 'filesystem', error))
        )
      )

    const listBackups = (): Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly worldId: WorldId | null
        readonly createdAt: Date
        readonly size: number
      }>,
      AllRepositoryErrors
    > => Effect.succeed([]) // Mock implementation

    // Mock implementations for remaining methods
    const getLastGenerationTime = (worldId: WorldId) => Effect.succeed(Option.none<Date>())
    const getPerformanceMetrics = (worldId: WorldId) => Effect.succeed(Option.none<PerformanceMetrics>())
    const warmupCache = (worldIds: ReadonlyArray<WorldId>) => Effect.void
    const cleanupOldBackups = (keepCount?: number) => Effect.succeed(0)
    const validateIntegrity = () => Effect.succeed({ isValid: true, errors: [], warnings: [] })
    const optimize = () => Effect.succeed({ beforeSize: 0, afterSize: 0, optimizationTime: 0 })

    const initialize = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(dataPath)
        yield* ensureDirectoryExists(backupPath)

        // Load initial data to cache
        const data = yield* loadDataFromFile()
        const generators = Object.entries(data.generators).map(([id, gen]) => [id, gen] as const)
        yield* Ref.set(cacheRef, new Map(generators))

        const generatorsArray = Object.values(data.generators)
        const summary = summarizeGenerators(generatorsArray)
        const metrics = pipe(
          generatorsArray,
          ReadonlyArray.reduce(new Map<WorldId, PerformanceMetrics>(), (acc, gen) => {
            acc.set(gen.worldId, buildPerformanceMetric(gen))
            return acc
          })
        )

        const lastGenerationTime = pipe(
          Option.fromNullable(data.statistics?.lastGenerationTime ?? null),
          Option.flatMap((value) => pipe(DateTime.make(value), Option.map(DateTime.toDate))),
          Option.getOrElse(() => null)
        )

        yield* Ref.set(statisticsRef, {
          totalChunksGenerated: summary.totalChunks,
          lastGenerationTime,
          performanceMetrics: metrics,
        })
      })

    const cleanup = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.set(cacheRef, new Map())
      })

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

const hasIsActiveFlag = (candidate: WorldGenerator): candidate is WorldGenerator & { readonly isActive: boolean } =>
  Object.prototype.hasOwnProperty.call(candidate, 'isActive') &&
  typeof (candidate as { isActive: boolean }).isActive === 'boolean'

const isGeneratorActive = (generator: WorldGenerator): boolean =>
  hasIsActiveFlag(generator) ? generator.isActive : generator.state.status !== 'idle'

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

const summarizeGenerators = (generators: ReadonlyArray<WorldGenerator>) =>
  pipe(
    generators,
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
 * World Generator Repository Persistence Implementation Layer
 */
export const WorldGeneratorRepositoryPersistence = Layer.effect(
  WorldGeneratorRepository,
  makeWorldGeneratorRepositoryPersistence()
)

/**
 * Configurable World Generator Repository Persistence Implementation Layer
 */
export const WorldGeneratorRepositoryPersistenceWith = (config: PersistenceConfig) =>
  Layer.effect(WorldGeneratorRepository, makeWorldGeneratorRepositoryPersistence(config))

export const WorldGeneratorRepositoryPersistenceLive = (config?: PersistenceConfig) =>
  config ? WorldGeneratorRepositoryPersistenceWith(config) : WorldGeneratorRepositoryPersistence
