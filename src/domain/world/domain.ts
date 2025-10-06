import * as WorldAggregates from '@domain/world/aggregate'
import * as WorldApplicationServices from '@domain/world/application_service'
import * as WorldDomainServices from '@domain/world/domain_service'
import * as WorldFactories from '@domain/world/factory'
import * as WorldRepositories from '@domain/world/repository'
import * as WorldTypes from '@domain/world/types'
import * as WorldValueObjects from '@domain/world/value_object'
import { Effect } from 'effect'
import {
  defaultWorldDomainConfig,
  selectWorldDomainConfig,
  WorldDomainHelpers,
  WorldDomainLayer,
  WorldDomainPerformanceLayer,
  WorldDomainQualityLayer,
  WorldDomainTestLayer,
  type WorldDomainConfig,
} from './index'

export interface WorldDomainInterface {
  readonly Types: typeof WorldTypes
  readonly ValueObjects: typeof WorldValueObjects
  readonly Services: typeof WorldDomainServices
  readonly Aggregates: typeof WorldAggregates
  readonly Repositories: typeof WorldRepositories
  readonly ApplicationServices: typeof WorldApplicationServices
  readonly Factories: typeof WorldFactories
  readonly Helpers: typeof WorldDomainHelpers
  readonly Config: {
    readonly default: WorldDomainConfig
    readonly performance: WorldDomainConfig
    readonly quality: WorldDomainConfig
  }
  readonly Layers: {
    readonly default: typeof WorldDomainLayer
    readonly performance: typeof WorldDomainPerformanceLayer
    readonly quality: typeof WorldDomainQualityLayer
    readonly test: typeof WorldDomainTestLayer
  }
}

const performanceConfig = Effect.runSync(selectWorldDomainConfig('performance'))
const qualityConfig = Effect.runSync(selectWorldDomainConfig('quality'))

export const WorldDomain: WorldDomainInterface = {
  Types: WorldTypes,
  ValueObjects: WorldValueObjects,
  Services: WorldDomainServices,
  Aggregates: WorldAggregates,
  Repositories: WorldRepositories,
  ApplicationServices: WorldApplicationServices,
  Factories: WorldFactories,
  Helpers: WorldDomainHelpers,
  Config: {
    default: defaultWorldDomainConfig,
    performance: performanceConfig,
    quality: qualityConfig,
  },
  Layers: {
    default: WorldDomainLayer,
    performance: WorldDomainPerformanceLayer,
    quality: WorldDomainQualityLayer,
    test: WorldDomainTestLayer,
  },
} as const

export type { WorldDomainConfig }
