/**
 * @fileoverview World Metadata Repository - Memory Implementation
 * ワールドメタデータリポジトリのメモリ実装
 *
 * 高速アクセス・完全な機能サポート
 * メタデータ管理・バージョニング・圧縮システム
 */

import { Effect, Option, ReadonlyArray, Ref, Layer } from 'effect'
import * as Schema from '@effect/schema/Schema'
import { WorldClock } from '../../time'
import type {
  WorldId,
} from '../../types'
import { WorldIdSchema } from '../../types/core/world-types'
import type { AllRepositoryErrors } from '../types'
import {
  createRepositoryError,
  createDataIntegrityError,
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

// === Implementation ===

export const WorldMetadataRepositoryMemoryImplementation = (
  config: WorldMetadataRepositoryConfig
): Effect.Effect<WorldMetadataRepository, AllRepositoryErrors> =>
  Effect.gen(function* () {
    // State references
    const metadataStore = yield* Ref.make(new Map<WorldId, WorldMetadata>())
    const versionStore = yield* Ref.make(new Map<WorldId, Map<string, MetadataVersion>>())
    const versionHistoryStore = yield* Ref.make(new Map<WorldId, VersionHistory>())
    const compressionStore = yield* Ref.make(new Map<WorldId, CompressionStatistics>())
    const backupStore = yield* Ref.make(new Map<string, BackupInfo>())
    const worldBackupsStore = yield* Ref.make(new Map<WorldId, ReadonlyArray<string>>()) // WorldId -> BackupIds

    // Cache references
    const metadataCache = yield* Ref.make(new Map<WorldId, { metadata: WorldMetadata; timestamp: number }>())
    const statisticsCache = yield* Ref.make(new Map<WorldId, { statistics: WorldStatistics; timestamp: number }>())
    const settingsCache = yield* Ref.make(new Map<WorldId, { settings: WorldSettings; timestamp: number }>())

    const EMPTY_WORLD_ID = Schema.decodeSync(WorldIdSchema)('world_placeholder')

    // Statistics tracking
    const cacheStats = yield* Ref.make({
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
    })
    const versionSequence = yield* Ref.make(0)

    // === Utility Functions ===

    const ttlMilliseconds = config.cache.ttlSeconds * 1000

    const currentMillis = Effect.flatMap(Effect.service(WorldClock), (clock) => clock.currentMillis)
    const currentDate = Effect.flatMap(Effect.service(WorldClock), (clock) => clock.currentDate)

    const isCacheExpired = (now: number, timestamp: number): boolean =>
      now - timestamp > ttlMilliseconds

    const updateChecksum = (metadata: WorldMetadata): Effect.Effect<WorldMetadata> =>
      Effect.map(currentDate, (now) => ({
        ...metadata,
        checksum: calculateMetadataChecksum(metadata),
        lastModified: now,
      }))

    const checksumFromString = (input: string): string => {
      let hash = 0
      for (let index = 0; index < input.length; index += 1) {
        const char = input.charCodeAt(index)
        hash = (hash << 5) - hash + char
        hash |= 0
      }
      return hash.toString(16)
    }

    const createMetadataVersion = (
      worldId: WorldId,
      changes: ReadonlyArray<MetadataChange>,
      description?: string
    ): Effect.Effect<MetadataVersion> =>
      Effect.gen(function* () {
        const millis = yield* currentMillis
        const sequence = yield* Ref.modify(versionSequence, (current) => [current, current + 1])
        const version = generateVersionString(millis, sequence)
        const timestamp = yield* currentDate
        const changesSerialized = JSON.stringify(changes)

        return {
          version,
          timestamp,
          changes,
          checksum: checksumFromString(changesSerialized),
          size: new TextEncoder().encode(changesSerialized).length,
          parentVersion: undefined,
        }
      })

    const simulateCompression = (
      data: unknown,
      compressionConfig: CompressionConfig
    ): CompressionStatistics => {
      const serialized = JSON.stringify(data)
      const originalSize = new TextEncoder().encode(serialized).length

      // Simulate compression ratios based on algorithm
      const compressionRatios = {
        gzip: 0.3,
        deflate: 0.35,
        brotli: 0.25,
        lz4: 0.5,
      }

      const compressionRatio = compressionRatios[compressionConfig.algorithm]
      const compressedSize = Math.floor(originalSize * compressionRatio)

      return {
        algorithm: compressionConfig.algorithm,
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime: originalSize / 1000000, // Mock: 1MB/sec
        decompressionTime: compressedSize / 2000000, // Mock: 2MB/sec
        dictionarySize: compressionConfig.enableDictionary ? 64 * 1024 : 0,
        chunksProcessed: Math.ceil(originalSize / compressionConfig.chunkSize),
        deduplicationSavings: compressionConfig.enableDeduplication ? originalSize * 0.1 : 0,
      }
    }

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

          // Update cache if enabled
          if (config.cache.enabled) {
            const cache = yield* Ref.get(metadataCache)
            const updatedCache = new Map(cache)
            const timestamp = yield* currentMillis
            updatedCache.set(metadata.id, {
              metadata: updatedMetadata,
              timestamp,
            })
            yield* Ref.set(metadataCache, updatedCache)
          }

          // Create version if versioning is enabled
          if (config.versioning.enabled && config.versioning.automaticVersioning) {
            const timestamp = yield* currentDate
            const changes: MetadataChange[] = [{
              type: store.has(metadata.id) ? 'update' : 'create',
              path: 'metadata',
              oldValue: store.get(metadata.id),
              newValue: updatedMetadata,
              timestamp,
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

            if (cached) {
              const now = yield* currentMillis
              if (!isCacheExpired(now, cached.timestamp)) {
                yield* Ref.update(cacheStats, stats => ({ ...stats, hitCount: stats.hitCount + 1 }))
                return Option.some(cached.metadata)
              }
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
            const timestamp = yield* currentMillis
            updatedCache.set(worldId, {
              metadata,
              timestamp,
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
          const updatedMetadata = yield* updateChecksum(metadata)
          const updated = new Map(store)
          updated.set(metadata.id, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          // Update cache
          if (config.cache.enabled) {
            const cache = yield* Ref.get(metadataCache)
            const updatedCache = new Map(cache)
            const timestamp = yield* currentMillis
            updatedCache.set(metadata.id, {
              metadata: updatedMetadata,
              timestamp,
            })
            yield* Ref.set(metadataCache, updatedCache)
          }

          // Create version if enabled
          if (config.versioning.enabled && config.versioning.automaticVersioning) {
            const timestamp = yield* currentDate
            const changes: MetadataChange[] = [{
              type: 'update',
              path: 'metadata',
              oldValue: oldMetadata,
              newValue: updatedMetadata,
              timestamp,
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

          // Remove from caches
          if (config.cache.enabled) {
            const metaCache = yield* Ref.get(metadataCache)
            const statsCache = yield* Ref.get(statisticsCache)
            const setCache = yield* Ref.get(settingsCache)

            const updatedMetaCache = new Map(metaCache)
            const updatedStatsCache = new Map(statsCache)
            const updatedSetCache = new Map(setCache)

            updatedMetaCache.delete(worldId)
            updatedStatsCache.delete(worldId)
            updatedSetCache.delete(worldId)

            yield* Ref.set(metadataCache, updatedMetaCache)
            yield* Ref.set(statisticsCache, updatedStatsCache)
            yield* Ref.set(settingsCache, updatedSetCache)
          }

          // Create deletion version
          if (config.versioning.enabled) {
            const timestamp = yield* currentDate
            const changes: MetadataChange[] = [{
              type: 'delete',
              path: 'metadata',
              oldValue: oldMetadata,
              newValue: undefined,
              timestamp,
              reason: 'Metadata deletion',
            }]

            yield* Effect.ignore(this.createVersion(worldId, changes, 'Deletion'))
          }

          // Clean up related data
          const versionMap = yield* Ref.get(versionStore)
          const updatedVersionMap = new Map(versionMap)
          updatedVersionMap.delete(worldId)
          yield* Ref.set(versionStore, updatedVersionMap)

          const versionHistoryMap = yield* Ref.get(versionHistoryStore)
          const updatedVersionHistoryMap = new Map(versionHistoryMap)
          updatedVersionHistoryMap.delete(worldId)
          yield* Ref.set(versionHistoryStore, updatedVersionHistoryMap)
        }),

      searchMetadata: (query: MetadataQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          let candidates = Array.from(store.values())

          // Apply filters
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

          if (query.generatorId) {
            candidates = candidates.filter(m => m.generatorId === query.generatorId)
          }

          if (query.gameMode) {
            candidates = candidates.filter(m => m.settings.gameMode === query.gameMode)
          }

          if (query.difficulty) {
            candidates = candidates.filter(m => m.settings.difficulty === query.difficulty)
          }

          if (query.worldType) {
            candidates = candidates.filter(m => m.settings.worldType === query.worldType)
          }

          if (query.createdAfter) {
            candidates = candidates.filter(m => m.createdAt >= query.createdAfter!)
          }

          if (query.createdBefore) {
            candidates = candidates.filter(m => m.createdAt <= query.createdBefore!)
          }

          if (query.modifiedAfter) {
            candidates = candidates.filter(m => m.lastModified >= query.modifiedAfter!)
          }

          if (query.modifiedBefore) {
            candidates = candidates.filter(m => m.lastModified <= query.modifiedBefore!)
          }

          if (query.minSize !== undefined) {
            candidates = candidates.filter(m =>
              m.statistics.size.uncompressedSize >= query.minSize!
            )
          }

          if (query.maxSize !== undefined) {
            candidates = candidates.filter(m =>
              m.statistics.size.uncompressedSize <= query.maxSize!
            )
          }

          // Sort results
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

          // Limit results
          if (query.limit) {
            candidates = candidates.slice(0, query.limit)
          }

          // Create search results
          const results: MetadataSearchResult[] = candidates.map(metadata => ({
            metadata,
            relevanceScore: 1.0, // Simplified scoring
            matchedFields: ['name'], // Simplified field matching
            snippet: metadata.description ? metadata.description.substring(0, 100) + '...' : undefined,
          }))

          return results
        }),

      // === Settings Management ===

      updateSettings: (worldId: WorldId, settings: Partial<WorldSettings>) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          if (!metadata) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${worldId}`,
              'updateSettings',
              null
            ))
          }

          const updatedMetadata = yield* updateChecksum({
            ...metadata,
            settings: { ...metadata.settings, ...settings },
          })

          const updated = new Map(store)
          updated.set(worldId, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          // Update settings cache
          if (config.cache.enabled && config.cache.enableSettingsCache) {
            const cache = yield* Ref.get(settingsCache)
            const updatedCache = new Map(cache)
            const timestamp = yield* currentMillis
            updatedCache.set(worldId, {
              settings: updatedMetadata.settings,
              timestamp,
            })
            yield* Ref.set(settingsCache, updatedCache)
          }
        }),

      getSettings: (worldId: WorldId) =>
        Effect.gen(function* () {
          // Try cache first
          if (config.cache.enabled && config.cache.enableSettingsCache) {
            const cache = yield* Ref.get(settingsCache)
            const cached = cache.get(worldId)

            if (cached) {
              const now = yield* currentMillis
              if (!isCacheExpired(now, cached.timestamp)) {
                return Option.some(cached.settings)
              }
            }
          }

          // Fallback to store
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          if (metadata && config.cache.enabled && config.cache.enableSettingsCache) {
            // Update cache
            const cache = yield* Ref.get(settingsCache)
            const updatedCache = new Map(cache)
            const timestamp = yield* currentMillis
            updatedCache.set(worldId, {
              settings: metadata.settings,
              timestamp,
            })
            yield* Ref.set(settingsCache, updatedCache)
          }

          return Option.fromNullable(metadata?.settings)
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
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          if (!metadata) {
            return yield* Effect.fail(createRepositoryError(
              `World metadata not found: ${worldId}`,
              'updateStatistics',
              null
            ))
          }

          const lastUpdated = yield* currentDate
          const updatedMetadata = yield* updateChecksum({
            ...metadata,
            statistics: { ...metadata.statistics, ...statistics, lastUpdated },
          })

          const updated = new Map(store)
          updated.set(worldId, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          // Update statistics cache
          if (config.cache.enabled && config.cache.enableStatisticsCache) {
            const cache = yield* Ref.get(statisticsCache)
            const updatedCache = new Map(cache)
            const timestamp = yield* currentMillis
            updatedCache.set(worldId, {
              statistics: updatedMetadata.statistics,
              timestamp,
            })
            yield* Ref.set(statisticsCache, updatedCache)
          }
        }),

      getStatistics: (worldId: WorldId) =>
        Effect.gen(function* () {
          // Try cache first
          if (config.cache.enabled && config.cache.enableStatisticsCache) {
            const cache = yield* Ref.get(statisticsCache)
            const cached = cache.get(worldId)

            if (cached) {
              const now = yield* currentMillis
              if (!isCacheExpired(now, cached.timestamp)) {
                return Option.some(cached.statistics)
              }
            }
          }

          // Fallback to store
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          if (metadata && config.cache.enabled && config.cache.enableStatisticsCache) {
            // Update cache
            const cache = yield* Ref.get(statisticsCache)
            const updatedCache = new Map(cache)
            const timestamp = yield* currentMillis
            updatedCache.set(worldId, {
              statistics: metadata.statistics,
              timestamp,
            })
            yield* Ref.set(statisticsCache, updatedCache)
          }

          return Option.fromNullable(metadata?.statistics)
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

          // Simple implementation - would be more sophisticated in real implementation
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

          const currentContent = currentStats.value.content
          const updateCounter = (source: Record<string, number>) => ({
            ...source,
            [contentType]: count,
          })

          const nextContent = (() => {
            switch (contentType) {
              case 'biome':
                return { ...currentContent, biomeCount: updateCounter(currentContent.biomeCount) }
              case 'structure':
                return { ...currentContent, structureCount: updateCounter(currentContent.structureCount) }
              case 'entity':
                return { ...currentContent, entityCount: updateCounter(currentContent.entityCount) }
              case 'tileEntity':
                return { ...currentContent, tileEntityCount: updateCounter(currentContent.tileEntityCount) }
              default:
                return currentContent
            }
          })()

          if (nextContent === currentContent) {
            return
          }

          yield* this.updateStatistics(worldId, {
            content: nextContent,
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

          const version = yield* createMetadataVersion(worldId, changes, description)

          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId) || new Map()

          // Check version limit
          if (worldVersions.size >= config.versioning.maxVersionsPerWorld) {
            // Remove oldest version
            const oldest = Array.from(worldVersions.entries())
              .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())[0]
            worldVersions.delete(oldest[0])
          }

          worldVersions.set(version.version, version)

          const updatedVersionMap = new Map(versionMap)
          updatedVersionMap.set(worldId, worldVersions)
          yield* Ref.set(versionStore, updatedVersionMap)

          // Update version history
          const historyMap = yield* Ref.get(versionHistoryStore)
          const currentHistory = historyMap.get(worldId)

          const updatedHistory: VersionHistory = {
            worldId,
            versions: currentHistory ? [...currentHistory.versions, version] : [version],
            currentVersion: version.version,
            totalVersions: (currentHistory?.totalVersions || 0) + 1,
            totalSize: (currentHistory?.totalSize || 0) + version.size,
            oldestVersion: currentHistory?.oldestVersion || version.version,
            newestVersion: version.version,
          }

          const updatedHistoryMap = new Map(historyMap)
          updatedHistoryMap.set(worldId, updatedHistory)
          yield* Ref.set(versionHistoryStore, updatedHistoryMap)

          return version.version
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
          const historyMap = yield* Ref.get(versionHistoryStore)
          const history = historyMap.get(worldId)

          if (!history) {
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

          return history
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

          // Apply changes in reverse (simplified implementation)
          const changes = versionData.value.changes
          const timestamp = yield* currentDate
          const restorationChanges: MetadataChange[] = changes.map(change => ({
            ...change,
            type: change.type === 'create' ? 'delete' : change.type === 'delete' ? 'create' : 'update',
            oldValue: change.newValue,
            newValue: change.oldValue,
            timestamp,
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

          // Simplified comparison - return combined changes
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
            const now = yield* currentMillis
            const cutoffMillis = now - retentionPolicy.maxAgeDays * 24 * 60 * 60 * 1000
            const cutoffDate = new Date(cutoffMillis)
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

          const compressionStats = simulateCompression(metadata.value, compressionConfig)

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

          // Simulate decompression
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
        Effect.succeed(undefined), // Mock implementation

      enableAutoCompression: (worldId: WorldId, threshold: number) =>
        Effect.succeed(undefined), // Mock implementation

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

          const millis = yield* currentMillis
          const backupId = `backup_${worldId}_${millis}`
          const timestamp = yield* currentDate
          const size = estimateMetadataSize(metadata.value)
          const compressedSize = config.backup.compressionEnabled ? Math.floor(size * 0.3) : size
          const backupInfo: BackupInfo = {
            backupId,
            worldId,
            timestamp,
            type,
            size,
            compressedSize,
            checksum: calculateMetadataChecksum(metadata.value),
            isEncrypted: config.backup.encryptionEnabled,
            description,
          }

          const backupMap = yield* Ref.get(backupStore)
          const worldBackupMap = yield* Ref.get(worldBackupsStore)

          const updatedBackupMap = new Map(backupMap)
          updatedBackupMap.set(backupId, backupInfo)
          yield* Ref.set(backupStore, updatedBackupMap)

          const currentBackups = worldBackupMap.get(worldId) || []
          const updatedWorldBackupMap = new Map(worldBackupMap)
          updatedWorldBackupMap.set(worldId, [...currentBackups, backupId])
          yield* Ref.set(worldBackupsStore, updatedWorldBackupMap)

          return backupInfo
        }),

      listBackups: (worldId: WorldId) =>
        Effect.gen(function* () {
          const worldBackupMap = yield* Ref.get(worldBackupsStore)
          const backupMap = yield* Ref.get(backupStore)

          const backupIds = worldBackupMap.get(worldId) || []
          const backups = backupIds
            .map(id => backupMap.get(id))
            .filter((backup): backup is BackupInfo => backup !== undefined)

          return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
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

          // Mock restoration - in real implementation would restore actual data
          const timestamp = yield* currentDate
          const changes: MetadataChange[] = [{
            type: 'update',
            path: 'metadata',
            oldValue: undefined,
            newValue: backup,
            timestamp,
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

          // Remove from world backup list
          const worldBackupMap = yield* Ref.get(worldBackupsStore)
          const currentBackups = worldBackupMap.get(backup.worldId) || []
          const filteredBackups = currentBackups.filter(id => id !== backupId)

          const updatedWorldBackupMap = new Map(worldBackupMap)
          updatedWorldBackupMap.set(backup.worldId, filteredBackups)
          yield* Ref.set(worldBackupsStore, updatedWorldBackupMap)
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

          // Mock verification
          return {
            isValid: true,
            issues: [],
          }
        }),

      configureAutoBackup: (worldId: WorldId, backupConfig: BackupConfig) =>
        Effect.succeed(undefined), // Mock implementation

      // === Index Management ===

      rebuildIndexes: (worldId?: WorldId) =>
        Effect.succeed(undefined), // Mock implementation

      optimizeIndexes: () =>
        Effect.succeed({
          beforeSize: 1024 * 1024, // 1MB
          afterSize: 800 * 1024,   // 800KB
          improvementRatio: 0.2,
        }),

      getIndexStatistics: () =>
        Effect.gen(function* () {
          const now = yield* currentMillis
          const lastOptimizedMillis = now - 24 * 60 * 60 * 1000
          return {
            totalIndexes: 5,
            totalSize: 800 * 1024,
            fragmentationRatio: 0.15,
            lastOptimized: new Date(lastOptimizedMillis),
          }
        }),

      // === Cache Management ===

      updateMetadataCache: (worldId: WorldId, metadata: WorldMetadata) =>
        Effect.gen(function* () {
          if (!config.cache.enabled) return

          const cache = yield* Ref.get(metadataCache)
          const updated = new Map(cache)
          const timestamp = yield* currentMillis
          updated.set(worldId, {
            metadata,
            timestamp,
          })
          yield* Ref.set(metadataCache, updated)
        }),

      clearCache: (worldId?: WorldId) =>
        Effect.gen(function* () {
          if (worldId) {
            const metaCache = yield* Ref.get(metadataCache)
            const statsCache = yield* Ref.get(statisticsCache)
            const setCache = yield* Ref.get(settingsCache)

            const updatedMetaCache = new Map(metaCache)
            const updatedStatsCache = new Map(statsCache)
            const updatedSetCache = new Map(setCache)

            updatedMetaCache.delete(worldId)
            updatedStatsCache.delete(worldId)
            updatedSetCache.delete(worldId)

            yield* Ref.set(metadataCache, updatedMetaCache)
            yield* Ref.set(statisticsCache, updatedStatsCache)
            yield* Ref.set(settingsCache, updatedSetCache)
          } else {
            yield* Ref.set(metadataCache, new Map())
            yield* Ref.set(statisticsCache, new Map())
            yield* Ref.set(settingsCache, new Map())
          }
        }),

      getCacheStatistics: () =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(cacheStats)
          const metaCache = yield* Ref.get(metadataCache)
          const total = stats.hitCount + stats.missCount

          return {
            hitRate: total > 0 ? stats.hitCount / total : 0,
            missRate: total > 0 ? stats.missCount / total : 0,
            size: metaCache.size,
            maxSize: config.cache.maxSize,
            evictionCount: stats.evictionCount,
          }
        }),

      warmupCache: (worldIds: ReadonlyArray<WorldId>) =>
        Effect.gen(function* () {
          for (const worldId of worldIds) {
            yield* Effect.ignore(this.findMetadata(worldId))
            yield* Effect.ignore(this.getSettings(worldId))
            yield* Effect.ignore(this.getStatistics(worldId))
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
          // Initialize caches and indexes
          yield* Ref.set(metadataCache, new Map())
          yield* Ref.set(statisticsCache, new Map())
          yield* Ref.set(settingsCache, new Map())
        }),

      cleanup: () =>
        Effect.gen(function* () {
          // Clear all caches
          yield* this.clearCache()

          // Reset statistics
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

            // Validate required fields
            if (!metadata.name || !metadata.id) {
              errors.push(`Missing required fields for world ${worldId}`)
              corruptedMetadata.push(worldId)
            }

            // Validate dates
            if (metadata.createdAt > metadata.lastModified) {
              warnings.push(`Creation date after modification date for world ${worldId}`)
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

export const WorldMetadataRepositoryMemoryLive = (config: WorldMetadataRepositoryConfig) =>
  Layer.effect(
    WorldMetadataRepository,
    WorldMetadataRepositoryMemoryImplementation(config)
  )