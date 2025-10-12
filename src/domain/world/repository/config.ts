import { Schema } from 'effect'
import type {
  GenerationSessionRepositoryConfig,
  GenerationSessionRepositoryConfigSchema,
} from '@domain/world_generation/repository/generation_session_repository'
import type {
  WorldGeneratorRepositoryConfig,
  WorldGeneratorRepositoryConfigSchema,
} from '@domain/world_generation/repository/world_generator_repository'
import {
  WorldMetadataRepositoryConfig,
  WorldMetadataRepositoryConfigSchema,
} from './world_metadata_repository'

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
      scheduleInterval: 24 * 60 * 60 * 1000,
      maxBackupSize: 100 * 1024 * 1024,
      excludePatterns: [],
    },
    indexing: {
      enabled: true,
      indexTypes: ['name', 'tags', 'created', 'modified', 'size'],
      rebuildInterval: 7 * 24 * 60 * 60 * 1000,
      optimizationInterval: 24 * 60 * 60 * 1000,
    },
    cache: { enabled: true, maxSize: 1000, ttlSeconds: 600, enableStatisticsCache: true, enableSettingsCache: true },
    performance: { enableProfiling: false, enableMetrics: true, batchSize: 100, concurrencyLimit: 10 },
  },
  implementation: 'memory',
}
