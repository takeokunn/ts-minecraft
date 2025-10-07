/**
 * @fileoverview World Metadata Repository - Persistence Implementation
 * ワールドメタデータリポジトリの永続化実装
 *
 * ファイルシステムベース・圧縮・暗号化対応
 * 高度なバックアップとバージョン管理
 */

import { WorldGeneratorIdSchema } from '@/domain/world_generation/aggregate/world_generator'
import type { AllRepositoryErrors, WorldId } from '@domain/world/types'
import {
  createCompressionError,
  createDataIntegrityError,
  createRepositoryError,
  createStorageError,
  createVersioningError,
} from '@domain/world/types'
import { WorldCoordinateSchema, WorldIdSchema, WorldSeedSchema } from '@domain/world/types/core'
import * as Schema from '@effect/schema/Schema'
import * as crypto from 'crypto'
import { DateTime, Effect, Layer, Match, Option, pipe, ReadonlyArray, Ref } from 'effect'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { WorldClock } from '../..'
import type {
  BackupConfig,
  BackupInfo,
  calculateMetadataChecksum,
  CompressionConfig,
  CompressionStatistics,
  estimateMetadataSize,
  generateVersionString,
  MetadataChange,
  MetadataQuery,
  MetadataVersion,
  WorldMetadata,
  WorldMetadataRepository,
  WorldMetadataRepositoryConfig,
  WorldSettings,
  WorldStatistics,
} from './index'

// === Persistence Configuration ===

interface PersistenceConfig {
  readonly dataPath: string
  readonly enableCompression: boolean
  readonly enableEncryption: boolean
  readonly encryptionKey?: string
  readonly backupPath: string
  readonly versionPath: string
  readonly indexPath: string
  readonly flushIntervalMs: number
  readonly autoBackupEnabled: boolean
}

// === Storage Schema ===

// === Implementation ===

