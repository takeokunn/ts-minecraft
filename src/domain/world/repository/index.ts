/**
 * @fileoverview World Domain Repository Layer - Main Index
 * ワールドドメインリポジトリ層の統合エクスポート
 *
 * 全リポジトリの統合・Layer統合・エラーハンドリング
 * DDD Repository Patternの完全実装
 */

// === Error Types ===
export * from '@domain/world/types'

// === Repository Implementations ===

// World Generator Repository
export * from './world_generator_repository'

// Generation Session Repository
export * from './generation_session_repository'

// Biome System Repository
export * from './biome_system_repository'

// World Metadata Repository
export * from './world_metadata_repository'

// === Layer Integration ===

import type { BiomeSystemRepository, BiomeSystemRepositoryConfig } from './biome_system_repository'
import type { GenerationSessionRepository, GenerationSessionRepositoryConfig } from './generation_session_repository'
import type { WorldGeneratorRepository, WorldGeneratorRepositoryConfig } from './world_generator_repository'
import type { WorldMetadataRepository, WorldMetadataRepositoryConfig } from './world_metadata_repository'

// === Repository Configuration ===

/**
 * World Repository Layer統合設定
 */
export interface WorldRepositoryLayerConfig {
  readonly worldGenerator: WorldGeneratorRepositoryConfig
  readonly generationSession: GenerationSessionRepositoryConfig
  readonly biomeSystem: BiomeSystemRepositoryConfig
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
  biomeSystem: {
    storage: { type: 'memory', maxBiomes: 100000 },
    spatialIndex: { type: 'quadtree', maxDepth: 12, maxEntriesPerNode: 16, minNodeSize: 64 },
    cache: { enabled: true, maxSize: 10000, ttlSeconds: 300, spatialCacheEnabled: true, climateCacheEnabled: true },
    climate: { gridResolution: 16, interpolationMethod: 'bilinear', enableTransitions: true, transitionSmoothing: 0.5 },
    performance: { enableProfiling: false, enableMetrics: true, batchSize: 1000, indexOptimizationInterval: 3600000 },
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

// === Layer Implementations ===

export * from './layers'

// === Repository Service Types ===

/**
 * World Repository Service集約型
 */
export interface WorldRepositoryServices {
  readonly worldGenerator: WorldGeneratorRepository
  readonly generationSession: GenerationSessionRepository
  readonly biomeSystem: BiomeSystemRepository
  readonly worldMetadata: WorldMetadataRepository
}

// === Utility Functions ===

export * from './helpers'

// === Type Exports ===

export type { WorldRepositoryLayerConfig, WorldRepositoryServices }
