/**
 * World Repository Layer Implementations
 *
 * 全Repository実装Layerの統合（Memory・Persistence・Mixed）
 */

import { defaultWorldRepositoryLayerConfig, WorldRepositoryLayerConfig } from '@domain/world/repository/config'
import {
  GenerationSessionRepositoryMemoryWith,
  GenerationSessionRepositoryPersistenceLive,
  WorldGeneratorRepositoryMemoryLive,
  WorldGeneratorRepositoryPersistenceLive,
} from '@infrastructure/world_generation/repository'
import { Layer, Match, pipe } from 'effect'
import { WorldMetadataRepositoryMemoryLive, WorldMetadataRepositoryPersistenceLive } from './world_metadata_repository'

// === Memory Implementation Layer ===

/**
 * 全Repository Memory実装Layer
 */
export const WorldRepositoryMemoryLayer = (config: WorldRepositoryLayerConfig = defaultWorldRepositoryLayerConfig) =>
  Layer.mergeAll(
    WorldGeneratorRepositoryMemoryLive(config.worldGenerator),
    GenerationSessionRepositoryMemoryWith(config.generationSession),
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
    WorldGeneratorRepositoryMemoryLive(config.worldGenerator),
    // Memory for sessions (temporary, high-performance needed)
    GenerationSessionRepositoryMemoryWith(config.generationSession),
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
