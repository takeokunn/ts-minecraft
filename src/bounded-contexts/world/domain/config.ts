import { Match, Schema, Effect } from 'effect'
import type { WorldRepositoryLayerConfig } from './repository'

const PerformanceModeSchema = Schema.Literal('quality', 'balanced', 'performance')
const BooleanSchema = Schema.Boolean

const WorldDomainConfigRawSchema = Schema.Struct({
  repository: Schema.Any,
  enableDomainEvents: BooleanSchema,
  enablePerformanceMetrics: BooleanSchema,
  enableDomainValidation: BooleanSchema,
  enableAggregateEventSourcing: BooleanSchema,
  enableApplicationServices: BooleanSchema,
  enableFactoryValidation: BooleanSchema,
  performanceMode: PerformanceModeSchema,
  debugMode: BooleanSchema,
}).pipe(Schema.brand('WorldDomainConfig'))

type WorldDomainConfigRaw = Schema.Schema.Type<typeof WorldDomainConfigRawSchema>

export interface WorldDomainConfig extends Omit<WorldDomainConfigRaw, 'repository'> {
  readonly repository: WorldRepositoryLayerConfig
}
export type WorldDomainConfigBrand = Schema.Schema.Brand<typeof WorldDomainConfigRawSchema>
export type WorldDomainPerformanceMode = Schema.Schema.Type<typeof PerformanceModeSchema>

const defaultRepositoryConfig: WorldRepositoryLayerConfig = {
  worldGenerator: {
    storage: { type: 'memory', maxGenerators: 100 },
    cache: { enabled: true, maxSize: 1000, ttlSeconds: 300 },
    performance: { enableProfiling: false, enableMetrics: true, batchSize: 50 },
  },
  generationSession: {
    storage: { type: 'memory', maxSessions: 50 },
    checkpointing: { enabled: true, intervalMs: 30000, maxCheckpoints: 10 },
    recovery: { enabled: true, strategy: 'smart', maxRetries: 3 },
    cache: { enabled: true, maxSize: 500, ttlSeconds: 600 },
    performance: { enableProfiling: false, enableMetrics: true, batchSize: 25 },
  },
  biomeSystem: {
    storage: { type: 'memory', maxBiomes: 100000 },
    spatialIndex: { type: 'quadtree', maxDepth: 12, maxEntriesPerNode: 16, minNodeSize: 64 },
    cache: {
      enabled: true,
      maxSize: 10000,
      ttlSeconds: 300,
      spatialCacheEnabled: true,
      climateCacheEnabled: true,
    },
    climate: {
      gridResolution: 16,
      interpolationMethod: 'bilinear',
      enableTransitions: true,
      transitionSmoothing: 0.5,
    },
    performance: {
      enableProfiling: false,
      enableMetrics: true,
      batchSize: 1000,
      indexOptimizationInterval: 3_600_000,
    },
  },
  worldMetadata: {
    storage: { type: 'memory', maxWorlds: 1000, enableEncryption: false },
    compression: {
      algorithm: 'gzip',
      level: 6,
      chunkSize: 64 * 1024,
      enableDictionary: true,
      enableStreaming: false,
      enableDeduplication: true,
    },
    versioning: {
      enabled: true,
      maxVersionsPerWorld: 10,
      automaticVersioning: true,
      versioningStrategy: 'change-based',
    },
    backup: {
      enabled: true,
      retentionDays: 30,
      compressionEnabled: true,
      encryptionEnabled: false,
      incrementalBackup: true,
      scheduleInterval: 86_400_000,
      maxBackupSize: 100 * 1024 * 1024,
      excludePatterns: [],
    },
    indexing: {
      enabled: true,
      indexTypes: ['name', 'tags', 'created', 'modified', 'size'],
      rebuildInterval: 604_800_000,
      optimizationInterval: 86_400_000,
    },
    cache: {
      enabled: true,
      maxSize: 1000,
      ttlSeconds: 600,
      enableStatisticsCache: true,
      enableSettingsCache: true,
    },
    performance: {
      enableProfiling: false,
      enableMetrics: true,
      batchSize: 100,
      concurrencyLimit: 10,
    },
  },
  implementation: 'memory',
}

const makeConfig = (config: Partial<WorldDomainConfig> = {}) =>
  Effect.map(
    Schema.decodeUnknown(WorldDomainConfigRawSchema)({
      repository: config.repository ?? defaultRepositoryConfig,
      enableDomainEvents: config.enableDomainEvents ?? true,
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? true,
      enableDomainValidation: config.enableDomainValidation ?? true,
      enableAggregateEventSourcing: config.enableAggregateEventSourcing ?? true,
      enableApplicationServices: config.enableApplicationServices ?? true,
      enableFactoryValidation: config.enableFactoryValidation ?? true,
      performanceMode: config.performanceMode ?? 'balanced',
      debugMode: config.debugMode ?? false,
    }),
    (decoded): WorldDomainConfig => ({
      ...decoded,
      repository: decoded.repository as WorldRepositoryLayerConfig,
    })
  )

export const defaultWorldDomainConfig = Effect.runSync(makeConfig())

export const selectWorldDomainConfig = (mode: 'default' | 'performance' | 'quality') =>
  Match.value(mode).pipe(
    Match.when('default', () => makeConfig()),
    Match.when('performance', () =>
      makeConfig({
        performanceMode: 'performance',
        enableDomainValidation: false,
        enableFactoryValidation: false,
        debugMode: false,
        repository: {
          ...defaultWorldRepositoryLayerConfig,
          implementation: 'memory' as const,
        },
      })
    ),
    Match.when('quality', () =>
      makeConfig({
        performanceMode: 'quality',
        enableDomainValidation: true,
        enableFactoryValidation: true,
        debugMode: true,
      })
    ),
    Match.exhaustive
  )

export const createWorldDomainConfig = (config: Partial<WorldDomainConfig>) => makeConfig(config)

export const WorldDomainConfigSchema = WorldDomainConfigRawSchema
export const WorldDomainPerformanceModeSchema = PerformanceModeSchema
export type { WorldRepositoryLayerConfig }
