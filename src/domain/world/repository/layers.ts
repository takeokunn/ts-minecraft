/**
 * World Repository Layer Implementations
 *
 * 全Repository実装Layerの統合（Memory・Persistence・Mixed）
 */

import { Layer, Match, pipe } from 'effect'
// Import types inline to avoid circular dependency
import type { GenerationSessionRepositoryConfig } from '@/domain/world_generation/repository/generation_session_repository'
import {
  GenerationSessionRepositoryMemoryLive,
  GenerationSessionRepositoryPersistenceLive,
} from '@/domain/world_generation/repository/generation_session_repository'
import type { WorldGeneratorRepositoryConfig } from '@/domain/world_generation/repository/world_generator_repository'
import {
  WorldGeneratorRepositoryCacheLive,
  WorldGeneratorRepositoryMemoryLive,
  WorldGeneratorRepositoryPersistenceLive,
} from '@/domain/world_generation/repository/world_generator_repository'
import type { WorldMetadataRepositoryConfig } from './world_metadata_repository'
import { WorldMetadataRepositoryMemoryLive, WorldMetadataRepositoryPersistenceLive } from './world_metadata_repository'

/**
 * World Repository Layer統合設定
 */
export interface WorldRepositoryLayerConfig {
  readonly worldGenerator: WorldGeneratorRepositoryConfig
  readonly generationSession: GenerationSessionRepositoryConfig
  readonly worldMetadata: WorldMetadataRepositoryConfig
  readonly implementation: 'memory' | 'persistence' | 'mixed'
}

/**
 * デフォルト設定
 */
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

// === Memory Implementation Layer ===

/**
 * 全Repository Memory実装Layer
 */
export const WorldRepositoryMemoryLayer = (config: WorldRepositoryLayerConfig = defaultWorldRepositoryLayerConfig) =>
  Layer.mergeAll(
    WorldGeneratorRepositoryMemoryLive(config.worldGenerator),
    GenerationSessionRepositoryMemoryLive(config.generationSession),
    WorldMetadataRepositoryMemoryLive(config.worldMetadata)
  )

// === Persistence Implementation Layer ===

/**
 * 全Repository Persistence実装Layer
 */
export const WorldRepositoryPersistenceLayer = (
  config: WorldRepositoryLayerConfig = defaultWorldRepositoryLayerConfig
) =>
  Layer.mergeAll(
    WorldGeneratorRepositoryPersistenceLive(config.worldGenerator),
    GenerationSessionRepositoryPersistenceLive(config.generationSession),
    WorldMetadataRepositoryPersistenceLive(config.worldMetadata)
  )

// === Mixed Implementation Layer ===

/**
 * Mixed実装Layer（パフォーマンス重視）
 */
export const WorldRepositoryMixedLayer = (config: WorldRepositoryLayerConfig = defaultWorldRepositoryLayerConfig) =>
  Layer.mergeAll(
    // Cache layer for world generator (high-frequency access)
    WorldGeneratorRepositoryCacheLive(config.worldGenerator),
    // Memory for sessions (temporary, high-performance needed)
    GenerationSessionRepositoryMemoryLive(config.generationSession),
    // Persistence for metadata (long-term storage needed)
    WorldMetadataRepositoryPersistenceLive(config.worldMetadata)
  )

// === Auto Layer Selection ===

/**
 * 設定に基づく自動Layer選択
 */
export const WorldRepositoryLayer = (config: WorldRepositoryLayerConfig = defaultWorldRepositoryLayerConfig) =>
  pipe(
    Match.value(config.implementation),
    Match.when('memory', () => WorldRepositoryMemoryLayer(config)),
    Match.when('persistence', () => WorldRepositoryPersistenceLayer(config)),
    Match.when('mixed', () => WorldRepositoryMixedLayer(config)),
    Match.orElse(() => WorldRepositoryMemoryLayer(config))
  )
