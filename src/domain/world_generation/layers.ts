/**
 * World Generation Domain Layer
 *
 * ワールド生成コンテキストの全Domain層サービスを提供
 * biomeコンテキストへの依存を持つ
 */

import { Layer } from 'effect'

// Aggregate layers
import {
  GenerationSessionLive,
  GenerationSessionTag,
  InMemorySessionEventPublisher,
  SessionEventPublisherTag,
} from './aggregate/generation_session/index'
import {
  EventPublisherTag,
  InMemoryEventPublisher,
  WorldGeneratorLive,
  WorldGeneratorTag,
} from './aggregate/world_generator/index'

// Domain Service layers
import { NoiseGenerationLayer } from './domain_service/noise_generation/index'
import { ProceduralGenerationLayer } from './domain_service/procedural_generation/index'
import { WorldGenerationOrchestratorLive } from './domain_service/world_generation_orchestrator/index'

// Factory layers
import { GenerationSessionFactoryLive } from './factory/generation_session_factory/index'
import { WorldGeneratorFactoryLive } from './factory/world_generator_factory/index'

// Repository layers (注: これらは現在world/repository/layers.tsで管理されているため、ここでは参照のみ)
// import { WorldGeneratorRepositoryMemoryLive } from './repository/world_generator_repository/index'
// import { GenerationSessionRepositoryMemoryLive } from './repository/generation_session_repository/index'

/**
 * World Generation Aggregate Layer
 *
 * world_generator, generation_sessionの集約ルートLayer
 */
export const WorldGenerationAggregateLive = Layer.mergeAll(
  WorldGeneratorLive.pipe(Layer.provide(Layer.succeed(WorldGeneratorTag, WorldGeneratorLive))),
  GenerationSessionLive.pipe(Layer.provide(Layer.succeed(GenerationSessionTag, GenerationSessionLive)))
)

/**
 * World Generation Event Publishers Layer
 *
 * イベント発行者統合Layer
 */
export const WorldGenerationEventPublishersLive = Layer.mergeAll(
  Layer.succeed(EventPublisherTag, InMemoryEventPublisher),
  Layer.succeed(SessionEventPublisherTag, InMemorySessionEventPublisher)
)

/**
 * World Generation Domain Service Layer
 *
 * noise_generation, procedural_generation, world_generation_orchestratorのDomain ServiceLayer
 */
export const WorldGenerationDomainServiceLive = Layer.mergeAll(
  NoiseGenerationLayer,
  ProceduralGenerationLayer,
  WorldGenerationOrchestratorLive
)

/**
 * World Generation Factory Layer
 *
 * world_generator_factory, generation_session_factoryのFactoryLayer
 */
export const WorldGenerationFactoryLive = Layer.mergeAll(WorldGeneratorFactoryLive, GenerationSessionFactoryLive)

/**
 * World Generation Domain Layer (Complete)
 *
 * ワールド生成の全Domain層サービスを提供
 * biomeコンテキストへの依存は上位層で提供される想定
 *
 * 構成:
 * - Aggregate: WorldGenerator, GenerationSession
 * - Domain Service: NoiseGeneration, ProceduralGeneration, WorldGenerationOrchestrator
 * - Factory: WorldGeneratorFactory, GenerationSessionFactory
 */
export const WorldGenerationDomainLive = Layer.mergeAll(
  WorldGenerationAggregateLive,
  WorldGenerationEventPublishersLive,
  WorldGenerationDomainServiceLive,
  WorldGenerationFactoryLive
)
