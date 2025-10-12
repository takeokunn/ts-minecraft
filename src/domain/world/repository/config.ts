import { Schema } from 'effect'
import {
  WorldMetadataRepositoryConfig,
  WorldMetadataRepositoryConfigSchema,
  defaultWorldMetadataRepositoryConfig,
} from './world_metadata_repository'

export interface CacheConfiguration {
  readonly enabled: boolean
  readonly maxSize: number
  readonly ttlSeconds: number
  readonly strategy: 'lru' | 'lfu' | 'ttl' | 'hybrid'
  readonly compressionEnabled: boolean
}

export interface BackupConfiguration {
  readonly enabled: boolean
  readonly intervalMinutes: number
  readonly maxBackups: number
  readonly compressionLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  readonly encryptionEnabled: boolean
}

export interface WorldGeneratorRepositoryConfig {
  readonly storage: {
    readonly type: 'memory' | 'indexeddb' | 'filesystem'
    readonly location?: string
    readonly maxSize?: number
  }
  readonly cache: CacheConfiguration
  readonly backup: BackupConfiguration
  readonly performance: {
    readonly enableMetrics: boolean
    readonly enableProfiling: boolean
    readonly batchSize: number
  }
}

export const WorldGeneratorRepositoryConfigSchema = Schema.Struct({
  storage: Schema.Struct({
    type: Schema.Literal('memory', 'indexeddb', 'filesystem'),
    location: Schema.optional(Schema.String),
    maxSize: Schema.optional(Schema.Number),
  }),
  cache: Schema.Struct({
    enabled: Schema.Boolean,
    maxSize: Schema.Number,
    ttlSeconds: Schema.Number,
    strategy: Schema.Literal('lru', 'lfu', 'ttl', 'hybrid'),
    compressionEnabled: Schema.Boolean,
  }),
  backup: Schema.Struct({
    enabled: Schema.Boolean,
    intervalMinutes: Schema.Number,
    maxBackups: Schema.Number,
    compressionLevel: Schema.Literal(1, 2, 3, 4, 5, 6, 7, 8, 9),
    encryptionEnabled: Schema.Boolean,
  }),
  performance: Schema.Struct({
    enableMetrics: Schema.Boolean,
    enableProfiling: Schema.Boolean,
    batchSize: Schema.Number,
  }),
})

export interface GenerationSessionRepositoryConfig {
  readonly storage: {
    readonly type: 'memory' | 'indexeddb' | 'filesystem'
    readonly location?: string
    readonly maxSessions?: number
  }
  readonly checkpointing: {
    readonly enabled: boolean
    readonly intervalMs: number
    readonly maxCheckpoints: number
    readonly compressionEnabled: boolean
  }
  readonly recovery: {
    readonly autoRecoveryEnabled: boolean
    readonly maxRetryAttempts: number
    readonly retryDelayMs: number
    readonly corruptionThreshold: number
  }
  readonly cleanup: {
    readonly archiveAfterDays: number
    readonly deleteAfterDays: number
    readonly maxHistoryEntries: number
  }
}

export const GenerationSessionRepositoryConfigSchema = Schema.Struct({
  storage: Schema.Struct({
    type: Schema.Literal('memory', 'indexeddb', 'filesystem'),
    location: Schema.optional(Schema.String),
    maxSessions: Schema.optional(Schema.Number),
  }),
  checkpointing: Schema.Struct({
    enabled: Schema.Boolean,
    intervalMs: Schema.Number,
    maxCheckpoints: Schema.Number,
    compressionEnabled: Schema.Boolean,
  }),
  recovery: Schema.Struct({
    autoRecoveryEnabled: Schema.Boolean,
    maxRetryAttempts: Schema.Number,
    retryDelayMs: Schema.Number,
    corruptionThreshold: Schema.Number,
  }),
  cleanup: Schema.Struct({
    archiveAfterDays: Schema.Number,
    deleteAfterDays: Schema.Number,
    maxHistoryEntries: Schema.Number,
  }),
})

const defaultWorldGeneratorRepositoryConfig: WorldGeneratorRepositoryConfig = {
  storage: {
    type: 'memory',
    maxSize: 100 * 1024 * 1024,
  },
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
}

const defaultGenerationSessionRepositoryConfig: GenerationSessionRepositoryConfig = {
  storage: {
    type: 'memory',
    maxSessions: 1000,
  },
  checkpointing: {
    enabled: true,
    intervalMs: 30000,
    maxCheckpoints: 5,
    compressionEnabled: true,
  },
  recovery: {
    autoRecoveryEnabled: true,
    maxRetryAttempts: 3,
    retryDelayMs: 5000,
    corruptionThreshold: 0.1,
  },
  cleanup: {
    archiveAfterDays: 7,
    deleteAfterDays: 30,
    maxHistoryEntries: 100,
  },
}

/**
 * World Repository Layer 統合設定
 */
export interface WorldRepositoryLayerConfig {
  readonly worldGenerator: WorldGeneratorRepositoryConfig
  readonly generationSession: GenerationSessionRepositoryConfig
  readonly worldMetadata: WorldMetadataRepositoryConfig
  readonly implementation: 'memory' | 'persistence' | 'mixed'
}

export const WorldRepositoryLayerConfigSchema = Schema.Struct({
  worldGenerator: Schema.suspend(() => Schema.decodeUnknown(WorldGeneratorRepositoryConfigSchema)),
  generationSession: Schema.suspend(() => Schema.decodeUnknown(GenerationSessionRepositoryConfigSchema)),
  worldMetadata: Schema.suspend(() => Schema.decodeUnknown(WorldMetadataRepositoryConfigSchema)),
  implementation: Schema.Literal('memory', 'persistence', 'mixed'),
})

export const defaultWorldRepositoryLayerConfig: WorldRepositoryLayerConfig = {
  worldGenerator: defaultWorldGeneratorRepositoryConfig,
  generationSession: defaultGenerationSessionRepositoryConfig,
  worldMetadata: defaultWorldMetadataRepositoryConfig,
  implementation: 'memory',
}
