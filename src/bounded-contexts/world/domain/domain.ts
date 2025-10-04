import { Effect } from 'effect'
import * as WorldTypes from './types'
import * as WorldValueObjects from './value-object'
import * as WorldAggregates from './aggregate'
import * as WorldRepositories from './repository'
import * as WorldApplicationServices from './application-service'
import * as WorldFactories from './factory'
import { WorldDomainHelpers } from './helpers'
import {
  defaultWorldDomainConfig,
  selectWorldDomainConfig,
  type WorldDomainConfig,
} from './config'
import {
  WorldDomainLayer,
  WorldDomainPerformanceLayer,
  WorldDomainQualityLayer,
  WorldDomainTestLayer,
} from './layers'

export interface WorldDomainInterface {
  readonly Types: typeof WorldTypes
  readonly ValueObjects: typeof WorldValueObjects
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
