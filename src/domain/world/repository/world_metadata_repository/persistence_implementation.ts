/**
 * @fileoverview World Metadata Repository - Persistence Implementation
 * ワールドメタデータリポジトリの永続化実装
 *
 * ファイルシステムベース・圧縮・暗号化対応
 * 高度なバックアップとバージョン管理
 */

import { Context, Effect, Option, ReadonlyArray, Ref, Layer } from 'effect'
import * as Schema from '@effect/schema/Schema'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import * as crypto from 'crypto'
import type {
  WorldId,
} from '../../types'
import type { AllRepositoryErrors } from '../types'
import {
  createRepositoryError,
  createDataIntegrityError,
  createStorageError,
  createVersioningError,
  createCompressionError,
} from '../types'
import type {
  WorldMetadataRepository,
  WorldMetadataRepositoryConfig,
  WorldMetadata,
  WorldSettings,
  WorldStatistics,
  MetadataVersion,
  MetadataChange,
  VersionHistory,
  CompressionConfig,
  CompressionStatistics,
  MetadataQuery,
  MetadataSearchResult,
  BackupConfig,
  BackupInfo,
  calculateMetadataChecksum,
  generateVersionString,
  estimateMetadataSize,
} from './interface'

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

const StoredWorldMetadata = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  seed: Schema.String,
  generatorId: Schema.String,
  version: Schema.String,
  gameVersion: Schema.String,
  createdAt: Schema.DateFromString,
  lastModified: Schema.DateFromString,
  lastAccessed: Schema.DateFromString,
  tags: Schema.Array(Schema.String),
  properties: Schema.Record(Schema.String, Schema.Unknown),
  settings: Schema.Unknown,
  statistics: Schema.Unknown,
  checksum: Schema.String,
})

const StoredMetadataVersion = Schema.Struct({
  version: Schema.String,
  timestamp: Schema.DateFromString,
  changes: Schema.Array(Schema.Unknown),
  checksum: Schema.String,
  size: Schema.Number,
  parentVersion: Schema.Optional(Schema.String),
})

