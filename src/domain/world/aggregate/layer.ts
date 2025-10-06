/**
 * World Aggregate Layer Implementations
 *
 * 全集約ルートサービスの統合Layer
 */

import { Context, Layer } from 'effect'
import {
  BiomeEventPublisherTag,
  BiomeSystemLive,
  BiomeSystemTag,
  InMemoryBiomeEventPublisher,
} from './biome_system/index'
import {
  GenerationSessionLive,
  GenerationSessionTag,
  InMemorySessionEventPublisher,
  SessionEventPublisherTag,
} from './generation_session/index'
import {
  EventPublisherTag,
  InMemoryEventPublisher,
  WorldGeneratorLive,
  WorldGeneratorTag,
} from './world_generator/index'

/**
 * 全集約ルートサービスの統合タグ
 */
export const WorldAggregateServicesTag = Context.GenericTag<{
  readonly worldGenerator: typeof WorldGeneratorTag.Service
  readonly generationSession: typeof GenerationSessionTag.Service
  readonly biomeSystem: typeof BiomeSystemTag.Service
}>('@minecraft/domain/world/aggregate/WorldAggregateServices')

/**
 * 全イベント発行者の統合タグ
 */
export const WorldEventPublishersTag = Context.GenericTag<{
  readonly worldGeneratorEvents: typeof EventPublisherTag.Service
  readonly sessionEvents: typeof SessionEventPublisherTag.Service
  readonly biomeEvents: typeof BiomeEventPublisherTag.Service
}>('@minecraft/domain/world/aggregate/WorldEventPublishers')

/**
 * 統合レイヤー実装
 */
export const WorldAggregateLive = Layer.mergeAll(
  WorldGeneratorLive.pipe(Layer.provide(Layer.succeed(WorldGeneratorTag, WorldGeneratorLive))),
  GenerationSessionLive.pipe(Layer.provide(Layer.succeed(GenerationSessionTag, GenerationSessionLive))),
  BiomeSystemLive.pipe(Layer.provide(Layer.succeed(BiomeSystemTag, BiomeSystemLive)))
)

/**
 * イベント発行者統合レイヤー
 */
export const WorldEventPublishersLive = Layer.mergeAll(
  Layer.succeed(EventPublisherTag, InMemoryEventPublisher),
  Layer.succeed(SessionEventPublisherTag, InMemorySessionEventPublisher),
  Layer.succeed(BiomeEventPublisherTag, InMemoryBiomeEventPublisher)
)
