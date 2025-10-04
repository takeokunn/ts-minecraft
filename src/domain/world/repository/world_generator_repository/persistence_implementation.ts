/**
 * @fileoverview World Generator Repository Persistence Implementation
 * ワールド生成器リポジトリの永続化実装
 *
 * ファイルシステムベースの永続化実装
 * JSON形式でのデータ保存・読み込み・バックアップ対応
 */

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import { Effect, Layer, Option, ReadonlyArray, Ref, Schema } from 'effect'
import type { GenerationSettings, PerformanceMetrics, WorldGenerator, WorldId, WorldSeed } from '../../types'
import type { AllRepositoryErrors } from '../types'
import { createDataIntegrityError, createPersistenceError, createWorldGeneratorNotFoundError } from '../types'
import type {
  CacheConfiguration,
  WorldGeneratorBatchResult,
  WorldGeneratorQuery,
  WorldGeneratorRepository,
  WorldGeneratorRepositoryConfig,
  WorldGeneratorStatistics,
} from './interface'

// === Persistence Storage Schema ===

const PersistenceDataSchema = Schema.Struct({
  generators: Schema.Record(Schema.String, Schema.Unknown), // WorldGenerator schema would go here
  metadata: Schema.Struct({
    version: Schema.String,
    createdAt: Schema.String,
    lastModified: Schema.String,
    checksum: Schema.String,
  }),
  statistics: Schema.Struct({
    totalChunksGenerated: Schema.Number,
    lastGenerationTime: Schema.Union(Schema.String, Schema.Null),
    performanceMetrics: Schema.Record(Schema.String, Schema.Unknown),
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
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
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

    // Initialize storage directories
    const dataPath = path.resolve(config.dataDirectory)
    const backupPath = path.resolve(config.backupDirectory)
    const dataFile = path.join(dataPath, 'generators.json')
    const metadataFile = path.join(dataPath, 'metadata.json')

    // In-memory cache for performance
    const cacheRef = yield* Ref.make<Map<WorldId, WorldGenerator>>(new Map())
    const statisticsRef = yield* Ref.make({
      totalChunksGenerated: 0,
      lastGenerationTime: null as Date | null,
      performanceMetrics: new Map<WorldId, PerformanceMetrics>(),
    })

    // === File Operations ===

    const ensureDirectoryExists = (dirPath: string): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(dirPath)
        if (!exists) {
          yield* fs.makeDirectory(dirPath, { recursive: true })
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to create directory: ${dirPath}`, 'filesystem', error))
        )
      )

    const loadDataFromFile = (): Effect.Effect<PersistenceData, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(dataFile)
        if (!exists) {
          return {
            generators: {},
            metadata: {
              version: '1.0.0',
              createdAt: new Date().toISOString(),
              lastModified: new Date().toISOString(),
              checksum: '',
            },
            statistics: {
              totalChunksGenerated: 0,
              lastGenerationTime: null,
              performanceMetrics: {},
            },
          }
        }

        const content = yield* fs.readFileString(dataFile)

        if (config.enableChecksums) {
          // Verify checksum if metadata exists
          const metadataExists = yield* fs.exists(metadataFile)
          if (metadataExists) {
            const metadataContent = yield* fs.readFileString(metadataFile)
            const metadata = JSON.parse(metadataContent)
            const actualChecksum = calculateChecksum(content)

            if (metadata.checksum !== actualChecksum) {
              return yield* Effect.fail(
                createDataIntegrityError(
                  'Data checksum mismatch - file may be corrupted',
                  ['checksum'],
                  metadata.checksum,
                  actualChecksum
                )
              )
            }
          }
        }

        const parsedData = JSON.parse(content)
        return Schema.decodeUnknownSync(PersistenceDataSchema)(parsedData)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to load data from file: ${error}`, 'filesystem', error))
        )
      )

    const saveDataToFile = (data: PersistenceData): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(dataPath)

        const content = JSON.stringify(data, null, 2)

        // Calculate and save checksum
        if (config.enableChecksums) {
          const checksum = calculateChecksum(content)
          const metadata = {
            ...data.metadata,
            checksum,
            lastModified: new Date().toISOString(),
          }

          yield* fs.writeFileString(metadataFile, JSON.stringify(metadata, null, 2))
        }

        // Compress if enabled
        const finalContent = config.enableCompression
          ? yield* compressData(content, config.backup.compressionLevel)
          : content

        yield* fs.writeFileString(dataFile, finalContent)

        // Auto backup if enabled
        if (config.autoBackup && config.backup.enabled) {
          yield* createBackupInternal(data)
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createPersistenceError(`Failed to save data to file: ${error}`, 'filesystem', error))
        )
      )

    const createBackupInternal = (data: PersistenceData): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* ensureDirectoryExists(backupPath)

        const backupId = `backup-${Date.now()}`
        const backupFile = path.join(backupPath, `${backupId}.json`)
        const content = JSON.stringify(data, null, 2)

        const compressedContent = yield* compressData(content, config.backup.compressionLevel)
        yield* fs.writeFileString(backupFile, compressedContent)

        // Save backup metadata
        const metadata: BackupMetadata = {
          id: backupId,
          worldId: null, // Full backup
          createdAt: new Date().toISOString(),
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

        // Update generators
        const updatedData: PersistenceData = {
          ...data,
          generators: {
            ...data.generators,
            [generator.worldId]: generator,
          },
          metadata: {
            ...data.metadata,
            lastModified: new Date().toISOString(),
          },
        }

        // Save to file
        yield* saveDataToFile(updatedData)
      })

    const findById = (worldId: WorldId): Effect.Effect<Option.Option<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check cache first
        const cache = yield* Ref.get(cacheRef)
        const cached = cache.get(worldId)
        if (cached) {
          return Option.some(cached)
        }

        // Load from file
        const data = yield* loadDataFromFile()
        const generator = data.generators[worldId] as WorldGenerator | undefined

        if (generator) {
          // Update cache
          yield* Ref.update(cacheRef, (cache) => new Map(cache).set(worldId, generator))
          return Option.some(generator)
        }

        return Option.none()
      })

    const findAll = (
      limit?: number,
      offset?: number
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const data = yield* loadDataFromFile()
        const generators = Object.values(data.generators) as WorldGenerator[]

        const startIndex = offset ?? 0
        const endIndex = limit ? startIndex + limit : generators.length

        return generators.slice(startIndex, endIndex)
      })

    const deleteGenerator = (worldId: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check if exists
        const data = yield* loadDataFromFile()
        if (!data.generators[worldId]) {
          return yield* Effect.fail(createWorldGeneratorNotFoundError(worldId))
        }

        // Remove from cache
        yield* Ref.update(cacheRef, (cache) => {
          const newCache = new Map(cache)
          newCache.delete(worldId)
          return newCache
        })

        // Update data
        const { [worldId]: removed, ...remainingGenerators } = data.generators
        const updatedData: PersistenceData = {
          ...data,
          generators: remainingGenerators,
          metadata: {
            ...data.metadata,
            lastModified: new Date().toISOString(),
          },
        }

        yield* saveDataToFile(updatedData)
      })

    const exists = (worldId: WorldId): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        // Check cache first
        const cache = yield* Ref.get(cacheRef)
        if (cache.has(worldId)) {
          return true
        }

        // Check file
        const data = yield* loadDataFromFile()
        return worldId in data.generators
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
        return all.filter((g) => Object.entries(settings).every(([key, value]) => (g.settings as any)[key] === value))
      })

    const findByQuery = (
      query: WorldGeneratorQuery
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        let generators = yield* findAll()

        if (query.worldId) generators = generators.filter((g) => g.worldId === query.worldId)
        if (query.seed) generators = generators.filter((g) => g.seed === query.seed)
        if (query.active !== undefined) generators = generators.filter((g) => g.isActive === query.active)

        const offset = query.offset ?? 0
        const limit = query.limit ?? generators.length
        return generators.slice(offset, offset + limit)
      })

    // Mock implementations for remaining methods
    const saveMany = (
      generators: ReadonlyArray<WorldGenerator>
    ): Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors> =>
      Effect.succeed({
        successful: generators.map((g) => g.worldId),
        failed: [],
        totalProcessed: generators.length,
      })

    const deleteMany = (
      worldIds: ReadonlyArray<WorldId>
    ): Effect.Effect<WorldGeneratorBatchResult, AllRepositoryErrors> =>
      Effect.succeed({
        successful: [...worldIds],
        failed: [],
        totalProcessed: worldIds.length,
      })

    const findManyByIds = (
      worldIds: ReadonlyArray<WorldId>
    ): Effect.Effect<ReadonlyArray<WorldGenerator>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const results: WorldGenerator[] = []
        for (const id of worldIds) {
          const generator = yield* findById(id)
          if (Option.isSome(generator)) {
            results.push(generator.value)
          }
        }
        return results
      })

    // Statistics and monitoring mock implementations
    const getStatistics = (): Effect.Effect<WorldGeneratorStatistics, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const all = yield* findAll()
        const stats = yield* Ref.get(statisticsRef)

        return {
          totalGenerators: all.length,
          activeGenerators: all.filter((g) => g.isActive).length,
          inactiveGenerators: all.filter((g) => !g.isActive).length,
          averageChunkGenerationTime: 0,
          totalChunksGenerated: stats.totalChunksGenerated,
          lastGenerationTime: stats.lastGenerationTime,
          performanceMetrics: {} as PerformanceMetrics,
        }
      })

    const count = (query?: Partial<WorldGeneratorQuery>): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        if (!query) {
          const all = yield* findAll()
          return all.length
        }
        const filtered = yield* findByQuery(query as WorldGeneratorQuery)
        return filtered.length
      })

    // Cache management implementations
    const updateCacheConfiguration = (cacheConfig: CacheConfiguration): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.void

    const clearCache = (worldId?: WorldId): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        if (worldId) {
          yield* Ref.update(cacheRef, (cache) => {
            const newCache = new Map(cache)
            newCache.delete(worldId)
            return newCache
          })
        } else {
          yield* Ref.set(cacheRef, new Map())
        }
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
        const data = JSON.parse(decompressed) as PersistenceData

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
        const generators = Object.entries(data.generators).map(([id, gen]) => [id, gen as WorldGenerator] as const)
        yield* Ref.set(cacheRef, new Map(generators))
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