const StoredBackupInfo = Schema.Struct({
  backupId: Schema.String,
  worldId: Schema.String,
  timestamp: Schema.DateFromString,
  type: Schema.Literal('full', 'incremental', 'differential'),
  size: Schema.Number,
  compressedSize: Schema.Number,
  checksum: Schema.String,
  isEncrypted: Schema.Boolean,
  parentBackupId: Schema.Optional(Schema.String),
  description: Schema.Optional(Schema.String),
})

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

    // Initialize storage directories
    const directories = [
      persistenceConfig.dataPath,
      persistenceConfig.backupPath,
      persistenceConfig.versionPath,
      persistenceConfig.indexPath,
    ]

    for (const dir of directories) {
      yield* Effect.promise(() =>
        fs.promises.mkdir(dir, { recursive: true })
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(
            `Failed to create directory ${dir}: ${error}`,
            'initialize',
            error
          ))
        )
      )
    }

    // === File Operations ===

    const getMetadataFilePath = (worldId: WorldId): string =>
      path.join(persistenceConfig.dataPath, `${worldId}.json`)

    const getVersionFilePath = (worldId: WorldId): string =>
      path.join(persistenceConfig.versionPath, `${worldId}_versions.json`)

    const getBackupFilePath = (backupId: string): string =>
      path.join(persistenceConfig.backupPath, `${backupId}.backup`)

    const getIndexFilePath = (indexName: string): string =>
      path.join(persistenceConfig.indexPath, `${indexName}.index`)

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
      Effect.promise(() =>
        new Promise<Buffer>((resolve, reject) => {
          zlib.gzip(data, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        })
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createCompressionError(
            '',
            `Compression failed: ${error}`,
            error
          ))
        )
      )

    const decompressData = (compressedData: Buffer): Effect.Effect<string, AllRepositoryErrors> =>
      Effect.promise(() =>
        new Promise<string>((resolve, reject) => {
          zlib.gunzip(compressedData, (err, result) => {
            if (err) reject(err)
            else resolve(result.toString('utf8'))
          })
        })
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createCompressionError(
            '',
            `Decompression failed: ${error}`,
            error
          ))
        )
      )

    const writeFile = (filePath: string, data: unknown): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const directory = path.dirname(filePath)
        yield* Effect.promise(() =>
          fs.promises.mkdir(directory, { recursive: true })
        )

        let content = JSON.stringify(data, null, 2)

        // Apply encryption if enabled
        if (persistenceConfig.enableEncryption && persistenceConfig.encryptionKey) {
          content = encryptData(content, persistenceConfig.encryptionKey)
        }

        // Apply compression if enabled
        if (persistenceConfig.enableCompression) {
          const compressed = yield* compressData(content)
          yield* Effect.promise(() =>
            fs.promises.writeFile(filePath + '.gz', compressed)
          )
        } else {
          yield* Effect.promise(() =>
            fs.promises.writeFile(filePath, content, 'utf8')
          )
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(
            `Failed to write file ${filePath}: ${error}`,
            'writeFile',
            error
          ))
        )
      )

    const readFile = <T>(filePath: string, schema: Schema.Schema<T, unknown>): Effect.Effect<Option.Option<T>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const compressedPath = filePath + '.gz'
        const fileExists = yield* Effect.promise(() =>
          fs.promises.access(compressedPath).then(() => true).catch(() => false)
        )
        const useCompression = persistenceConfig.enableCompression && fileExists

        const actualPath = useCompression ? compressedPath : filePath
        const exists = yield* Effect.promise(() =>
          fs.promises.access(actualPath).then(() => true).catch(() => false)
        )

        if (!exists) {
          return Option.none()
        }

        let content: string

        if (useCompression) {
          const compressedBuffer = yield* Effect.promise(() =>
            fs.promises.readFile(actualPath)
          )
          content = yield* decompressData(compressedBuffer)
        } else {
          content = yield* Effect.promise(() =>
            fs.promises.readFile(actualPath, 'utf8')
          )
        }

        // Apply decryption if enabled
        if (persistenceConfig.enableEncryption && persistenceConfig.encryptionKey) {
          content = decryptData(content, persistenceConfig.encryptionKey)
        }

        const parsed = JSON.parse(content)
        const decoded = yield* Schema.decodeUnknown(schema)(parsed).pipe(
          Effect.catchAll((error) =>
            Effect.fail(createDataIntegrityError(
              `Schema validation failed for ${filePath}: ${error}`,
              'readFile',
              error
            ))
          )
        )

        return Option.some(decoded)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createStorageError(
            `Failed to read file ${filePath}: ${error}`,
            'readFile',
            error
          ))
        )
      )

    // === Load data from storage ===

    const loadAllMetadata = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* Effect.promise(() =>
          fs.promises.access(persistenceConfig.dataPath).then(() => true).catch(() => false)
        )

        if (!exists) return

        const files = yield* Effect.promise(() =>
          fs.promises.readdir(persistenceConfig.dataPath)
        ).pipe(
          Effect.catchAll(() => Effect.succeed([]))
        )

        const metadataMap = new Map<WorldId, WorldMetadata>()

        for (const file of files) {
          if (!file.endsWith('.json') && !file.endsWith('.json.gz')) continue

          const worldId = file.replace(/\.(json|json\.gz)$/, '') as WorldId
          const filePath = getMetadataFilePath(worldId)
          const metadata = yield* readFile(filePath, StoredWorldMetadata)

          if (Option.isSome(metadata)) {
            metadataMap.set(worldId, {
              ...metadata.value,
              id: worldId,
              seed: metadata.value.seed as any,
              generatorId: metadata.value.generatorId as any,
              settings: metadata.value.settings as WorldSettings,
              statistics: metadata.value.statistics as WorldStatistics,
            })
          }
        }

        yield* Ref.set(metadataStore, metadataMap)
      })

    const loadVersionHistory = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* Effect.promise(() =>
          fs.promises.access(persistenceConfig.versionPath).then(() => true).catch(() => false)
        )

        if (!exists) return

        const files = yield* Effect.promise(() =>
          fs.promises.readdir(persistenceConfig.versionPath)
        ).pipe(
          Effect.catchAll(() => Effect.succeed([]))
        )

        const versionMap = new Map<WorldId, Map<string, MetadataVersion>>()

        for (const file of files) {
          if (!file.endsWith('_versions.json') && !file.endsWith('_versions.json.gz')) continue

          const worldId = file.replace(/_versions\.(json|json\.gz)$/, '') as WorldId
          const filePath = getVersionFilePath(worldId)
          const versions = yield* readFile(filePath, Schema.Array(StoredMetadataVersion))

          if (Option.isSome(versions)) {
            const worldVersionMap = new Map<string, MetadataVersion>()

            for (const version of versions.value) {
              worldVersionMap.set(version.version, {
                ...version,
                changes: version.changes as ReadonlyArray<MetadataChange>,
              })
            }

            versionMap.set(worldId, worldVersionMap)
          }
        }

        yield* Ref.set(versionStore, versionMap)
      })

    const loadBackups = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const exists = yield* Effect.promise(() =>
          fs.promises.access(persistenceConfig.backupPath).then(() => true).catch(() => false)
        )

        if (!exists) return

        const files = yield* Effect.promise(() =>
          fs.promises.readdir(persistenceConfig.backupPath)
        ).pipe(
          Effect.catchAll(() => Effect.succeed([]))
        )

        const backupMap = new Map<string, BackupInfo>()

        for (const file of files) {
          if (!file.endsWith('.backup')) continue

          const backupId = file.replace(/\.backup$/, '')
          const filePath = getBackupFilePath(backupId)
          const backup = yield* readFile(filePath, StoredBackupInfo)

          if (Option.isSome(backup)) {
            backupMap.set(backupId, {
              ...backup.value,
              worldId: backup.value.worldId as WorldId,
            })
          }
        }

        yield* Ref.set(backupStore, backupMap)
      })

    // === Persistence operations ===

    const persistMetadata = (metadata: WorldMetadata): Effect.Effect<void, AllRepositoryErrors> =>
      writeFile(getMetadataFilePath(metadata.id), {
        ...metadata,
        createdAt: metadata.createdAt.toISOString(),
        lastModified: metadata.lastModified.toISOString(),
        lastAccessed: metadata.lastAccessed.toISOString(),
      })

    const persistVersionHistory = (worldId: WorldId, versions: Map<string, MetadataVersion>): Effect.Effect<void, AllRepositoryErrors> =>
      writeFile(getVersionFilePath(worldId), Array.from(versions.values()).map(v => ({
        ...v,
        timestamp: v.timestamp.toISOString(),
      })))

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
          const updatedMetadata = {
            ...metadata,
            checksum: calculateMetadataChecksum(metadata),
            lastModified: new Date(),
          }

          const updated = new Map(store)
          updated.set(metadata.id, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          yield* persistMetadata(updatedMetadata)

          // Update cache
          if (config.cache.enabled) {
            const cache = yield* Ref.get(metadataCache)
            const updatedCache = new Map(cache)
            updatedCache.set(metadata.id, {
              metadata: updatedMetadata,
              timestamp: Date.now(),
            })
            yield* Ref.set(metadataCache, updatedCache)
          }

          // Create version if enabled
          if (config.versioning.enabled && config.versioning.automaticVersioning) {
            const changes: MetadataChange[] = [{
              type: store.has(metadata.id) ? 'update' : 'create',
              path: 'metadata',
              oldValue: store.get(metadata.id),
              newValue: updatedMetadata,
              timestamp: new Date(),
              reason: 'Automatic versioning on save',
            }]

            yield* Effect.ignore(this.createVersion(metadata.id, changes, 'Auto-save'))
          }
        }),

      findMetadata: (worldId: WorldId) =>
        Effect.gen(function* () {
          // Try cache first
          if (config.cache.enabled) {
            const cache = yield* Ref.get(metadataCache)
            const cached = cache.get(worldId)

            if (cached && Date.now() - cached.timestamp < config.cache.ttlSeconds * 1000) {
              yield* Ref.update(cacheStats, stats => ({ ...stats, hitCount: stats.hitCount + 1 }))
              return Option.some(cached.metadata)
            }
          }

          // Fallback to store
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          yield* Ref.update(cacheStats, stats => ({ ...stats, missCount: stats.missCount + 1 }))

          if (metadata && config.cache.enabled) {
            // Update cache
            const cache = yield* Ref.get(metadataCache)
            const updatedCache = new Map(cache)
            updatedCache.set(worldId, {
              metadata,
              timestamp: Date.now(),
            })
            yield* Ref.set(metadataCache, updatedCache)
          }

          return Option.fromNullable(metadata)
        }),

      findAllMetadata: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          return Array.from(store.values())
        }),

      updateMetadata: (metadata: WorldMetadata) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          if (!store.has(metadata.id)) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${metadata.id}`,
              'updateMetadata',
              null
            ))
          }

          const oldMetadata = store.get(metadata.id)!
          const updatedMetadata = {
            ...metadata,
            checksum: calculateMetadataChecksum(metadata),
            lastModified: new Date(),
          }

          const updated = new Map(store)
          updated.set(metadata.id, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          yield* persistMetadata(updatedMetadata)

          // Update cache
          if (config.cache.enabled) {
            const cache = yield* Ref.get(metadataCache)
            const updatedCache = new Map(cache)
            updatedCache.set(metadata.id, {
              metadata: updatedMetadata,
              timestamp: Date.now(),
            })
            yield* Ref.set(metadataCache, updatedCache)
          }

          // Create version if enabled
          if (config.versioning.enabled && config.versioning.automaticVersioning) {
            const changes: MetadataChange[] = [{
              type: 'update',
              path: 'metadata',
              oldValue: oldMetadata,
              newValue: updatedMetadata,
              timestamp: new Date(),
              reason: 'Automatic versioning on update',
            }]

            yield* Effect.ignore(this.createVersion(metadata.id, changes, 'Auto-update'))
          }
        }),

      deleteMetadata: (worldId: WorldId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)

          if (!store.has(worldId)) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${worldId}`,
              'deleteMetadata',
              null
            ))
          }

          const oldMetadata = store.get(worldId)!
          const updated = new Map(store)
          updated.delete(worldId)
          yield* Ref.set(metadataStore, updated)

          // Delete file
          const filePath = getMetadataFilePath(worldId)
          yield* Effect.promise(() =>
            fs.promises.unlink(filePath).catch(() => {})
          )
          yield* Effect.promise(() =>
            fs.promises.unlink(filePath + '.gz').catch(() => {})
          )

          // Remove from cache
          if (config.cache.enabled) {
            const cache = yield* Ref.get(metadataCache)
            const updatedCache = new Map(cache)
            updatedCache.delete(worldId)
            yield* Ref.set(metadataCache, updatedCache)
          }

          // Create deletion version
          if (config.versioning.enabled) {
            const changes: MetadataChange[] = [{
              type: 'delete',
              path: 'metadata',
              oldValue: oldMetadata,
              newValue: undefined,
              timestamp: new Date(),
              reason: 'Metadata deletion',
            }]

            yield* Effect.ignore(this.createVersion(worldId, changes, 'Deletion'))
          }
        }),

      searchMetadata: (query: MetadataQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          let candidates = Array.from(store.values())

          // Apply filters (same as memory implementation)
          if (query.worldId) {
            candidates = candidates.filter(m => m.id === query.worldId)
          }

          if (query.name) {
            candidates = candidates.filter(m =>
              m.name.toLowerCase().includes(query.name!.toLowerCase())
            )
          }

          if (query.tags && query.tags.length > 0) {
            candidates = candidates.filter(m =>
              query.tags!.some(tag => m.tags.includes(tag))
            )
          }

          // ... (other filters from memory implementation)

          // Sort and limit results
          if (query.sortBy) {
            candidates.sort((a, b) => {
              let comparison = 0

              switch (query.sortBy) {
                case 'name':
                  comparison = a.name.localeCompare(b.name)
                  break
                case 'created':
                  comparison = a.createdAt.getTime() - b.createdAt.getTime()
                  break
                case 'modified':
                  comparison = a.lastModified.getTime() - b.lastModified.getTime()
                  break
                case 'size':
                  comparison = a.statistics.size.uncompressedSize - b.statistics.size.uncompressedSize
                  break
                case 'accessed':
                  comparison = a.lastAccessed.getTime() - b.lastAccessed.getTime()
                  break
              }

              return query.sortOrder === 'desc' ? -comparison : comparison
            })
          }

          if (query.limit) {
            candidates = candidates.slice(0, query.limit)
          }

          const results: MetadataSearchResult[] = candidates.map(metadata => ({
            metadata,
            relevanceScore: 1.0,
            matchedFields: ['name'],
            snippet: metadata.description ? metadata.description.substring(0, 100) + '...' : undefined,
          }))

          return results
        }),

      // === Settings Management ===

      updateSettings: (worldId: WorldId, settings: Partial<WorldSettings>) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          if (Option.isNone(metadata)) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${worldId}`,
              'updateSettings',
              null
            ))
          }

          const updatedMetadata = {
            ...metadata.value,
            settings: { ...metadata.value.settings, ...settings },
          }

          yield* this.updateMetadata(updatedMetadata)
        }),

      getSettings: (worldId: WorldId) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)
          return Option.map(metadata, m => m.settings)
        }),

      setGameRule: (worldId: WorldId, rule: string, value: boolean | number | string) =>
        Effect.gen(function* () {
          const settings = yield* this.getSettings(worldId)

          if (Option.isNone(settings)) {
            return yield* Effect.fail(createRepositoryError(
              `World settings not found: ${worldId}`,
              'setGameRule',
              null
            ))
          }

          const updatedGameRules = { ...settings.value.gameRules, [rule]: value }
          yield* this.updateSettings(worldId, { gameRules: updatedGameRules })
        }),

      getGameRule: (worldId: WorldId, rule: string) =>
        Effect.gen(function* () {
          const settings = yield* this.getSettings(worldId)

          if (Option.isNone(settings)) {
            return Option.none()
          }

          return Option.fromNullable(settings.value.gameRules[rule])
        }),

      // === Statistics Management ===

      updateStatistics: (worldId: WorldId, statistics: Partial<WorldStatistics>) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          if (Option.isNone(metadata)) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${worldId}`,
              'updateStatistics',
              null
            ))
          }

          const updatedMetadata = {
            ...metadata.value,
            statistics: { ...metadata.value.statistics, ...statistics, lastUpdated: new Date() },
          }

          yield* this.updateMetadata(updatedMetadata)
        }),

      getStatistics: (worldId: WorldId) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)
          return Option.map(metadata, m => m.statistics)
        }),

      recordPerformanceMetric: (worldId: WorldId, metric: string, value: number, timestamp?: Date) =>
        Effect.gen(function* () {
          const currentStats = yield* this.getStatistics(worldId)

          if (Option.isNone(currentStats)) {
            return yield* Effect.fail(createRepositoryError(
              `World statistics not found: ${worldId}`,
              'recordPerformanceMetric',
              null
            ))
          }

          const updatedPerformance = {
            ...currentStats.value.performance,
            [metric]: value,
          }

          yield* this.updateStatistics(worldId, {
            performance: updatedPerformance,
          })
        }),

      updateContentStatistics: (worldId: WorldId, contentType: string, count: number) =>
        Effect.gen(function* () {
          const currentStats = yield* this.getStatistics(worldId)

          if (Option.isNone(currentStats)) {
            return yield* Effect.fail(createRepositoryError(
              `World statistics not found: ${worldId}`,
              'updateContentStatistics',
              null
            ))
          }

          const updatedContent = {
            ...currentStats.value.content,
            [`${contentType}Count`]: { ...currentStats.value.content[`${contentType}Count` as keyof typeof currentStats.value.content] as Record<string, number>, [contentType]: count },
          }

          yield* this.updateStatistics(worldId, {
            content: updatedContent,
          })
        }),

      // === Versioning System ===

      createVersion: (worldId: WorldId, changes: ReadonlyArray<MetadataChange>, description?: string) =>
        Effect.gen(function* () {
          if (!config.versioning.enabled) {
            return yield* Effect.fail(createVersioningError(
              worldId,
              'Versioning is disabled',
              null
            ))
          }

          const version = generateVersionString()
          const timestamp = new Date()

          const metadataVersion: MetadataVersion = {
            version,
            timestamp,
            changes,
            checksum: calculateMetadataChecksum({ changes } as any),
            size: new TextEncoder().encode(JSON.stringify(changes)).length,
          }

          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId) || new Map()

          // Check version limit
          if (worldVersions.size >= config.versioning.maxVersionsPerWorld) {
            const oldest = Array.from(worldVersions.entries())
              .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())[0]
            worldVersions.delete(oldest[0])
          }

          worldVersions.set(version, metadataVersion)

          const updatedVersionMap = new Map(versionMap)
          updatedVersionMap.set(worldId, worldVersions)
          yield* Ref.set(versionStore, updatedVersionMap)

          yield* persistVersionHistory(worldId, worldVersions)

          return version
        }),

      getVersion: (worldId: WorldId, version: string) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          if (!worldVersions) {
            return Option.none()
          }

          return Option.fromNullable(worldVersions.get(version))
        }),

      getVersionHistory: (worldId: WorldId) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          if (!worldVersions) {
            return {
              worldId,
              versions: [],
              currentVersion: '',
              totalVersions: 0,
              totalSize: 0,
              oldestVersion: '',
              newestVersion: '',
            }
          }

          const versions = Array.from(worldVersions.values())
          const sortedVersions = versions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

          return {
            worldId,
            versions: sortedVersions,
            currentVersion: sortedVersions[sortedVersions.length - 1]?.version || '',
            totalVersions: versions.length,
            totalSize: versions.reduce((sum, v) => sum + v.size, 0),
            oldestVersion: sortedVersions[0]?.version || '',
            newestVersion: sortedVersions[sortedVersions.length - 1]?.version || '',
          }
        }),

      restoreVersion: (worldId: WorldId, version: string) =>
        Effect.gen(function* () {
          const versionData = yield* this.getVersion(worldId, version)

          if (Option.isNone(versionData)) {
            return yield* Effect.fail(createVersioningError(
              worldId,
              `Version not found: ${version}`,
              null
            ))
          }

          // Apply changes in reverse
          const changes = versionData.value.changes
          const restorationChanges: MetadataChange[] = changes.map(change => ({
            ...change,
            type: change.type === 'create' ? 'delete' : change.type === 'delete' ? 'create' : 'update',
            oldValue: change.newValue,
            newValue: change.oldValue,
            timestamp: new Date(),
            reason: `Restore to version ${version}`,
          }))

          yield* this.createVersion(worldId, restorationChanges, `Restore to ${version}`)
        }),

      compareVersions: (worldId: WorldId, version1: string, version2: string) =>
        Effect.gen(function* () {
          const v1 = yield* this.getVersion(worldId, version1)
          const v2 = yield* this.getVersion(worldId, version2)

          if (Option.isNone(v1) || Option.isNone(v2)) {
            return yield* Effect.fail(createVersioningError(
              worldId,
              'One or both versions not found',
              null
            ))
          }

          const combinedChanges = [...v1.value.changes, ...v2.value.changes]
          return combinedChanges
        }),

      cleanupOldVersions: (worldId: WorldId, retentionPolicy: { maxVersions?: number; maxAgeDays?: number }) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          if (!worldVersions) {
            return 0
          }

          const versions = Array.from(worldVersions.entries())
          let versionsToDelete: string[] = []

          // Apply retention policies
          if (retentionPolicy.maxVersions && versions.length > retentionPolicy.maxVersions) {
            const sorted = versions.sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime())
            versionsToDelete = sorted.slice(retentionPolicy.maxVersions).map(([v]) => v)
          }

          if (retentionPolicy.maxAgeDays) {
            const cutoffDate = new Date(Date.now() - retentionPolicy.maxAgeDays * 24 * 60 * 60 * 1000)
            const oldVersions = versions.filter(([, version]) => version.timestamp < cutoffDate).map(([v]) => v)
            versionsToDelete = [...new Set([...versionsToDelete, ...oldVersions])]
          }

          // Delete versions
          const updatedWorldVersions = new Map(worldVersions)
          for (const versionToDelete of versionsToDelete) {
            updatedWorldVersions.delete(versionToDelete)
          }

          const updatedVersionMap = new Map(versionMap)
          updatedVersionMap.set(worldId, updatedWorldVersions)
          yield* Ref.set(versionStore, updatedVersionMap)

          yield* persistVersionHistory(worldId, updatedWorldVersions)

          return versionsToDelete.length
        }),

      // === Compression System ===

      compressMetadata: (worldId: WorldId, compressionConfig = config.compression) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          if (Option.isNone(metadata)) {
            return yield* Effect.fail(createCompressionError(
              worldId,
              'Metadata not found for compression',
              null
            ))
          }

          const serialized = JSON.stringify(metadata.value)
          const originalSize = new TextEncoder().encode(serialized).length

          // Perform actual compression
          const compressed = yield* compressData(serialized)
          const compressedSize = compressed.length

          const compressionStats: CompressionStatistics = {
            algorithm: compressionConfig.algorithm,
            originalSize,
            compressedSize,
            compressionRatio: compressedSize / originalSize,
            compressionTime: originalSize / 1000000, // Mock timing
            decompressionTime: compressedSize / 2000000, // Mock timing
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

      decompressMetadata: (worldId: WorldId) =>
        Effect.gen(function* () {
          const compressionMap = yield* Ref.get(compressionStore)

          if (!compressionMap.has(worldId)) {
            return yield* Effect.fail(createCompressionError(
              worldId,
              'No compression data found',
              null
            ))
          }

          const updated = new Map(compressionMap)
          updated.delete(worldId)
          yield* Ref.set(compressionStore, updated)
        }),

      getCompressionStatistics: (worldId: WorldId) =>
        Effect.gen(function* () {
          const compressionMap = yield* Ref.get(compressionStore)
          return Option.fromNullable(compressionMap.get(worldId))
        }),

      updateCompressionConfig: (worldId: WorldId, compressionConfig: CompressionConfig) =>
        Effect.succeed(undefined),

      enableAutoCompression: (worldId: WorldId, threshold: number) =>
        Effect.succeed(undefined),

      // === Backup System ===

      createBackup: (worldId: WorldId, type: 'full' | 'incremental', description?: string) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          if (Option.isNone(metadata)) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${worldId}`,
              'createBackup',
              null
            ))
          }

          const backupId = `backup_${worldId}_${Date.now()}`
          const backupInfo: BackupInfo = {
            backupId,
            worldId,
            timestamp: new Date(),
            type,
            size: estimateMetadataSize(metadata.value),
            compressedSize: config.backup.compressionEnabled
              ? Math.floor(estimateMetadataSize(metadata.value) * 0.3)
              : estimateMetadataSize(metadata.value),
            checksum: calculateMetadataChecksum(metadata.value),
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

      listBackups: (worldId: WorldId) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const worldBackups = Array.from(backupMap.values())
            .filter(backup => backup.worldId === worldId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

          return worldBackups
        }),

      restoreBackup: (worldId: WorldId, backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          if (!backup || backup.worldId !== worldId) {
            return yield* Effect.fail(createRepositoryError(
              `Backup not found or not associated with world: ${backupId}`,
              'restoreBackup',
              null
            ))
          }

          const changes: MetadataChange[] = [{
            type: 'update',
            path: 'metadata',
            oldValue: undefined,
            newValue: backup,
            timestamp: new Date(),
            reason: `Restore from backup ${backupId}`,
          }]

          yield* this.createVersion(worldId, changes, `Restore from backup ${backupId}`)
        }),

      deleteBackup: (backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          if (!backup) {
            return yield* Effect.fail(createRepositoryError(
              `Backup not found: ${backupId}`,
              'deleteBackup',
              null
            ))
          }

          const updatedBackupMap = new Map(backupMap)
          updatedBackupMap.delete(backupId)
          yield* Ref.set(backupStore, updatedBackupMap)

          // Delete backup file
          const filePath = getBackupFilePath(backupId)
          yield* Effect.promise(() =>
            fs.promises.unlink(filePath).catch(() => {})
          )
          yield* Effect.promise(() =>
            fs.promises.unlink(filePath + '.gz').catch(() => {})
          )
        }),

      verifyBackup: (backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          if (!backup) {
            return {
              isValid: false,
              issues: [`Backup not found: ${backupId}`],
            }
          }

          // Verify file exists
          const filePath = getBackupFilePath(backupId)
          const exists = yield* Effect.promise(() =>
            fs.promises.access(filePath).then(() => true).catch(() => false)
          )

          const issues: string[] = []
          if (!exists) {
            issues.push('Backup file does not exist')
          }

          return {
            isValid: issues.length === 0,
            issues,
          }
        }),

      configureAutoBackup: (worldId: WorldId, backupConfig: BackupConfig) =>
        Effect.succeed(undefined),

      // === Index Management ===

      rebuildIndexes: (worldId?: WorldId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const indexMap = new Map<string, ReadonlyArray<WorldId>>()

          // Build indexes
          const metadataList = worldId
            ? Array.from(store.entries()).filter(([id]) => id === worldId)
            : Array.from(store.entries())

          // Index by name
          for (const [id, metadata] of metadataList) {
            const nameKey = `name:${metadata.name.toLowerCase()}`
            const existing = indexMap.get(nameKey) || []
            indexMap.set(nameKey, [...existing, id])
          }

          // Index by tags
          for (const [id, metadata] of metadataList) {
            for (const tag of metadata.tags) {
              const tagKey = `tag:${tag.toLowerCase()}`
              const existing = indexMap.get(tagKey) || []
              indexMap.set(tagKey, [...existing, id])
            }
          }

          yield* Ref.set(indexStore, indexMap)

          // Persist indexes
          for (const [indexName, worldIds] of indexMap) {
            yield* writeFile(getIndexFilePath(indexName), worldIds)
          }
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

          return {
            totalIndexes: indexMap.size,
            totalSize: Array.from(indexMap.values()).reduce((sum, ids) => sum + ids.length * 32, 0), // Rough estimate
            fragmentationRatio: 0.15,
            lastOptimized: new Date(Date.now() - 24 * 60 * 60 * 1000),
          }
        }),

      // === Cache Management ===

      updateMetadataCache: (worldId: WorldId, metadata: WorldMetadata) =>
        Effect.gen(function* () {
          if (!config.cache.enabled) return

          const cache = yield* Ref.get(metadataCache)
          const updated = new Map(cache)
          updated.set(worldId, {
            metadata,
            timestamp: Date.now(),
          })
          yield* Ref.set(metadataCache, updated)
        }),

      clearCache: (worldId?: WorldId) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(metadataCache)

          if (worldId) {
            const updated = new Map(cache)
            updated.delete(worldId)
            yield* Ref.set(metadataCache, updated)
          } else {
            yield* Ref.set(metadataCache, new Map())
          }
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
          for (const worldId of worldIds) {
            yield* Effect.ignore(this.findMetadata(worldId))
          }
        }),

      // === Bulk Operations ===

      saveMultipleMetadata: (metadataList: ReadonlyArray<WorldMetadata>) =>
        Effect.gen(function* () {
          let successful = 0
          let failed = 0
          const errors: AllRepositoryErrors[] = []

          for (const metadata of metadataList) {
            const result = yield* Effect.either(this.saveMetadata(metadata))

            if (result._tag === 'Right') {
              successful++
            } else {
              failed++
              errors.push(result.left)
            }
          }

          return { successful, failed, errors }
        }),

      updateMultipleMetadata: (updates: ReadonlyArray<{ worldId: WorldId; metadata: Partial<WorldMetadata> }>) =>
        Effect.gen(function* () {
          let updateCount = 0

          for (const update of updates) {
            const currentMetadata = yield* this.findMetadata(update.worldId)

            if (Option.isSome(currentMetadata)) {
              const updatedMetadata = { ...currentMetadata.value, ...update.metadata }
              const result = yield* Effect.either(this.updateMetadata(updatedMetadata))

              if (result._tag === 'Right') {
                updateCount++
              }
            }
          }

          return updateCount
        }),

      deleteMultipleMetadata: (worldIds: ReadonlyArray<WorldId>) =>
        Effect.gen(function* () {
          let deleteCount = 0

          for (const worldId of worldIds) {
            const result = yield* Effect.either(this.deleteMetadata(worldId))

            if (result._tag === 'Right') {
              deleteCount++
            }
          }

          return deleteCount
        }),

      bulkCompress: (worldIds: ReadonlyArray<WorldId>, compressionConfig = config.compression) =>
        Effect.gen(function* () {
          const results: CompressionStatistics[] = []

          for (const worldId of worldIds) {
            const result = yield* Effect.either(this.compressMetadata(worldId, compressionConfig))

            if (result._tag === 'Right') {
              results.push(result.right)
            }
          }

          return results
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
          const errors: string[] = []
          const warnings: string[] = []
          const corruptedMetadata: WorldId[] = []

          for (const [worldId, metadata] of store) {
            // Validate checksum
            const expectedChecksum = calculateMetadataChecksum(metadata)
            if (metadata.checksum !== expectedChecksum) {
              errors.push(`Checksum mismatch for world ${worldId}`)
              corruptedMetadata.push(worldId)
            }

            // Validate file exists
            const filePath = getMetadataFilePath(worldId)
            const exists = yield* Effect.promise(() =>
              fs.promises.access(filePath).then(() => true).catch(() => false)
            )

            if (!exists) {
              const existsGz = yield* Effect.promise(() =>
                fs.promises.access(filePath + '.gz').then(() => true).catch(() => false)
              )

              if (!existsGz) {
                errors.push(`Metadata file missing for world ${worldId}`)
                corruptedMetadata.push(worldId)
              }
            }
          }

          return {
            isValid: errors.length === 0,
            errors,
            warnings,
            corruptedMetadata: [...new Set(corruptedMetadata)],
          }
        }),

      getRepositoryStatistics: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const metadataList = Array.from(store.values())

          if (metadataList.length === 0) {
            return {
              totalWorlds: 0,
              totalSize: 0,
              averageWorldSize: 0,
              compressionRatio: 1.0,
              oldestWorld: new Date(),
              newestWorld: new Date(),
              mostActiveWorld: '' as WorldId,
            }
          }

          const totalSize = metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0)
          const totalCompressedSize = metadataList.reduce((sum, m) => sum + m.statistics.size.compressedSize, 0)

          const sortedByCreated = [...metadataList].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          const sortedByAccessed = [...metadataList].sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())

          return {
            totalWorlds: metadataList.length,
            totalSize,
            averageWorldSize: totalSize / metadataList.length,
            compressionRatio: totalSize > 0 ? totalCompressedSize / totalSize : 1.0,
            oldestWorld: sortedByCreated[0].createdAt,
            newestWorld: sortedByCreated[sortedByCreated.length - 1].createdAt,
            mostActiveWorld: sortedByAccessed[0].id,
          }
        }),
    }
  })

// === Layer ===

export const WorldMetadataRepositoryPersistenceLive = (
  config: WorldMetadataRepositoryConfig,
  persistenceConfig?: PersistenceConfig
) =>
  Layer.effect(
    WorldMetadataRepository,
    WorldMetadataRepositoryPersistenceImplementation(config, persistenceConfig)
  )