export const WorldMetadataRepositoryPersistenceImplementation = (
  config: WorldMetadataRepositoryConfig,
  persistenceConfig: PersistenceConfig = {
    dataPath: './data/world_metadata',
    enableCompression: true,
    enableEncryption: false,
    backupPath: './data/backups',
    versionPath: './data/versions',
    indexPath: './data/indexes',
    flushIntervalMs: 30000,
    autoBackupEnabled: true,
  }
): Effect.Effect<WorldMetadataRepository, AllRepositoryErrors> =>
  Effect.gen(function* () {
    // State references
    const metadataStore = yield* Ref.make(new Map<WorldId, WorldMetadata>())
    const versionStore = yield* Ref.make(new Map<WorldId, Map<string, MetadataVersion>>())
    const compressionStore = yield* Ref.make(new Map<WorldId, CompressionStatistics>())
    const backupStore = yield* Ref.make(new Map<string, BackupInfo>())
    const indexStore = yield* Ref.make(new Map<string, ReadonlyArray<WorldId>>()) // Index field -> WorldIds

    // Cache references
    const metadataCache = yield* Ref.make(new Map<WorldId, { metadata: WorldMetadata; timestamp: number }>())
    const cacheStats = yield* Ref.make({
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
    })
    const versionSequence = yield* Ref.make(0)

    const ttlMilliseconds = config.cache.ttlSeconds * 1000

    const currentMillis = Effect.flatMap(Effect.service(WorldClock), (clock) => clock.currentMillis)
    const currentDate = Effect.flatMap(Effect.service(WorldClock), (clock) => clock.currentDate)

    const isCacheExpired = (now: number, timestamp: number): boolean => now - timestamp > ttlMilliseconds

    const updateChecksum = (metadata: WorldMetadata): Effect.Effect<WorldMetadata> =>
      Effect.map(currentDate, (now) => ({
        ...metadata,
        checksum: calculateMetadataChecksum(metadata),
        lastModified: now,
      }))

    const nextVersionId = () =>
      Effect.gen(function* () {
        const millis = yield* currentMillis
        const sequence = yield* Ref.modify(versionSequence, (current) => [current, current + 1])
        return generateVersionString(millis, sequence)
      })

    const checksumFromString = (input: string): string => {
      const hash = pipe(
        input,
        ReadonlyArray.fromIterable,
        ReadonlyArray.reduce(0, (hash, char) => {
          const newHash = (hash << 5) - hash + char.charCodeAt(0)
          return newHash | 0
        })
      )
      return hash.toString(16)
    }

    const MetadataChangePersistenceSchema = Schema.Struct({
      type: Schema.Literal('create', 'update', 'delete'),
      path: Schema.String,
      oldValue: Schema.optional(Schema.Unknown),
      newValue: Schema.optional(Schema.Unknown),
      timestamp: Schema.DateFromString,
      reason: Schema.optional(Schema.String),
    })

    const SpawnLocationPersistenceSchema = Schema.Struct({
      playerId: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })

    const WorldSettingsPersistenceSchema = Schema.Struct({
      gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator'),
      difficulty: Schema.Literal('peaceful', 'easy', 'normal', 'hard'),
      worldType: Schema.Literal('default', 'superflat', 'amplified', 'customized'),
      generateStructures: Schema.Boolean,
      generateBonusChest: Schema.Boolean,
      allowCheats: Schema.Boolean,
      hardcore: Schema.Boolean,
      pvp: Schema.Boolean,
      spawnProtection: Schema.Number,
      worldBorder: Schema.Struct({
        centerX: WorldCoordinateSchema,
        centerZ: WorldCoordinateSchema,
        size: Schema.Number,
        warningBlocks: Schema.Number,
        warningTime: Schema.Number,
        damageAmount: Schema.Number,
        damageBuffer: Schema.Number,
      }),
      gameRules: Schema.Record(Schema.String, Schema.Union(Schema.Boolean, Schema.Number, Schema.String)),
      dataPackSettings: Schema.Struct({
        enabled: Schema.Array(Schema.String),
        disabled: Schema.Array(Schema.String),
        available: Schema.Array(Schema.String),
      }),
    })

    const WorldStatisticsPersistenceSchema = Schema.Struct({
      size: Schema.Struct({
        totalChunks: Schema.Number,
        loadedChunks: Schema.Number,
        generatedChunks: Schema.Number,
        compressedSize: Schema.Number,
        uncompressedSize: Schema.Number,
      }),
      performance: Schema.Struct({
        averageGenerationTime: Schema.Number,
        averageLoadTime: Schema.Number,
        totalGenerationTime: Schema.Number,
        cacheHitRate: Schema.Number,
        compressionRatio: Schema.Number,
      }),
      content: Schema.Struct({
        biomeCount: Schema.Record(Schema.String, Schema.Number),
        structureCount: Schema.Record(Schema.String, Schema.Number),
        entityCount: Schema.Record(Schema.String, Schema.Number),
        tileEntityCount: Schema.Record(Schema.String, Schema.Number),
      }),
      player: Schema.Struct({
        playerCount: Schema.Number,
        totalPlayTime: Schema.Number,
        lastPlayerActivity: Schema.DateFromString,
        spawnLocations: Schema.Array(SpawnLocationPersistenceSchema),
      }),
      lastUpdated: Schema.DateFromString,
    })

    const StoredWorldMetadata = Schema.Struct({
      id: WorldIdSchema,
      name: Schema.String,
      description: Schema.String,
      seed: WorldSeedSchema,
      generatorId: WorldGeneratorIdSchema,
      version: Schema.String,
      gameVersion: Schema.String,
      createdAt: Schema.DateFromString,
      lastModified: Schema.DateFromString,
      lastAccessed: Schema.DateFromString,
      tags: Schema.Array(Schema.String),
      properties: Schema.Record(Schema.String, Schema.Unknown),
      settings: WorldSettingsPersistenceSchema,
      statistics: WorldStatisticsPersistenceSchema,
      checksum: Schema.String,
    })

    const StoredMetadataVersion = Schema.Struct({
      version: Schema.String,
      timestamp: Schema.DateFromString,
      changes: Schema.Array(MetadataChangePersistenceSchema),
      checksum: Schema.String,
      size: Schema.Number,
      parentVersion: Schema.Optional(Schema.String),
    })

    const StoredBackupInfo = Schema.Struct({
      backupId: Schema.String,
      worldId: WorldIdSchema,
      timestamp: Schema.DateFromString,
      type: Schema.Literal('full', 'incremental', 'differential'),
      size: Schema.Number,
      compressedSize: Schema.Number,
      checksum: Schema.String,
      isEncrypted: Schema.Boolean,
      parentBackupId: Schema.Optional(Schema.String),
      description: Schema.Optional(Schema.String),
    })
    const EMPTY_WORLD_ID = Schema.decodeSync(WorldIdSchema)('world_placeholder')

    // Initialize storage directories
    const directories = [
      persistenceConfig.dataPath,
      persistenceConfig.backupPath,
      persistenceConfig.versionPath,
      persistenceConfig.indexPath,
    ]

    yield* Effect.forEach(
      directories,
      (dir) =>
        Effect.promise(() => fs.promises.mkdir(dir, { recursive: true })).pipe(
          Effect.catchAll((error) =>
            Effect.fail(createStorageError(`Failed to create directory ${dir}: ${error}`, 'initialize', error))
          )
        ),
      { concurrency: 'unbounded' }
    )

    // === File Operations ===

    const getMetadataFilePath = (worldId: WorldId): string => path.join(persistenceConfig.dataPath, `${worldId}.json`)

    const getVersionFilePath = (worldId: WorldId): string =>
      path.join(persistenceConfig.versionPath, `${worldId}_versions.json`)

    const getBackupFilePath = (backupId: string): string =>
      path.join(persistenceConfig.backupPath, `${backupId}.backup`)

    const getIndexFilePath = (indexName: string): string => path.join(persistenceConfig.indexPath, `${indexName}.index`)

    const encryptData = (data: string, key: string): string => {
      const cipher = crypto.createCipher('aes-256-cbc', key)
      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return encrypted
    }

    const decryptData = (encryptedData: string, key: string): string => {
      const decipher = crypto.createDecipher('aes-256-cbc', key)
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }

    const compressData = (data: string): Effect.Effect<Buffer, AllRepositoryErrors> =>
      Effect.tryPromise({
        try: () =>
          new Promise<Buffer>((resolve, reject) => {
            zlib.gzip(data, (err, result) => {
              err ? reject(err) : resolve(result)
            })
          }),
        catch: (error) => createCompressionError('', `Compression failed: ${error}`, error),
      })

    const decompressData = (compressedData: Buffer): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.tryPromise({
        try: () =>
          new Promise<string>((resolve, reject) => {
            zlib.gunzip(compressedData, (err, result) => {
              err ? reject(err) : resolve(result.toString('utf8'))
            })
          }),
        catch: (error) => createCompressionError('', `Decompression failed: ${error}`, error),
      })

    const writeFile = (filePath: string, data: unknown): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const directory = path.dirname(filePath)
        yield* Effect.promise(() => fs.promises.mkdir(directory, { recursive: true }))

        let content = JSON.stringify(data, null, 2)

        // Apply encryption if enabled
        yield* Effect.when(persistenceConfig.enableEncryption && persistenceConfig.encryptionKey, () =>
          Effect.sync(() => {
            content = encryptData(content, persistenceConfig.encryptionKey!)
          })
        )

        // Apply compression if enabled
        yield* Effect.if(persistenceConfig.enableCompression, {
          onTrue: () =>
            Effect.gen(function* () {
              const compressed = yield* compressData(content)
              yield* Effect.promise(() => fs.promises.writeFile(filePath + '.gz', compressed))
            }),
          onFalse: () => Effect.promise(() => fs.promises.writeFile(filePath, content, 'utf8')),
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(`Failed to write file ${filePath}: ${error}`, 'writeFile', error))
        )
      )

    const readFile = <T>(
      filePath: string,
      schema: Schema.Schema<T, unknown>
    ): Effect.Effect<Option.Option<T>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const compressedPath = filePath + '.gz'
        const fileExists = yield* pipe(
          Effect.tryPromise(() => fs.promises.access(compressedPath)),
          Effect.option,
          Effect.map(Option.isSome)
        )
        const useCompression = persistenceConfig.enableCompression && fileExists

        const actualPath = useCompression ? compressedPath : filePath
        const exists = yield* pipe(
          Effect.tryPromise(() => fs.promises.access(actualPath)),
          Effect.option,
          Effect.map(Option.isSome)
        )

        return yield* Effect.if(exists, {
          onTrue: () =>
            Effect.gen(function* () {
              let content = yield* Effect.if(useCompression, {
                onTrue: () =>
                  Effect.gen(function* () {
                    const compressedBuffer = yield* Effect.promise(() => fs.promises.readFile(actualPath))
                    return yield* decompressData(compressedBuffer)
                  }),
                onFalse: () => Effect.promise(() => fs.promises.readFile(actualPath, 'utf8')),
              })

              content = yield* Effect.if(persistenceConfig.enableEncryption && persistenceConfig.encryptionKey, {
                onTrue: () => Effect.sync(() => decryptData(content, persistenceConfig.encryptionKey!)),
                onFalse: () => Effect.succeed(content),
              })

              // パターンB: Effect.try + Effect.flatMap + Schema.decodeUnknown
              const decoded = yield* Effect.try({
                try: () => JSON.parse(content),
                catch: (error) =>
                  createDataIntegrityError(`JSON parse failed for ${filePath}: ${String(error)}`, 'readFile', error),
              }).pipe(
                Effect.flatMap(Schema.decodeUnknown(schema)),
                Effect.catchAll((error) =>
                  Effect.fail(
                    createDataIntegrityError(`Schema validation failed for ${filePath}: ${error}`, 'readFile', error)
                  )
                )
              )

              return Option.some(decoded)
            }),
          onFalse: () => Effect.succeed(Option.none()),
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(`Failed to read file ${filePath}: ${error}`, 'readFile', error))
        )
      )

    // === Load data from storage ===

    const loadAllMetadata = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* pipe(
          Effect.tryPromise(() => fs.promises.access(persistenceConfig.dataPath)),
          Effect.option,
          Effect.map(Option.isSome)
        )

        yield* Effect.when(exists, () =>
          Effect.gen(function* () {
            const files = yield* Effect.promise(() => fs.promises.readdir(persistenceConfig.dataPath)).pipe(
              Effect.catchAll(() => Effect.succeed([]))
            )

            const validFiles = pipe(
              files,
              ReadonlyArray.filter((file) => file.endsWith('.json') || file.endsWith('.json.gz'))
            )

            const metadataMap = yield* Effect.reduce(validFiles, new Map<WorldId, WorldMetadata>(), (acc, file) =>
              Effect.gen(function* () {
                const rawId = file.replace(/\.(json|json\.gz)$/, '')
                const worldId = Schema.decodeSync(WorldIdSchema)(rawId)
                const filePath = getMetadataFilePath(worldId)
                const metadata = yield* readFile(filePath, StoredWorldMetadata)

                return pipe(
                  metadata,
                  Option.match({
                    onNone: () => acc,
                    onSome: (value) => {
                      const updated = new Map(acc)
                      updated.set(worldId, value)
                      return updated
                    },
                  })
                )
              })
            )

            yield* Ref.set(metadataStore, metadataMap)
          })
        )
      })

    const loadVersionHistory = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* pipe(
          Effect.tryPromise(() => fs.promises.access(persistenceConfig.versionPath)),
          Effect.option,
          Effect.map(Option.isSome)
        )

        yield* Effect.when(exists, () =>
          Effect.gen(function* () {
            const files = yield* Effect.promise(() => fs.promises.readdir(persistenceConfig.versionPath)).pipe(
              Effect.catchAll(() => Effect.succeed([]))
            )

            const validFiles = pipe(
              files,
              ReadonlyArray.filter((file) => file.endsWith('_versions.json') || file.endsWith('_versions.json.gz'))
            )

            const versionMap = yield* Effect.reduce(
              validFiles,
              new Map<WorldId, Map<string, MetadataVersion>>(),
              (acc, file) =>
                Effect.gen(function* () {
                  const rawId = file.replace(/_versions\.(json|json\.gz)$/, '')
                  const worldId = Schema.decodeSync(WorldIdSchema)(rawId)
                  const filePath = getVersionFilePath(worldId)
                  const versions = yield* readFile(filePath, Schema.Array(StoredMetadataVersion))

                  return pipe(
                    versions,
                    Option.match({
                      onNone: () => acc,
                      onSome: (value) => {
                        const worldVersionMap = pipe(
                          value,
                          ReadonlyArray.reduce(new Map<string, MetadataVersion>(), (map, version) => {
                            map.set(version.version, version)
                            return map
                          })
                        )

                        const updated = new Map(acc)
                        updated.set(worldId, worldVersionMap)
                        return updated
                      },
                    })
                  )
                })
            )

            yield* Ref.set(versionStore, versionMap)
          })
        )
      })

    const loadBackups = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* pipe(
          Effect.tryPromise(() => fs.promises.access(persistenceConfig.backupPath)),
          Effect.option,
          Effect.map(Option.isSome)
        )

        yield* Effect.when(exists, () =>
          Effect.gen(function* () {
            const files = yield* Effect.promise(() => fs.promises.readdir(persistenceConfig.backupPath)).pipe(
              Effect.catchAll(() => Effect.succeed([]))
            )

            const validFiles = pipe(
              files,
              ReadonlyArray.filter((file) => file.endsWith('.backup'))
            )

            const backupMap = yield* Effect.reduce(validFiles, new Map<string, BackupInfo>(), (acc, file) =>
              Effect.gen(function* () {
                const backupId = file.replace(/\.backup$/, '')
                const filePath = getBackupFilePath(backupId)
                const backup = yield* readFile(filePath, StoredBackupInfo)

                return pipe(
                  backup,
                  Option.match({
                    onNone: () => acc,
                    onSome: (value) => {
                      const worldId = Schema.decodeSync(WorldIdSchema)(value.worldId)
                      const updated = new Map(acc)
                      updated.set(backupId, {
                        ...value,
                        worldId,
                      })
                      return updated
                    },
                  })
                )
              })
            )

            yield* Ref.set(backupStore, backupMap)
          })
        )
      })

    // === Persistence operations ===

    const persistMetadata = (metadata: WorldMetadata): Effect.Effect<void, AllRepositoryErrors> =>
      writeFile(getMetadataFilePath(metadata.id), {
        ...metadata,
        createdAt: metadata.createdAt.toISOString(),
        lastModified: metadata.lastModified.toISOString(),
        lastAccessed: metadata.lastAccessed.toISOString(),
      })

    const persistVersionHistory = (
      worldId: WorldId,
      versions: Map<string, MetadataVersion>
    ): Effect.Effect<void, AllRepositoryErrors> =>
      writeFile(
        getVersionFilePath(worldId),
        Array.from(versions.values()).map((v) => ({
          ...v,
          timestamp: v.timestamp.toISOString(),
        }))
      )

    const persistBackup = (backup: BackupInfo): Effect.Effect<void, AllRepositoryErrors> =>
      writeFile(getBackupFilePath(backup.backupId), {
        ...backup,
        timestamp: backup.timestamp.toISOString(),
      })

    // Initialize by loading existing data
    yield* loadAllMetadata()
    yield* loadVersionHistory()
    yield* loadBackups()

    // === Repository Implementation ===

    return {
      // === Metadata Management ===

      saveMetadata: (metadata: WorldMetadata) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const updatedMetadata = yield* updateChecksum(metadata)

          const updated = new Map(store)
          updated.set(metadata.id, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          yield* persistMetadata(updatedMetadata)

          // Update cache
          yield* Effect.when(config.cache.enabled, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(metadataCache)
              const updatedCache = new Map(cache)
              const timestamp = yield* currentMillis
              updatedCache.set(metadata.id, {
                metadata: updatedMetadata,
                timestamp,
              })
              yield* Ref.set(metadataCache, updatedCache)
            })
          )

          // Create version if enabled
          yield* Effect.when(config.versioning.enabled && config.versioning.automaticVersioning, () =>
            Effect.gen(function* () {
              const timestamp = yield* currentDate
              const changes: MetadataChange[] = [
                {
                  type: store.has(metadata.id) ? 'update' : 'create',
                  path: 'metadata',
                  oldValue: store.get(metadata.id),
                  newValue: updatedMetadata,
                  timestamp,
                  reason: 'Automatic versioning on save',
                },
              ]

              yield* Effect.ignore(this.createVersion(metadata.id, changes, 'Auto-save'))
            })
          )
        }),

      findMetadata: (worldId: WorldId) =>
        Effect.gen(function* () {
          const cachedResult = yield* Effect.if(config.cache.enabled, {
            onTrue: () =>
              Effect.gen(function* () {
                const cache = yield* Ref.get(metadataCache)
                const cached = cache.get(worldId)

                return yield* pipe(
                  Option.fromNullable(cached),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<WorldMetadata>()),
                    onSome: (cachedEntry) =>
                      Effect.gen(function* () {
                        const now = yield* currentMillis
                        return yield* Effect.if(!isCacheExpired(now, cachedEntry.timestamp), {
                          onTrue: () =>
                            Effect.gen(function* () {
                              yield* Ref.update(cacheStats, (stats) => ({ ...stats, hitCount: stats.hitCount + 1 }))
                              return Option.some(cachedEntry.metadata)
                            }),
                          onFalse: () => Effect.succeed(Option.none<WorldMetadata>()),
                        })
                      }),
                  })
                )
              }),
            onFalse: () => Effect.succeed(Option.none<WorldMetadata>()),
          })

          return yield* pipe(
            cachedResult,
            Option.match({
              onSome: (metadata) => Effect.succeed(Option.some(metadata)),
              onNone: () =>
                Effect.gen(function* () {
                  const store = yield* Ref.get(metadataStore)
                  const metadata = store.get(worldId)

                  yield* Ref.update(cacheStats, (stats) => ({ ...stats, missCount: stats.missCount + 1 }))

                  yield* Effect.when(metadata && config.cache.enabled, () =>
                    Effect.gen(function* () {
                      const cache = yield* Ref.get(metadataCache)
                      const updatedCache = new Map(cache)
                      const timestamp = yield* currentMillis
                      updatedCache.set(worldId, {
                        metadata: metadata!,
                        timestamp,
                      })
                      yield* Ref.set(metadataCache, updatedCache)
                    })
                  )

                  return Option.fromNullable(metadata)
                }),
            })
          )
        }),

      findAllMetadata: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          return Array.from(store.values())
        }),

      updateMetadata: (metadata: WorldMetadata) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          yield* Effect.when(!store.has(metadata.id), () =>
            Effect.fail(createRepositoryError(`World metadata not found: ${metadata.id}`, 'updateMetadata', null))
          )

          const oldMetadata = store.get(metadata.id)!
          const updatedMetadata = yield* updateChecksum(metadata)

          const updated = new Map(store)
          updated.set(metadata.id, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          yield* persistMetadata(updatedMetadata)

          // Update cache
          yield* Effect.when(config.cache.enabled, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(metadataCache)
              const updatedCache = new Map(cache)
              const timestamp = yield* currentMillis
              updatedCache.set(metadata.id, {
                metadata: updatedMetadata,
                timestamp,
              })
              yield* Ref.set(metadataCache, updatedCache)
            })
          )

          // Create version if enabled
          yield* Effect.when(config.versioning.enabled && config.versioning.automaticVersioning, () =>
            Effect.gen(function* () {
              const timestamp = yield* currentDate
              const changes: MetadataChange[] = [
                {
                  type: 'update',
                  path: 'metadata',
                  oldValue: oldMetadata,
                  newValue: updatedMetadata,
                  timestamp,
                  reason: 'Automatic versioning on update',
                },
              ]

              yield* Effect.ignore(this.createVersion(metadata.id, changes, 'Auto-update'))
            })
          )
        }),

      deleteMetadata: (worldId: WorldId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          yield* Effect.when(!store.has(worldId), () =>
            Effect.fail(createRepositoryError(`World metadata not found: ${worldId}`, 'deleteMetadata', null))
          )

          const oldMetadata = store.get(worldId)!
          const updated = new Map(store)
          updated.delete(worldId)
          yield* Ref.set(metadataStore, updated)

          // Delete file
          const filePath = getMetadataFilePath(worldId)
          yield* pipe(
            Effect.tryPromise(() => fs.promises.unlink(filePath)),
            Effect.ignore
          )
          yield* pipe(
            Effect.tryPromise(() => fs.promises.unlink(filePath + '.gz')),
            Effect.ignore
          )

          // Remove from cache
          yield* Effect.when(config.cache.enabled, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(metadataCache)
              const updatedCache = new Map(cache)
              updatedCache.delete(worldId)
              yield* Ref.set(metadataCache, updatedCache)
            })
          )

          // Create deletion version
          yield* Effect.when(config.versioning.enabled, () =>
            Effect.gen(function* () {
              const timestamp = yield* currentDate
              const changes: MetadataChange[] = [
                {
                  type: 'delete',
                  path: 'metadata',
                  oldValue: oldMetadata,
                  newValue: undefined,
                  timestamp,
                  reason: 'Metadata deletion',
                },
              ]

              yield* Effect.ignore(this.createVersion(worldId, changes, 'Deletion'))
            })
          )
        }),

      searchMetadata: (query: MetadataQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          const candidates = pipe(
            Array.from(store.values()),
            // Apply filters
            ReadonlyArray.filter((m) => !query.worldId || m.id === query.worldId),
            ReadonlyArray.filter((m) => !query.name || m.name.toLowerCase().includes(query.name.toLowerCase())),
            ReadonlyArray.filter(
              (m) => !query.tags || query.tags.length === 0 || query.tags.some((tag) => m.tags.includes(tag))
            ),
            // Sort if specified
            (arr) =>
              query.sortBy
                ? pipe(
                    arr,
                    ReadonlyArray.sort((a, b) => {
                      const comparison = pipe(
                        Match.value(query.sortBy),
                        Match.when('name', () => a.name.localeCompare(b.name)),
                        Match.when(
                          'created',
                          () =>
                            DateTime.toEpochMillis(DateTime.unsafeFromDate(a.createdAt)) -
                            DateTime.toEpochMillis(DateTime.unsafeFromDate(b.createdAt))
                        ),
                        Match.when(
                          'modified',
                          () =>
                            DateTime.toEpochMillis(DateTime.unsafeFromDate(a.lastModified)) -
                            DateTime.toEpochMillis(DateTime.unsafeFromDate(b.lastModified))
                        ),
                        Match.when(
                          'size',
                          () => a.statistics.size.uncompressedSize - b.statistics.size.uncompressedSize
                        ),
                        Match.when(
                          'accessed',
                          () =>
                            DateTime.toEpochMillis(DateTime.unsafeFromDate(a.lastAccessed)) -
                            DateTime.toEpochMillis(DateTime.unsafeFromDate(b.lastAccessed))
                        ),
                        Match.orElse(() => 0)
                      )

                      return query.sortOrder === 'desc' ? -comparison : comparison
                    })
                  )
                : arr,
            // Limit results
            (arr) => (query.limit ? ReadonlyArray.take(arr, query.limit) : arr),
            // Map to search results
            ReadonlyArray.map((metadata) => ({
              metadata,
              relevanceScore: 1.0,
              matchedFields: ['name'] as ReadonlyArray<string>,
              snippet: metadata.description ? metadata.description.substring(0, 100) + '...' : undefined,
            }))
          )

          return candidates
        }),

      // === Settings Management ===

      updateSettings: (worldId: WorldId, settings: Partial<WorldSettings>) =>
        Effect.gen(function* () {
          const metadata = yield* pipe(
            this.findMetadata(worldId),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  Effect.fail(createRepositoryError(`World metadata not found: ${worldId}`, 'updateSettings', null)),
                onSome: (m) => Effect.succeed(m),
              })
            )
          )

          const updatedMetadata = {
            ...metadata,
            settings: { ...metadata.settings, ...settings },
          }

          yield* this.updateMetadata(updatedMetadata)
        }),

      getSettings: (worldId: WorldId) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)
          return Option.map(metadata, (m) => m.settings)
        }),

      setGameRule: (worldId: WorldId, rule: string, value: boolean | number | string) =>
        Effect.gen(function* () {
          const settings = yield* this.getSettings(worldId)

          yield* pipe(
            settings,
            Option.match({
              onNone: () =>
                Effect.fail(createRepositoryError(`World settings not found: ${worldId}`, 'setGameRule', null)),
              onSome: (settingsValue) =>
                Effect.gen(function* () {
                  const updatedGameRules = { ...settingsValue.gameRules, [rule]: value }
                  yield* this.updateSettings(worldId, { gameRules: updatedGameRules })
                }),
            })
          )
        }),

      getGameRule: (worldId: WorldId, rule: string) =>
        Effect.gen(function* () {
          const settings = yield* this.getSettings(worldId)

          return pipe(
            settings,
            Option.match({
              onNone: () => Option.none(),
              onSome: (settingsValue) => Option.fromNullable(settingsValue.gameRules[rule]),
            })
          )
        }),

      // === Statistics Management ===

      updateStatistics: (worldId: WorldId, statistics: Partial<WorldStatistics>) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          yield* pipe(
            metadata,
            Option.match({
              onNone: () =>
                Effect.fail(createRepositoryError(`World metadata not found: ${worldId}`, 'updateStatistics', null)),
              onSome: (metadataValue) =>
                Effect.gen(function* () {
                  const lastUpdated = yield* currentDate
                  const updatedMetadata = {
                    ...metadataValue,
                    statistics: { ...metadataValue.statistics, ...statistics, lastUpdated },
                  }

                  yield* this.updateMetadata(updatedMetadata)
                }),
            })
          )
        }),

      getStatistics: (worldId: WorldId) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)
          return Option.map(metadata, (m) => m.statistics)
        }),

      recordPerformanceMetric: (worldId: WorldId, metric: string, value: number, timestamp?: Date) =>
        Effect.gen(function* () {
          const currentStats = yield* this.getStatistics(worldId)

          yield* pipe(
            currentStats,
            Option.match({
              onNone: () =>
                Effect.fail(
                  createRepositoryError(`World statistics not found: ${worldId}`, 'recordPerformanceMetric', null)
                ),
              onSome: (statsValue) =>
                this.updateStatistics(worldId, {
                  performance: {
                    ...statsValue.performance,
                    [metric]: value,
                  },
                }),
            })
          )
        }),

      updateContentStatistics: (worldId: WorldId, contentType: string, count: number) =>
        Effect.gen(function* () {
          const currentStats = yield* pipe(
            this.getStatistics(worldId),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  Effect.fail(
                    createRepositoryError(`World statistics not found: ${worldId}`, 'updateContentStatistics', null)
                  ),
                onSome: (s) => Effect.succeed(s),
              })
            )
          )

          const currentContent = currentStats.content
          const updateCounter = (source: Record<string, number>) => ({
            ...source,
            [contentType]: count,
          })

          const nextContent = pipe(
            Match.value(contentType),
            Match.when('biome', () => ({ ...currentContent, biomeCount: updateCounter(currentContent.biomeCount) })),
            Match.when('structure', () => ({
              ...currentContent,
              structureCount: updateCounter(currentContent.structureCount),
            })),
            Match.when('entity', () => ({ ...currentContent, entityCount: updateCounter(currentContent.entityCount) })),
            Match.when('tileEntity', () => ({
              ...currentContent,
              tileEntityCount: updateCounter(currentContent.tileEntityCount),
            })),
            Match.orElse(() => currentContent)
          )

          yield* Effect.when(nextContent !== currentContent, () =>
            this.updateStatistics(worldId, {
              content: nextContent,
            })
          )
        }),

      // === Versioning System ===

      createVersion: (worldId: WorldId, changes: ReadonlyArray<MetadataChange>, description?: string) =>
        Effect.gen(function* () {
          yield* Effect.when(!config.versioning.enabled, () =>
            Effect.fail(createVersioningError(worldId, 'Versioning is disabled', null))
          )

          const version = yield* nextVersionId()
          const timestamp = yield* currentDate
          const serializedChanges = JSON.stringify(changes)

          const metadataVersion: MetadataVersion = {
            version,
            timestamp,
            changes,
            checksum: checksumFromString(serializedChanges),
            size: new TextEncoder().encode(serializedChanges).length,
          }

          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId) || new Map()

          // Check version limit and remove oldest if necessary
          const updatedWorldVersions = yield* Effect.if(worldVersions.size >= config.versioning.maxVersionsPerWorld, {
            onTrue: () =>
              Effect.sync(() => {
                const oldest = pipe(
                  Array.from(worldVersions.entries()),
                  ReadonlyArray.sort(
                    ([, a], [, b]) =>
                      DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp)) -
                      DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp))
                  ),
                  ReadonlyArray.head
                )
                pipe(
                  oldest,
                  Option.match({
                    onNone: () => {},
                    onSome: (oldestEntry) => {
                      worldVersions.delete(oldestEntry[0])
                    },
                  })
                )
                return worldVersions
              }),
            onFalse: () => Effect.succeed(worldVersions),
          })

          updatedWorldVersions.set(version, metadataVersion)

          const updatedVersionMap = new Map(versionMap)
          updatedVersionMap.set(worldId, updatedWorldVersions)
          yield* Ref.set(versionStore, updatedVersionMap)

          yield* persistVersionHistory(worldId, updatedWorldVersions)

          return version
        }),

      getVersion: (worldId: WorldId, version: string) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          return pipe(
            Option.fromNullable(worldVersions),
            Option.flatMap((versions) => Option.fromNullable(versions.get(version)))
          )
        }),

      getVersionHistory: (worldId: WorldId) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          return pipe(
            Option.fromNullable(worldVersions),
            Option.match({
              onNone: () => ({
                worldId,
                versions: [],
                currentVersion: '',
                totalVersions: 0,
                totalSize: 0,
                oldestVersion: '',
                newestVersion: '',
              }),
              onSome: (versions) => {
                const versionArray = Array.from(versions.values())
                const sortedVersions = versionArray.sort(
                  (a, b) =>
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp)) -
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp))
                )

                return {
                  worldId,
                  versions: sortedVersions,
                  currentVersion: sortedVersions[sortedVersions.length - 1]?.version || '',
                  totalVersions: versionArray.length,
                  totalSize: versionArray.reduce((sum, v) => sum + v.size, 0),
                  oldestVersion: sortedVersions[0]?.version || '',
                  newestVersion: sortedVersions[sortedVersions.length - 1]?.version || '',
                }
              },
            })
          )
        }),

      restoreVersion: (worldId: WorldId, version: string) =>
        Effect.gen(function* () {
          const versionData = yield* this.getVersion(worldId, version)

          yield* pipe(
            versionData,
            Option.match({
              onNone: () => Effect.fail(createVersioningError(worldId, `Version not found: ${version}`, null)),
              onSome: (versionValue) =>
                Effect.gen(function* () {
                  const timestamp = yield* currentDate
                  const restorationChanges: MetadataChange[] = versionValue.changes.map((change) => ({
                    ...change,
                    type: change.type === 'create' ? 'delete' : change.type === 'delete' ? 'create' : 'update',
                    oldValue: change.newValue,
                    newValue: change.oldValue,
                    timestamp,
                    reason: `Restore to version ${version}`,
                  }))

                  yield* this.createVersion(worldId, restorationChanges, `Restore to ${version}`)
                }),
            })
          )
        }),

      compareVersions: (worldId: WorldId, version1: string, version2: string) =>
        Effect.gen(function* () {
          const v1 = yield* this.getVersion(worldId, version1)
          const v2 = yield* this.getVersion(worldId, version2)

          return yield* pipe(
            v1,
            Option.match({
              onNone: () => Effect.fail(createVersioningError(worldId, 'One or both versions not found', null)),
              onSome: (v1Value) =>
                pipe(
                  v2,
                  Option.match({
                    onNone: () => Effect.fail(createVersioningError(worldId, 'One or both versions not found', null)),
                    onSome: (v2Value) => Effect.succeed([...v1Value.changes, ...v2Value.changes]),
                  })
                ),
            })
          )
        }),

      cleanupOldVersions: (worldId: WorldId, retentionPolicy: { maxVersions?: number; maxAgeDays?: number }) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          return yield* pipe(
            Option.fromNullable(worldVersions),
            Option.match({
              onNone: () => Effect.succeed(0),
              onSome: (worldVersionsMap) =>
                Effect.gen(function* () {
                  const versionEntries = Array.from(worldVersionsMap.entries())

                  const versionsByMaxCount =
                    retentionPolicy.maxVersions && versionEntries.length > retentionPolicy.maxVersions
                      ? pipe(
                          versionEntries,
                          ReadonlyArray.sort(
                            ([, a], [, b]) =>
                              DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp)) -
                              DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp))
                          ),
                          ReadonlyArray.drop(retentionPolicy.maxVersions),
                          ReadonlyArray.map(([v]) => v)
                        )
                      : []

                  const versionsByAge = yield* Effect.if(Boolean(retentionPolicy.maxAgeDays), {
                    onTrue: () =>
                      Effect.gen(function* () {
                        const nowDateTime = yield* DateTime.now
                        const now = DateTime.toEpochMillis(nowDateTime)
                        const cutoffMillis = now - retentionPolicy.maxAgeDays! * 24 * 60 * 60 * 1000
                        const cutoffDate = DateTime.toDate(DateTime.unsafeMake(cutoffMillis))
                        return pipe(
                          versionEntries,
                          ReadonlyArray.filter(([, version]) => version.timestamp < cutoffDate),
                          ReadonlyArray.map(([v]) => v)
                        )
                      }),
                    onFalse: () => Effect.succeed([]),
                  })

                  const versionsToDelete = [...new Set([...versionsByMaxCount, ...versionsByAge])]

                  const updatedWorldVersions = pipe(
                    versionsToDelete,
                    ReadonlyArray.reduce(new Map(worldVersionsMap), (acc, versionToDelete) => {
                      acc.delete(versionToDelete)
                      return acc
                    })
                  )

                  const updatedVersionMap = new Map(versionMap)
                  updatedVersionMap.set(worldId, updatedWorldVersions)
                  yield* Ref.set(versionStore, updatedVersionMap)

                  yield* persistVersionHistory(worldId, updatedWorldVersions)

                  return versionsToDelete.length
                }),
            })
          )
        }),

      // === Compression System ===

      compressMetadata: (worldId: WorldId, compressionConfig = config.compression) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          return yield* pipe(
            metadata,
            Option.match({
              onNone: () => Effect.fail(createCompressionError(worldId, 'Metadata not found for compression', null)),
              onSome: (metadataValue) =>
                Effect.gen(function* () {
                  const serialized = JSON.stringify(metadataValue)
                  const originalSize = new TextEncoder().encode(serialized).length

                  const compressed = yield* compressData(serialized)
                  const compressedSize = compressed.length

                  const compressionStats: CompressionStatistics = {
                    algorithm: compressionConfig.algorithm,
                    originalSize,
                    compressedSize,
                    compressionRatio: compressedSize / originalSize,
                    compressionTime: originalSize / 1000000,
                    decompressionTime: compressedSize / 2000000,
                    dictionarySize: compressionConfig.enableDictionary ? 64 * 1024 : 0,
                    chunksProcessed: Math.ceil(originalSize / compressionConfig.chunkSize),
                    deduplicationSavings: compressionConfig.enableDeduplication ? originalSize * 0.1 : 0,
                  }

                  const compressionMap = yield* Ref.get(compressionStore)
                  const updated = new Map(compressionMap)
                  updated.set(worldId, compressionStats)
                  yield* Ref.set(compressionStore, updated)

                  return compressionStats
                }),
            })
          )
        }),

      decompressMetadata: (worldId: WorldId) =>
        Effect.gen(function* () {
          const compressionMap = yield* Ref.get(compressionStore)

          yield* Effect.if(compressionMap.has(worldId), {
            onTrue: () =>
              Effect.gen(function* () {
                const updated = new Map(compressionMap)
                updated.delete(worldId)
                yield* Ref.set(compressionStore, updated)
              }),
            onFalse: () => Effect.fail(createCompressionError(worldId, 'No compression data found', null)),
          })
        }),

      getCompressionStatistics: (worldId: WorldId) =>
        Effect.gen(function* () {
          const compressionMap = yield* Ref.get(compressionStore)
          return Option.fromNullable(compressionMap.get(worldId))
        }),

      updateCompressionConfig: (worldId: WorldId, compressionConfig: CompressionConfig) => Effect.succeed(undefined),

      enableAutoCompression: (worldId: WorldId, threshold: number) => Effect.succeed(undefined),

      // === Backup System ===

      createBackup: (worldId: WorldId, type: 'full' | 'incremental', description?: string) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          return yield* pipe(
            metadata,
            Option.match({
              onNone: () =>
                Effect.fail(createRepositoryError(`World metadata not found: ${worldId}`, 'createBackup', null)),
              onSome: (metadataValue) =>
                Effect.gen(function* () {
                  const millis = yield* currentMillis
                  const backupId = `backup_${worldId}_${millis}`
                  const timestamp = yield* currentDate
                  const size = estimateMetadataSize(metadataValue)
                  const compressedSize = config.backup.compressionEnabled ? Math.floor(size * 0.3) : size
                  const backupInfo: BackupInfo = {
                    backupId,
                    worldId,
                    timestamp,
                    type,
                    size,
                    compressedSize,
                    checksum: calculateMetadataChecksum(metadataValue),
                    isEncrypted: config.backup.encryptionEnabled,
                    description,
                  }

                  const backupMap = yield* Ref.get(backupStore)
                  const updatedBackupMap = new Map(backupMap)
                  updatedBackupMap.set(backupId, backupInfo)
                  yield* Ref.set(backupStore, updatedBackupMap)

                  yield* persistBackup(backupInfo)

                  return backupInfo
                }),
            })
          )
        }),

      listBackups: (worldId: WorldId) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const worldBackups = Array.from(backupMap.values())
            .filter((backup) => backup.worldId === worldId)
            .sort(
              (a, b) =>
                DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp)) -
                DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp))
            )

          return worldBackups
        }),

      restoreBackup: (worldId: WorldId, backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          yield* pipe(
            Option.fromNullable(backup),
            Option.filter((b) => b.worldId === worldId),
            Option.match({
              onNone: () =>
                Effect.fail(
                  createRepositoryError(
                    `Backup not found or not associated with world: ${backupId}`,
                    'restoreBackup',
                    null
                  )
                ),
              onSome: (backupValue) =>
                Effect.gen(function* () {
                  const timestamp = yield* currentDate
                  const changes: MetadataChange[] = [
                    {
                      type: 'update',
                      path: 'metadata',
                      oldValue: undefined,
                      newValue: backupValue,
                      timestamp,
                      reason: `Restore from backup ${backupId}`,
                    },
                  ]

                  yield* this.createVersion(worldId, changes, `Restore from backup ${backupId}`)
                }),
            })
          )
        }),

      deleteBackup: (backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          yield* pipe(
            Option.fromNullable(backup),
            Option.match({
              onNone: () => Effect.fail(createRepositoryError(`Backup not found: ${backupId}`, 'deleteBackup', null)),
              onSome: () =>
                Effect.gen(function* () {
                  const updatedBackupMap = new Map(backupMap)
                  updatedBackupMap.delete(backupId)
                  yield* Ref.set(backupStore, updatedBackupMap)

                  const filePath = getBackupFilePath(backupId)
                  yield* pipe(
                    Effect.tryPromise(() => fs.promises.unlink(filePath)),
                    Effect.ignore
                  )
                  yield* pipe(
                    Effect.tryPromise(() => fs.promises.unlink(filePath + '.gz')),
                    Effect.ignore
                  )
                }),
            })
          )
        }),

      verifyBackup: (backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          return yield* pipe(
            Option.fromNullable(backup),
            Option.match({
              onNone: () =>
                Effect.succeed({
                  isValid: false,
                  issues: [`Backup not found: ${backupId}`],
                }),
              onSome: () =>
                Effect.gen(function* () {
                  const filePath = getBackupFilePath(backupId)
                  const exists = yield* pipe(
                    Effect.tryPromise(() => fs.promises.access(filePath)),
                    Effect.option,
                    Effect.map(Option.isSome)
                  )

                  return yield* Effect.if(exists, {
                    onTrue: () =>
                      Effect.succeed({
                        isValid: true,
                        issues: [],
                      }),
                    onFalse: () =>
                      Effect.succeed({
                        isValid: false,
                        issues: ['Backup file does not exist'],
                      }),
                  })
                }),
            })
          )
        }),

      configureAutoBackup: (worldId: WorldId, backupConfig: BackupConfig) => Effect.succeed(undefined),

      // === Index Management ===

      rebuildIndexes: (worldId?: WorldId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          const metadataList = pipe(
            Array.from(store.entries()),
            ReadonlyArray.filter(([id]) => !worldId || id === worldId)
          )

          // Build name indexes
          const nameIndexMap = pipe(
            metadataList,
            ReadonlyArray.reduce(new Map<string, ReadonlyArray<WorldId>>(), (acc, [id, metadata]) => {
              const nameKey = `name:${metadata.name.toLowerCase()}`
              const existing = acc.get(nameKey) || []
              acc.set(nameKey, [...existing, id])
              return acc
            })
          )

          // Build tag indexes
          const indexMap = pipe(
            metadataList,
            ReadonlyArray.reduce(nameIndexMap, (acc, [id, metadata]) =>
              pipe(
                metadata.tags,
                ReadonlyArray.reduce(acc, (innerAcc, tag) => {
                  const tagKey = `tag:${tag.toLowerCase()}`
                  const existing = innerAcc.get(tagKey) || []
                  innerAcc.set(tagKey, [...existing, id])
                  return innerAcc
                })
              )
            )
          )

          yield* Ref.set(indexStore, indexMap)

          // Persist indexes
          yield* Effect.forEach(
            Array.from(indexMap.entries()),
            ([indexName, worldIds]) => writeFile(getIndexFilePath(indexName), worldIds),
            { concurrency: 'unbounded' }
          )
        }),

      optimizeIndexes: () =>
        Effect.succeed({
          beforeSize: 1024 * 1024,
          afterSize: 800 * 1024,
          improvementRatio: 0.2,
        }),

      getIndexStatistics: () =>
        Effect.gen(function* () {
          const indexMap = yield* Ref.get(indexStore)
          const nowDateTime = yield* DateTime.now
          const now = DateTime.toEpochMillis(nowDateTime)
          const lastOptimizedMillis = now - 24 * 60 * 60 * 1000

          return {
            totalIndexes: indexMap.size,
            totalSize: Array.from(indexMap.values()).reduce((sum, ids) => sum + ids.length * 32, 0), // Rough estimate
            fragmentationRatio: 0.15,
            lastOptimized: DateTime.toDate(DateTime.unsafeMake(lastOptimizedMillis)),
          }
        }),

      // === Cache Management ===

      updateMetadataCache: (worldId: WorldId, metadata: WorldMetadata) =>
        Effect.gen(function* () {
          yield* Effect.when(config.cache.enabled, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(metadataCache)
              const updated = new Map(cache)
              const timestamp = yield* currentMillis
              updated.set(worldId, {
                metadata,
                timestamp,
              })
              yield* Ref.set(metadataCache, updated)
            })
          )
        }),

      clearCache: (worldId?: WorldId) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(metadataCache)

          yield* pipe(
            Option.fromNullable(worldId),
            Option.match({
              onNone: () => Ref.set(metadataCache, new Map()),
              onSome: (id) =>
                Effect.gen(function* () {
                  const updated = new Map(cache)
                  updated.delete(id)
                  yield* Ref.set(metadataCache, updated)
                }),
            })
          )
        }),

      getCacheStatistics: () =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(cacheStats)
          const cache = yield* Ref.get(metadataCache)
          const total = stats.hitCount + stats.missCount

          return {
            hitRate: total > 0 ? stats.hitCount / total : 0,
            missRate: total > 0 ? stats.missCount / total : 0,
            size: cache.size,
            maxSize: config.cache.maxSize,
            evictionCount: stats.evictionCount,
          }
        }),

      warmupCache: (worldIds: ReadonlyArray<WorldId>) =>
        Effect.gen(function* () {
          yield* Effect.forEach(worldIds, (worldId) => Effect.ignore(this.findMetadata(worldId)), {
            concurrency: 'unbounded',
          })
        }),

      // === Bulk Operations ===

      saveMultipleMetadata: (metadataList: ReadonlyArray<WorldMetadata>) =>
        Effect.gen(function* () {
          const results = yield* Effect.forEach(
            metadataList,
            (metadata) =>
              pipe(
                Effect.either(this.saveMetadata(metadata)),
                Effect.map((result) => ({
                  success: result._tag === 'Right',
                  error: result._tag === 'Left' ? result.left : undefined,
                }))
              ),
            { concurrency: 'unbounded' }
          )

          const successful = pipe(
            results,
            ReadonlyArray.filter((r) => r.success),
            ReadonlyArray.length
          )
          const failed = pipe(
            results,
            ReadonlyArray.filter((r) => !r.success),
            ReadonlyArray.length
          )
          const errors = pipe(
            results,
            ReadonlyArray.filterMap((r) => (r.error ? Option.some(r.error) : Option.none()))
          )

          return { successful, failed, errors }
        }),

      updateMultipleMetadata: (updates: ReadonlyArray<{ worldId: WorldId; metadata: Partial<WorldMetadata> }>) =>
        Effect.gen(function* () {
          const results = yield* Effect.forEach(
            updates,
            (update) =>
              Effect.gen(function* () {
                const currentMetadata = yield* this.findMetadata(update.worldId)

                return pipe(
                  currentMetadata,
                  Option.match({
                    onNone: () => false,
                    onSome: (metadataValue) =>
                      Effect.gen(function* () {
                        const updatedMetadata = { ...metadataValue, ...update.metadata }
                        const result = yield* Effect.either(this.updateMetadata(updatedMetadata))
                        return result._tag === 'Right'
                      }),
                  })
                )
              }),
            { concurrency: 'unbounded' }
          )

          return pipe(
            results,
            ReadonlyArray.filter((success) => success),
            ReadonlyArray.length
          )
        }),

      deleteMultipleMetadata: (worldIds: ReadonlyArray<WorldId>) =>
        Effect.gen(function* () {
          const results = yield* Effect.forEach(
            worldIds,
            (worldId) =>
              pipe(
                Effect.either(this.deleteMetadata(worldId)),
                Effect.map((result) => result._tag === 'Right')
              ),
            { concurrency: 'unbounded' }
          )

          return pipe(
            results,
            ReadonlyArray.filter((success) => success),
            ReadonlyArray.length
          )
        }),

      bulkCompress: (worldIds: ReadonlyArray<WorldId>, compressionConfig = config.compression) =>
        Effect.gen(function* () {
          const results = yield* Effect.forEach(
            worldIds,
            (worldId) => Effect.either(this.compressMetadata(worldId, compressionConfig)),
            { concurrency: 'unbounded' }
          )

          return pipe(
            results,
            ReadonlyArray.filterMap((result) => (result._tag === 'Right' ? Option.some(result.right) : Option.none()))
          )
        }),

      // === Repository Management ===

      initialize: () =>
        Effect.gen(function* () {
          yield* loadAllMetadata()
          yield* loadVersionHistory()
          yield* loadBackups()
        }),

      cleanup: () =>
        Effect.gen(function* () {
          yield* this.clearCache()
          yield* Ref.set(cacheStats, {
            hitCount: 0,
            missCount: 0,
            evictionCount: 0,
          })
        }),

      validateIntegrity: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          const validationResults = yield* Effect.forEach(
            Array.from(store.entries()),
            ([worldId, metadata]) =>
              Effect.gen(function* () {
                const errors: string[] = []
                const corrupted: WorldId[] = []

                // Validate checksum
                const expectedChecksum = calculateMetadataChecksum(metadata)
                yield* Effect.when(metadata.checksum !== expectedChecksum, () =>
                  Effect.sync(() => {
                    errors.push(`Checksum mismatch for world ${worldId}`)
                    corrupted.push(worldId)
                  })
                )

                // Validate file exists
                const filePath = getMetadataFilePath(worldId)
                const exists = yield* pipe(
                  Effect.tryPromise(() => fs.promises.access(filePath)),
                  Effect.option,
                  Effect.map(Option.isSome)
                )

                yield* Effect.when(!exists, () =>
                  Effect.gen(function* () {
                    const existsGz = yield* pipe(
                      Effect.tryPromise(() => fs.promises.access(filePath + '.gz')),
                      Effect.option,
                      Effect.map(Option.isSome)
                    )

                    yield* Effect.when(!existsGz, () =>
                      Effect.sync(() => {
                        errors.push(`Metadata file missing for world ${worldId}`)
                        corrupted.push(worldId)
                      })
                    )
                  })
                )

                return { errors, corrupted }
              }),
            { concurrency: 'unbounded' }
          )

          const allErrors = pipe(
            validationResults,
            ReadonlyArray.flatMap((r) => r.errors)
          )
          const allCorrupted = pipe(
            validationResults,
            ReadonlyArray.flatMap((r) => r.corrupted),
            (arr) => [...new Set(arr)]
          )

          return {
            isValid: allErrors.length === 0,
            errors: allErrors,
            warnings: [],
            corruptedMetadata: allCorrupted,
          }
        }),

      getRepositoryStatistics: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const metadataList = Array.from(store.values())

          return yield* Effect.if(metadataList.length === 0, {
            onTrue: () =>
              Effect.gen(function* () {
                const now = yield* currentDate
                return {
                  totalWorlds: 0,
                  totalSize: 0,
                  averageWorldSize: 0,
                  compressionRatio: 1.0,
                  oldestWorld: now,
                  newestWorld: now,
                  mostActiveWorld: EMPTY_WORLD_ID,
                }
              }),
            onFalse: () =>
              Effect.succeed({
                totalWorlds: metadataList.length,
                totalSize: metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0),
                averageWorldSize:
                  metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0) / metadataList.length,
                compressionRatio:
                  metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0) > 0
                    ? metadataList.reduce((sum, m) => sum + m.statistics.size.compressedSize, 0) /
                      metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0)
                    : 1.0,
                oldestWorld: [...metadataList].sort(
                  (a, b) =>
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(a.createdAt)) -
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(b.createdAt))
                )[0].createdAt,
                newestWorld: [...metadataList].sort(
                  (a, b) =>
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(a.createdAt)) -
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(b.createdAt))
                )[metadataList.length - 1].createdAt,
                mostActiveWorld: [...metadataList].sort(
                  (a, b) =>
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(b.lastAccessed)) -
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(a.lastAccessed))
                )[0].id,
              }),
          })
        }),
    }
  })

// === Layer ===

export const WorldMetadataRepositoryPersistenceLive = (
  config: WorldMetadataRepositoryConfig,
  persistenceConfig?: PersistenceConfig
) => Layer.effect(WorldMetadataRepository, WorldMetadataRepositoryPersistenceImplementation(config, persistenceConfig))
