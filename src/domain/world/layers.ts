import { WorldAggregateLive, WorldEventPublishersLive } from '@domain/world/aggregate'
import { WorldDomainApplicationServiceLayer } from '@domain/world/application_service'
import { WorldDomainServiceLayer } from '@domain/world/domain_service'
import { WorldDomainFactoryLayer } from '@domain/world/factory'
import {
  WorldRepositoryLayer,
  WorldRepositoryMemoryLayer,
  WorldRepositoryMixedLayer,
  WorldRepositoryPersistenceLayer,
  type WorldRepositoryLayerConfig,
} from '@domain/world/repository'
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

const composeApplicationLayer = (config: WorldDomainConfig, aggregateLayer: Layer.Layer<never, never, never>) =>
  Match.value(config.enableApplicationServices).pipe(
    Match.when(true, () => Layer.mergeAll(aggregateLayer, WorldDomainApplicationServiceLayer)),
    Match.orElse(() => aggregateLayer)
  )

const baseWorldLayer = (config: WorldDomainConfig) =>
  Layer.mergeAll(composeRepositoryLayer(config.repository), WorldDomainServiceLayer, WorldDomainFactoryLayer)

export const WorldDomainLayer = (config: WorldDomainConfig = defaultWorldDomainConfig) =>
  composeApplicationLayer(config, composeAggregateLayer(config, baseWorldLayer(config)))

const loadConfigLayer = (mode: 'default' | 'performance' | 'quality') =>
  Effect.map(selectWorldDomainConfig(mode), (config) => WorldDomainLayer(config))

export const WorldDomainPerformanceLayer = Layer.unwrapEffect(loadConfigLayer('performance'))
export const WorldDomainQualityLayer = Layer.unwrapEffect(loadConfigLayer('quality'))
export const WorldDomainDefaultLayer = Layer.unwrapEffect(loadConfigLayer('default'))

export const WorldDomainTestLayer = Layer.mergeAll(
  WorldRepositoryMemoryLayer(),
  WorldDomainServiceLayer,
  WorldDomainFactoryLayer
)
