import * as WorldAggregates from '@domain/world/aggregate'
import * as WorldDomainServices from '@domain/world/domain_service'
import * as WorldRepositories from '@domain/world/repository'
import * as WorldTypes from '@domain/world/types'
import * as WorldValueObjects from '@domain/world/value_object'
import { WorldDomainHelpers, createWorldDomainLayer } from './index'

export interface WorldDomainInterface {
  readonly Types: typeof WorldTypes
  readonly ValueObjects: typeof WorldValueObjects
  readonly Services: typeof WorldDomainServices
  readonly Aggregates: typeof WorldAggregates
  readonly Repositories: typeof WorldRepositories
  readonly Helpers: typeof WorldDomainHelpers
  readonly createLayer: typeof createWorldDomainLayer
}

export const WorldDomain: WorldDomainInterface = {
  Types: WorldTypes,
  ValueObjects: WorldValueObjects,
  Services: WorldDomainServices,
  Aggregates: WorldAggregates,
  Repositories: WorldRepositories,
  Helpers: WorldDomainHelpers,
  createLayer: createWorldDomainLayer,
} as const
