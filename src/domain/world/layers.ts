/**
 * @fileoverview World Domain Layer
 * Domain層の依存関係を提供（Repository層 + Domain Service層 + Factory層 + Aggregate層）
 *
 * 変更履歴:
 * - FR-1: Application ServiceをDomain層から分離
 * - FR-2: world_generationコンテキストを独立分離
 *   (WorldGenerator, GenerationSession, NoiseGeneration, ProceduralGeneration, WorldGenerationOrchestrator)
 * - FR-2 Phase 3: biome/world_generationコンテキストへの依存を明示
 */

import { BiomeDomainLive } from '@domain/biome/layers'
import { WorldAggregateLive, WorldEventPublishersLive } from '@domain/world/aggregate'
import { WorldDomainServiceLayer } from '@domain/world/domain_service'
import { WorldDomainFactoryLayer } from '@domain/world/factory'
import {
  WorldRepositoryLayer,
  WorldRepositoryMemoryLayer,
  WorldRepositoryMixedLayer,
  WorldRepositoryPersistenceLayer,
  type WorldRepositoryLayerConfig,
} from '@domain/world/repository'
import { WorldGenerationDomainLive } from '@domain/world_generation/layers'
import { Effect, Layer, Match } from 'effect'
import { defaultWorldDomainConfig, selectWorldDomainConfig, type WorldDomainConfig } from './index'

const composeRepositoryLayer = (config: WorldRepositoryLayerConfig) =>
  Match.value(config.implementation).pipe(
    Match.when('memory', () => WorldRepositoryMemoryLayer(config)),
    Match.when('mixed', () => WorldRepositoryMixedLayer(config)),
    Match.when('persistence', () => WorldRepositoryPersistenceLayer(config)),
    Match.orElse(() => WorldRepositoryLayer(config))
  )

const composeAggregateLayer = (config: WorldDomainConfig, baseLayer: Layer.Layer<never, never, never>) =>
  Match.value(config.enableAggregateEventSourcing).pipe(
    Match.when(true, () => Layer.mergeAll(baseLayer, WorldAggregateLive, WorldEventPublishersLive)),
    Match.orElse(() => baseLayer)
  )

const baseWorldLayer = (config: WorldDomainConfig) =>
  Layer.mergeAll(composeRepositoryLayer(config.repository), WorldDomainServiceLayer, WorldDomainFactoryLayer).pipe(
    // worldはworld_generationに依存し、world_generationはbiomeに依存
    Layer.provide(WorldGenerationDomainLive.pipe(Layer.provide(BiomeDomainLive)))
  )

/**
 * World Domain Layer
 * - Repository: WorldRepositoryLayer (configurable: memory/mixed/persistence)
 * - Domain Service: WorldDomainServiceLayer
 * - Factory: WorldDomainFactoryLayer
 * - Aggregate: WorldAggregateLive, WorldEventPublishersLive (optional)
 * - Dependencies: WorldGenerationDomainLive → BiomeDomainLive
 */
export const WorldDomainLayer = (config: WorldDomainConfig = defaultWorldDomainConfig) =>
  composeAggregateLayer(config, baseWorldLayer(config))

const loadConfigLayer = (mode: 'default' | 'performance' | 'quality') =>
  Effect.map(selectWorldDomainConfig(mode), (config) => WorldDomainLayer(config))

export const WorldDomainPerformanceLayer = Layer.unwrapEffect(loadConfigLayer('performance'))
export const WorldDomainQualityLayer = Layer.unwrapEffect(loadConfigLayer('quality'))
export const WorldDomainDefaultLayer = Layer.unwrapEffect(loadConfigLayer('default'))

/**
 * World Domain Live (default configuration for FR-1)
 */
export const WorldDomainLive = WorldDomainDefaultLayer

export const WorldDomainTestLayer = Layer.mergeAll(
  WorldRepositoryMemoryLayer(),
  WorldDomainServiceLayer,
  WorldDomainFactoryLayer
)
