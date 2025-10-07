/**
 * @fileoverview World Metadata Repository - Memory Implementation
 * ワールドメタデータリポジトリのメモリ実装
 *
 * 高速アクセス・完全な機能サポート
 * メタデータ管理・バージョニング・圧縮システム
 */

import type { AllRepositoryErrors, WorldId } from '@domain/world/types'
import { createCompressionError, createRepositoryError, createVersioningError } from '@domain/world/types'
import { DateTime, Effect, Layer, Match, Option, pipe, ReadonlyArray, Ref } from 'effect'
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
  VersionHistory,
  WorldMetadata,
  WorldMetadataRepository,
  WorldMetadataRepositoryConfig,
  WorldSettings,
  WorldStatistics,
} from './index'

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

    const isCacheExpired = (now: number, timestamp: number): boolean => now - timestamp > ttlMilliseconds

    const updateChecksum = (metadata: WorldMetadata): Effect.Effect<WorldMetadata> =>
      Effect.map(currentDate, (now) => ({
        ...metadata,
        checksum: calculateMetadataChecksum(metadata),
        lastModified: now,
      }))

    const checksumFromString = (input: string): string =>
      pipe(
        ReadonlyArray.makeBy(input.length, (index) => ({
          char: input.charCodeAt(index),
        })),
        ReadonlyArray.reduce(0, (hash, { char }) => {
          const updated = (hash << 5) - hash + char
          return updated | 0
        }),
        (hash) => hash.toString(16)
      )

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

    const simulateCompression = (data: unknown, compressionConfig: CompressionConfig): CompressionStatistics => {
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

          // Create version if versioning is enabled
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
          // Try cache first
          const cacheResult = yield* Effect.if(config.cache.enabled, {
            onTrue: () =>
              Effect.gen(function* () {
                const cache = yield* Ref.get(metadataCache)
                const cached = cache.get(worldId)

                return yield* pipe(
                  Option.fromNullable(cached),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<WorldMetadata>()),
                    onSome: (cachedData) =>
                      Effect.gen(function* () {
                        const now = yield* currentMillis
                        return yield* Effect.if(!isCacheExpired(now, cachedData.timestamp), {
                          onTrue: () =>
                            Effect.gen(function* () {
                              yield* Ref.update(cacheStats, (stats) => ({ ...stats, hitCount: stats.hitCount + 1 }))
                              return Option.some(cachedData.metadata)
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
            cacheResult,
            Option.match({
              onSome: (metadata) => Effect.succeed(Option.some(metadata)),
              onNone: () =>
                Effect.gen(function* () {
                  // Fallback to store
                  const store = yield* Ref.get(metadataStore)
                  const metadata = store.get(worldId)

                  yield* Ref.update(cacheStats, (stats) => ({ ...stats, missCount: stats.missCount + 1 }))

                  yield* Effect.when(metadata !== undefined && config.cache.enabled, () =>
                    Effect.gen(function* () {
                      const cache = yield* Ref.get(metadataCache)
                      const updatedCache = new Map(cache)
                      const timestamp = yield* currentMillis
                      updatedCache.set(worldId, {
                        metadata,
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

          yield* Effect.filterOrFail(
            store.has(metadata.id),
            (hasMetadata) => hasMetadata,
            () => createRepositoryError(`World metadata not found: ${metadata.id}`, 'updateMetadata', null)
          )

          const oldMetadata = store.get(metadata.id)!
          const updatedMetadata = yield* updateChecksum(metadata)
          const updated = new Map(store)
          updated.set(metadata.id, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

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

          yield* Effect.filterOrFail(
            store.has(worldId),
            (hasMetadata) => hasMetadata,
            () => createRepositoryError(`World metadata not found: ${worldId}`, 'deleteMetadata', null)
          )

          const oldMetadata = store.get(worldId)!
          const updated = new Map(store)
          updated.delete(worldId)
          yield* Ref.set(metadataStore, updated)

          // Remove from caches
          yield* Effect.when(config.cache.enabled, () =>
            Effect.gen(function* () {
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

          const candidates = pipe(
            Array.from(store.values()),
            // Apply filters using pure function composition
            ReadonlyArray.filter((m) => !query.worldId || m.id === query.worldId),
            ReadonlyArray.filter((m) => !query.name || m.name.toLowerCase().includes(query.name.toLowerCase())),
            ReadonlyArray.filter(
              (m) => !query.tags || query.tags.length === 0 || query.tags.some((tag) => m.tags.includes(tag))
            ),
            ReadonlyArray.filter((m) => !query.generatorId || m.generatorId === query.generatorId),
            ReadonlyArray.filter((m) => !query.gameMode || m.settings.gameMode === query.gameMode),
            ReadonlyArray.filter((m) => !query.difficulty || m.settings.difficulty === query.difficulty),
            ReadonlyArray.filter((m) => !query.worldType || m.settings.worldType === query.worldType),
            ReadonlyArray.filter((m) => !query.createdAfter || m.createdAt >= query.createdAfter),
            ReadonlyArray.filter((m) => !query.createdBefore || m.createdAt <= query.createdBefore),
            ReadonlyArray.filter((m) => !query.modifiedAfter || m.lastModified >= query.modifiedAfter),
            ReadonlyArray.filter((m) => !query.modifiedBefore || m.lastModified <= query.modifiedBefore),
            ReadonlyArray.filter(
              (m) => query.minSize === undefined || m.statistics.size.uncompressedSize >= query.minSize
            ),
            ReadonlyArray.filter(
              (m) => query.maxSize === undefined || m.statistics.size.uncompressedSize <= query.maxSize
            ),
            // Sort results if sortBy is specified
            (items) =>
              query.sortBy
                ? pipe(
                    items,
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
                : items,
            // Limit results if specified
            (items) => (query.limit ? pipe(items, ReadonlyArray.take(query.limit)) : items),
            // Create search results
            ReadonlyArray.map((metadata) => ({
              metadata,
              relevanceScore: 1.0,
              matchedFields: ['name'] as const,
              snippet: metadata.description ? metadata.description.substring(0, 100) + '...' : undefined,
            }))
          )

          return candidates
        }),

      // === Settings Management ===

      updateSettings: (worldId: WorldId, settings: Partial<WorldSettings>) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          yield* Effect.filterOrFail(
            metadata,
            (m): m is WorldMetadata => m !== undefined,
            () => createRepositoryError(`World metadata not found: ${worldId}`, 'updateSettings', null)
          )

          const updatedMetadata = yield* updateChecksum({
            ...metadata,
            settings: { ...metadata.settings, ...settings },
          })

          const updated = new Map(store)
          updated.set(worldId, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          // Update settings cache
          yield* Effect.when(config.cache.enabled && config.cache.enableSettingsCache, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(settingsCache)
              const updatedCache = new Map(cache)
              const timestamp = yield* currentMillis
              updatedCache.set(worldId, {
                settings: updatedMetadata.settings,
                timestamp,
              })
              yield* Ref.set(settingsCache, updatedCache)
            })
          )
        }),

      getSettings: (worldId: WorldId) =>
        Effect.gen(function* () {
          // Try cache first
          const cacheResult = yield* Effect.if(config.cache.enabled && config.cache.enableSettingsCache, {
            onTrue: () =>
              Effect.gen(function* () {
                const cache = yield* Ref.get(settingsCache)
                const cached = cache.get(worldId)

                return yield* pipe(
                  Option.fromNullable(cached),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<WorldSettings>()),
                    onSome: (cachedData) =>
                      Effect.gen(function* () {
                        const now = yield* currentMillis
                        return !isCacheExpired(now, cachedData.timestamp)
                          ? Option.some(cachedData.settings)
                          : Option.none<WorldSettings>()
                      }),
                  })
                )
              }),
            onFalse: () => Effect.succeed(Option.none<WorldSettings>()),
          })

          return yield* pipe(
            cacheResult,
            Option.match({
              onSome: (settings) => Effect.succeed(Option.some(settings)),
              onNone: () =>
                Effect.gen(function* () {
                  // Fallback to store
                  const store = yield* Ref.get(metadataStore)
                  const metadata = store.get(worldId)

                  yield* Effect.when(
                    metadata !== undefined && config.cache.enabled && config.cache.enableSettingsCache,
                    () =>
                      Effect.gen(function* () {
                        const cache = yield* Ref.get(settingsCache)
                        const updatedCache = new Map(cache)
                        const timestamp = yield* currentMillis
                        updatedCache.set(worldId, {
                          settings: metadata.settings,
                          timestamp,
                        })
                        yield* Ref.set(settingsCache, updatedCache)
                      })
                  )

                  return Option.fromNullable(metadata?.settings)
                }),
            })
          )
        }),

      setGameRule: (worldId: WorldId, rule: string, value: boolean | number | string) =>
        Effect.gen(function* () {
          const settings = yield* this.getSettings(worldId)

          yield* pipe(
            settings,
            Option.match({
              onNone: () =>
                Effect.fail(createRepositoryError(`World settings not found: ${worldId}`, 'setGameRule', null)),
              onSome: (s) =>
                Effect.gen(function* () {
                  const updatedGameRules = { ...s.gameRules, [rule]: value }
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
            Option.flatMap((s) => Option.fromNullable(s.gameRules[rule]))
          )
        }),

      // === Statistics Management ===

      updateStatistics: (worldId: WorldId, statistics: Partial<WorldStatistics>) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(metadataStore)
          const metadata = store.get(worldId)

          yield* Effect.filterOrFail(
            metadata,
            (m): m is WorldMetadata => m !== undefined,
            () => createRepositoryError(`World metadata not found: ${worldId}`, 'updateStatistics', null)
          )

          const lastUpdated = yield* currentDate
          const updatedMetadata = yield* updateChecksum({
            ...metadata,
            statistics: { ...metadata.statistics, ...statistics, lastUpdated },
          })

          const updated = new Map(store)
          updated.set(worldId, updatedMetadata)
          yield* Ref.set(metadataStore, updated)

          // Update statistics cache
          yield* Effect.when(config.cache.enabled && config.cache.enableStatisticsCache, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(statisticsCache)
              const updatedCache = new Map(cache)
              const timestamp = yield* currentMillis
              updatedCache.set(worldId, {
                statistics: updatedMetadata.statistics,
                timestamp,
              })
              yield* Ref.set(statisticsCache, updatedCache)
            })
          )
        }),

      getStatistics: (worldId: WorldId) =>
        Effect.gen(function* () {
          // Try cache first
          const cacheResult = yield* Effect.if(config.cache.enabled && config.cache.enableStatisticsCache, {
            onTrue: () =>
              Effect.gen(function* () {
                const cache = yield* Ref.get(statisticsCache)
                const cached = cache.get(worldId)

                return yield* pipe(
                  Option.fromNullable(cached),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<WorldStatistics>()),
                    onSome: (cachedData) =>
                      Effect.gen(function* () {
                        const now = yield* currentMillis
                        return !isCacheExpired(now, cachedData.timestamp)
                          ? Option.some(cachedData.statistics)
                          : Option.none<WorldStatistics>()
                      }),
                  })
                )
              }),
            onFalse: () => Effect.succeed(Option.none<WorldStatistics>()),
          })

          return yield* pipe(
            cacheResult,
            Option.match({
              onSome: (statistics) => Effect.succeed(Option.some(statistics)),
              onNone: () =>
                Effect.gen(function* () {
                  // Fallback to store
                  const store = yield* Ref.get(metadataStore)
                  const metadata = store.get(worldId)

                  yield* Effect.when(
                    metadata !== undefined && config.cache.enabled && config.cache.enableStatisticsCache,
                    () =>
                      Effect.gen(function* () {
                        const cache = yield* Ref.get(statisticsCache)
                        const updatedCache = new Map(cache)
                        const timestamp = yield* currentMillis
                        updatedCache.set(worldId, {
                          statistics: metadata.statistics,
                          timestamp,
                        })
                        yield* Ref.set(statisticsCache, updatedCache)
                      })
                  )

                  return Option.fromNullable(metadata?.statistics)
                }),
            })
          )
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
              onSome: (stats) =>
                Effect.gen(function* () {
                  const updatedPerformance = {
                    ...stats.performance,
                    [metric]: value,
                  }

                  yield* this.updateStatistics(worldId, {
                    performance: updatedPerformance,
                  })
                }),
            })
          )
        }),

      updateContentStatistics: (worldId: WorldId, contentType: string, count: number) =>
        Effect.gen(function* () {
          const currentStats = yield* this.getStatistics(worldId)

          yield* pipe(
            currentStats,
            Option.match({
              onNone: () =>
                Effect.fail(
                  createRepositoryError(`World statistics not found: ${worldId}`, 'updateContentStatistics', null)
                ),
              onSome: (stats) =>
                Effect.gen(function* () {
                  const updatedContent = {
                    ...stats.content,
                    [`${contentType}Count`]: {
                      ...(stats.content[`${contentType}Count` as keyof typeof stats.content] as Record<string, number>),
                      [contentType]: count,
                    },
                  }

                  yield* this.updateStatistics(worldId, {
                    content: updatedContent,
                  })
                }),
            })
          )
        }),

      // === Versioning System ===

      createVersion: (worldId: WorldId, changes: ReadonlyArray<MetadataChange>, description?: string) =>
        Effect.gen(function* () {
          yield* Effect.filterOrFail(
            config.versioning.enabled,
            (enabled) => enabled,
            () => createVersioningError(worldId, 'Versioning is disabled', null)
          )

          const version = yield* createMetadataVersion(worldId, changes, description)

          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId) || new Map()

          // Check version limit and remove oldest if necessary
          const updatedWorldVersions = yield* Effect.if(worldVersions.size >= config.versioning.maxVersionsPerWorld, {
            onTrue: () =>
              Effect.sync(() => {
                const oldest = Array.from(worldVersions.entries()).sort(
                  ([, a], [, b]) =>
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp)) -
                    DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp))
                )[0]
                worldVersions.delete(oldest[0])
                return worldVersions
              }),
            onFalse: () => Effect.succeed(worldVersions),
          })

          updatedWorldVersions.set(version.version, version)

          const updatedVersionMap = new Map(versionMap)
          updatedVersionMap.set(worldId, updatedWorldVersions)
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

          return pipe(
            Option.fromNullable(worldVersions),
            Option.flatMap((versions) => Option.fromNullable(versions.get(version)))
          )
        }),

      getVersionHistory: (worldId: WorldId) =>
        Effect.gen(function* () {
          const historyMap = yield* Ref.get(versionHistoryStore)
          const history = historyMap.get(worldId)

          return pipe(
            Option.fromNullable(history),
            Option.getOrElse(() => ({
              worldId,
              versions: [],
              currentVersion: '',
              totalVersions: 0,
              totalSize: 0,
              oldestVersion: '',
              newestVersion: '',
            }))
          )
        }),

      restoreVersion: (worldId: WorldId, version: string) =>
        Effect.gen(function* () {
          const versionData = yield* this.getVersion(worldId, version)

          yield* pipe(
            versionData,
            Option.match({
              onNone: () => Effect.fail(createVersioningError(worldId, `Version not found: ${version}`, null)),
              onSome: (data) =>
                Effect.gen(function* () {
                  // Apply changes in reverse (simplified implementation)
                  const changes = data.changes
                  const timestamp = yield* currentDate
                  const restorationChanges: MetadataChange[] = changes.map((change) => ({
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

          return yield* Effect.if(Option.isNone(v1) || Option.isNone(v2), {
            onTrue: () => Effect.fail(createVersioningError(worldId, 'One or both versions not found', null)),
            onFalse: () => Effect.succeed([...Option.getOrThrow(v1).changes, ...Option.getOrThrow(v2).changes]),
          })
        }),

      cleanupOldVersions: (worldId: WorldId, retentionPolicy: { maxVersions?: number; maxAgeDays?: number }) =>
        Effect.gen(function* () {
          const versionMap = yield* Ref.get(versionStore)
          const worldVersions = versionMap.get(worldId)

          return yield* pipe(
            Option.fromNullable(worldVersions),
            Option.match({
              onNone: () => Effect.succeed(0),
              onSome: (versions) =>
                Effect.gen(function* () {
                  const versionEntries = Array.from(versions.entries())

                  // Apply max versions retention policy
                  const versionsByMaxPolicy = yield* Effect.if(
                    retentionPolicy.maxVersions !== undefined && versionEntries.length > retentionPolicy.maxVersions,
                    {
                      onTrue: () =>
                        Effect.succeed(
                          versionEntries
                            .sort(
                              ([, a], [, b]) =>
                                DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp)) -
                                DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp))
                            )
                            .slice(retentionPolicy.maxVersions)
                            .map(([v]) => v)
                        ),
                      onFalse: () => Effect.succeed([] as const satisfies ReadonlyArray<string>),
                    }
                  )

                  // Apply max age retention policy
                  const versionsByAgePolicy = yield* Effect.if(retentionPolicy.maxAgeDays !== undefined, {
                    onTrue: () =>
                      Effect.gen(function* () {
                        const nowDateTime = yield* DateTime.now
                        const now = DateTime.toEpochMillis(nowDateTime)
                        const cutoffMillis = now - retentionPolicy.maxAgeDays! * 24 * 60 * 60 * 1000
                        const cutoffDate = DateTime.toDate(DateTime.unsafeMake(cutoffMillis))
                        return versionEntries.filter(([, version]) => version.timestamp < cutoffDate).map(([v]) => v)
                      }),
                    onFalse: () => Effect.succeed([] as const satisfies ReadonlyArray<string>),
                  })

                  const versionsToDelete = [...new Set([...versionsByMaxPolicy, ...versionsByAgePolicy])]

                  // Delete versions
                  const updatedWorldVersions = pipe(
                    versionsToDelete,
                    ReadonlyArray.reduce(new Map(versions), (map, versionToDelete) => {
                      map.delete(versionToDelete)
                      return map
                    })
                  )

                  const updatedVersionMap = new Map(versionMap)
                  updatedVersionMap.set(worldId, updatedWorldVersions)
                  yield* Ref.set(versionStore, updatedVersionMap)

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
              onSome: (data) =>
                Effect.gen(function* () {
                  const compressionStats = simulateCompression(data, compressionConfig)

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

          yield* Effect.filterOrFail(
            compressionMap.has(worldId),
            (hasData) => hasData,
            () => createCompressionError(worldId, 'No compression data found', null)
          )

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

      updateCompressionConfig: (worldId: WorldId, compressionConfig: CompressionConfig) => Effect.succeed(undefined), // Mock implementation

      enableAutoCompression: (worldId: WorldId, threshold: number) => Effect.succeed(undefined), // Mock implementation

      // === Backup System ===

      createBackup: (worldId: WorldId, type: 'full' | 'incremental', description?: string) =>
        Effect.gen(function* () {
          const metadata = yield* this.findMetadata(worldId)

          return yield* pipe(
            metadata,
            Option.match({
              onNone: () =>
                Effect.fail(createRepositoryError(`World metadata not found: ${worldId}`, 'createBackup', null)),
              onSome: (data) =>
                Effect.gen(function* () {
                  const millis = yield* currentMillis
                  const backupId = `backup_${worldId}_${millis}`
                  const timestamp = yield* currentDate
                  const size = estimateMetadataSize(data)
                  const compressedSize = config.backup.compressionEnabled ? Math.floor(size * 0.3) : size
                  const backupInfo: BackupInfo = {
                    backupId,
                    worldId,
                    timestamp,
                    type,
                    size,
                    compressedSize,
                    checksum: calculateMetadataChecksum(data),
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
            })
          )
        }),

      listBackups: (worldId: WorldId) =>
        Effect.gen(function* () {
          const worldBackupMap = yield* Ref.get(worldBackupsStore)
          const backupMap = yield* Ref.get(backupStore)

          const backupIds = worldBackupMap.get(worldId) || []
          const backups = backupIds
            .map((id) => backupMap.get(id))
            .filter((backup): backup is BackupInfo => backup !== undefined)

          return backups.sort(
            (a, b) =>
              DateTime.toEpochMillis(DateTime.unsafeFromDate(b.timestamp)) -
              DateTime.toEpochMillis(DateTime.unsafeFromDate(a.timestamp))
          )
        }),

      restoreBackup: (worldId: WorldId, backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          yield* Effect.filterOrFail(
            backup,
            (b): b is BackupInfo => b !== undefined && b.worldId === worldId,
            () =>
              createRepositoryError(`Backup not found or not associated with world: ${backupId}`, 'restoreBackup', null)
          )

          // Mock restoration - in real implementation would restore actual data
          const timestamp = yield* currentDate
          const changes: MetadataChange[] = [
            {
              type: 'update',
              path: 'metadata',
              oldValue: undefined,
              newValue: backup,
              timestamp,
              reason: `Restore from backup ${backupId}`,
            },
          ]

          yield* this.createVersion(worldId, changes, `Restore from backup ${backupId}`)
        }),

      deleteBackup: (backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          yield* Effect.filterOrFail(
            backup,
            (b): b is BackupInfo => b !== undefined,
            () => createRepositoryError(`Backup not found: ${backupId}`, 'deleteBackup', null)
          )

          const updatedBackupMap = new Map(backupMap)
          updatedBackupMap.delete(backupId)
          yield* Ref.set(backupStore, updatedBackupMap)

          // Remove from world backup list
          const worldBackupMap = yield* Ref.get(worldBackupsStore)
          const currentBackups = worldBackupMap.get(backup.worldId) || []
          const filteredBackups = currentBackups.filter((id) => id !== backupId)

          const updatedWorldBackupMap = new Map(worldBackupMap)
          updatedWorldBackupMap.set(backup.worldId, filteredBackups)
          yield* Ref.set(worldBackupsStore, updatedWorldBackupMap)
        }),

      verifyBackup: (backupId: string) =>
        Effect.gen(function* () {
          const backupMap = yield* Ref.get(backupStore)
          const backup = backupMap.get(backupId)

          return pipe(
            Option.fromNullable(backup),
            Option.match({
              onNone: () => ({
                isValid: false,
                issues: [`Backup not found: ${backupId}`],
              }),
              onSome: () => ({
                isValid: true,
                issues: [],
              }),
            })
          )
        }),

      configureAutoBackup: (worldId: WorldId, backupConfig: BackupConfig) => Effect.succeed(undefined), // Mock implementation

      // === Index Management ===

      rebuildIndexes: (worldId?: WorldId) => Effect.succeed(undefined), // Mock implementation

      optimizeIndexes: () =>
        Effect.succeed({
          beforeSize: 1024 * 1024, // 1MB
          afterSize: 800 * 1024, // 800KB
          improvementRatio: 0.2,
        }),

      getIndexStatistics: () =>
        Effect.gen(function* () {
          const nowDateTime = yield* DateTime.now
          const now = DateTime.toEpochMillis(nowDateTime)
          const lastOptimizedMillis = now - 24 * 60 * 60 * 1000
          return {
            totalIndexes: 5,
            totalSize: 800 * 1024,
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
          yield* Effect.if(worldId !== undefined, {
            onTrue: () =>
              Effect.gen(function* () {
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
              }),
            onFalse: () =>
              Effect.gen(function* () {
                yield* Ref.set(metadataCache, new Map())
                yield* Ref.set(statisticsCache, new Map())
                yield* Ref.set(settingsCache, new Map())
              }),
          })
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
          yield* pipe(
            worldIds,
            Effect.forEach(
              (worldId) =>
                Effect.gen(function* () {
                  yield* Effect.ignore(this.findMetadata(worldId))
                  yield* Effect.ignore(this.getSettings(worldId))
                  yield* Effect.ignore(this.getStatistics(worldId))
                }),
              { concurrency: 'unbounded' }
            )
          )
        }),

      // === Bulk Operations ===

      saveMultipleMetadata: (metadataList: ReadonlyArray<WorldMetadata>) =>
        Effect.gen(function* () {
          const results = yield* pipe(
            metadataList,
            Effect.forEach((metadata) => Effect.either(this.saveMetadata(metadata)), {
              concurrency: 'unbounded',
            })
          )

          return pipe(
            results,
            ReadonlyArray.reduce(
              {
                successful: 0,
                failed: 0,
                errors: [] as const satisfies ReadonlyArray<AllRepositoryErrors>,
              },
              (acc, result) =>
                result._tag === 'Right'
                  ? { ...acc, successful: acc.successful + 1 }
                  : { ...acc, failed: acc.failed + 1, errors: [...acc.errors, result.left] }
            )
          )
        }),

      updateMultipleMetadata: (updates: ReadonlyArray<{ worldId: WorldId; metadata: Partial<WorldMetadata> }>) =>
        Effect.gen(function* () {
          const results = yield* pipe(
            updates,
            Effect.forEach(
              (update) =>
                Effect.gen(function* () {
                  const currentMetadata = yield* this.findMetadata(update.worldId)

                  return yield* pipe(
                    currentMetadata,
                    Option.match({
                      onNone: () => Effect.succeed(false),
                      onSome: (metadata) =>
                        Effect.gen(function* () {
                          const updatedMetadata = { ...metadata, ...update.metadata }
                          const result = yield* Effect.either(this.updateMetadata(updatedMetadata))
                          return result._tag === 'Right'
                        }),
                    })
                  )
                }),
              { concurrency: 'unbounded' }
            )
          )

          return pipe(
            results,
            ReadonlyArray.filter((success) => success),
            (successArray) => successArray.length
          )
        }),

      deleteMultipleMetadata: (worldIds: ReadonlyArray<WorldId>) =>
        Effect.gen(function* () {
          const results = yield* pipe(
            worldIds,
            Effect.forEach((worldId) => Effect.either(this.deleteMetadata(worldId)), {
              concurrency: 'unbounded',
            })
          )

          return pipe(
            results,
            ReadonlyArray.filter((result) => result._tag === 'Right'),
            (successArray) => successArray.length
          )
        }),

      bulkCompress: (worldIds: ReadonlyArray<WorldId>, compressionConfig = config.compression) =>
        Effect.gen(function* () {
          const results = yield* pipe(
            worldIds,
            Effect.forEach((worldId) => Effect.either(this.compressMetadata(worldId, compressionConfig)), {
              concurrency: 'unbounded',
            })
          )

          return pipe(
            results,
            ReadonlyArray.filterMap((result) => (result._tag === 'Right' ? Option.some(result.right) : Option.none()))
          )
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

          const validationResults = pipe(
            Array.from(store.entries()),
            ReadonlyArray.reduce(
              {
                errors: [] as const satisfies ReadonlyArray<string>,
                warnings: [] as const satisfies ReadonlyArray<string>,
                corruptedMetadata: [] as const satisfies ReadonlyArray<WorldId>,
              },
              (acc, [worldId, metadata]) => {
                const expectedChecksum = calculateMetadataChecksum(metadata)
                const hasChecksumMismatch = metadata.checksum !== expectedChecksum
                const hasMissingFields = !metadata.name || !metadata.id
                const hasDateIssue = metadata.createdAt > metadata.lastModified

                return {
                  errors: [
                    ...acc.errors,
                    ...(hasChecksumMismatch ? [`Checksum mismatch for world ${worldId}`] : []),
                    ...(hasMissingFields ? [`Missing required fields for world ${worldId}`] : []),
                  ],
                  warnings: [
                    ...acc.warnings,
                    ...(hasDateIssue ? [`Creation date after modification date for world ${worldId}`] : []),
                  ],
                  corruptedMetadata: [
                    ...acc.corruptedMetadata,
                    ...(hasChecksumMismatch || hasMissingFields ? [worldId] : []),
                  ],
                }
              }
            )
          )

          return {
            isValid: validationResults.errors.length === 0,
            errors: validationResults.errors,
            warnings: validationResults.warnings,
            corruptedMetadata: [...new Set(validationResults.corruptedMetadata)],
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
                  mostActiveWorld: '' as WorldId,
                }
              }),
            onFalse: () =>
              Effect.succeed({
                totalWorlds: metadataList.length,
                totalSize: metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0),
                averageWorldSize:
                  metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0) / metadataList.length,
                compressionRatio: (() => {
                  const totalSize = metadataList.reduce((sum, m) => sum + m.statistics.size.uncompressedSize, 0)
                  const totalCompressedSize = metadataList.reduce((sum, m) => sum + m.statistics.size.compressedSize, 0)
                  return totalSize > 0 ? totalCompressedSize / totalSize : 1.0
                })(),
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

export const WorldMetadataRepositoryMemoryLive = (config: WorldMetadataRepositoryConfig) =>
  Layer.effect(WorldMetadataRepository, WorldMetadataRepositoryMemoryImplementation(config))
