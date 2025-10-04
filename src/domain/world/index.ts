// -----------------------------------------------------------------------------
// Barrel Exports – World Domain
// -----------------------------------------------------------------------------

export * from './types'
export * from './value_object'
export * from './domain_service'
export * from './aggregate'
export * from './repository'
export * from './application_service'
export * from './factory'

export * from './config'
export * from './layers'
export * from './helpers'
export * from './metadata'
export * from './typeguards'
export * from './time'
export * from './domain'

export type {
  WorldGenerator,
  GenerationSession,
  BiomeSystem,
} from './aggregate'

export type {
  WorldSeed,
  WorldCoordinate,
  ChunkCoordinate,
  BlockCoordinate,
} from './value_object'

export type {
  WorldTypesError,
  WorldDomainError,
  GenerationDomainError,
  ValidationDomainError,
} from './types'

export type {
  WorldRepositoryLayerConfig,
  WorldRepositoryServices,
} from './repository'

export type {
  WorldApplicationService,
  WorldApplicationServiceErrorType,
} from './application_service'
