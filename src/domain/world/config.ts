import { WorldRepositoryLayerConfigSchema, type WorldRepositoryLayerConfig } from '@domain/world/repository'
import { Context, Effect, Layer, Match, Schema } from 'effect'
import * as Either from 'effect/Either'

const PerformanceModeSchema = Schema.Literal('quality', 'balanced', 'performance')
const BooleanSchema = Schema.Boolean

const WorldDomainConfigRawSchema = Schema.Struct({
  repository: WorldRepositoryLayerConfigSchema,
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

const makeConfigSync = (config: Partial<WorldDomainConfig> = {}): WorldDomainConfig => {
  const candidate = {
    repository: config.repository ?? defaultRepositoryConfig,
    enableDomainEvents: config.enableDomainEvents ?? true,
    enablePerformanceMetrics: config.enablePerformanceMetrics ?? true,
    enableDomainValidation: config.enableDomainValidation ?? true,
    enableAggregateEventSourcing: config.enableAggregateEventSourcing ?? true,
    enableApplicationServices: config.enableApplicationServices ?? true,
    enableFactoryValidation: config.enableFactoryValidation ?? true,
    performanceMode: config.performanceMode ?? 'balanced',
    debugMode: config.debugMode ?? false,
  }

  const decoded = Either.match(Schema.decodeUnknownEither(WorldDomainConfigRawSchema)(candidate), {
    onLeft: (error) => {
      throw error
    },
    onRight: (value) => value,
  })

  return {
    ...decoded,
    repository: decoded.repository as WorldRepositoryLayerConfig,
  }
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

export const defaultWorldDomainConfig = makeConfigSync()

export const selectWorldDomainConfigSync = (mode: 'default' | 'performance' | 'quality'): WorldDomainConfig =>
  Match.value(mode).pipe(
    Match.when('default', () => makeConfigSync()),
    Match.when('performance', () =>
      makeConfigSync({
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
      makeConfigSync({
        performanceMode: 'quality',
        enableDomainValidation: true,
        enableFactoryValidation: true,
        debugMode: true,
      })
    ),
    Match.exhaustive
  )

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

// ===== Layer-based Configuration ===== //

/**
 * WorldDomainConfig用のContext Tag
 */
export class WorldDomainConfigService extends Context.Tag('WorldDomainConfigService')<
  WorldDomainConfigService,
  WorldDomainConfig
>() {}

/**
 * デフォルト設定のLayer
 * Layer.memoを使用して遅延初期化し、同一インスタンスを再利用
 */
export const DefaultWorldDomainConfigLayer = Layer.memo(Layer.effect(WorldDomainConfigService, makeConfig()))

/**
 * パフォーマンス重視設定のLayer
 */
export const PerformanceWorldDomainConfigLayer = Layer.memo(
  Layer.effect(
    WorldDomainConfigService,
    makeConfig({
      performanceMode: 'performance',
      enableDomainValidation: false,
      enableFactoryValidation: false,
      debugMode: false,
      repository: {
        ...defaultRepositoryConfig,
        implementation: 'memory' as const,
      },
    })
  )
)

/**
 * 品質重視設定のLayer
 */
export const QualityWorldDomainConfigLayer = Layer.memo(
  Layer.effect(
    WorldDomainConfigService,
    makeConfig({
      performanceMode: 'quality',
      enableDomainValidation: true,
      enableFactoryValidation: true,
      debugMode: true,
    })
  )
)

/**
 * 後方互換性のため、同期版の設定値も残す
 * モジュール初期化時のEffect.runSyncを避けるため、関数呼び出しで取得する形式に変更
 */
export const defaultWorldDomainConfig = makeConfigSync()

export const WorldDomainConfigSchema = WorldDomainConfigRawSchema
export const WorldDomainPerformanceModeSchema = PerformanceModeSchema
export type { WorldRepositoryLayerConfig }
