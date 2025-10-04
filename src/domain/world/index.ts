// -----------------------------------------------------------------------------
// Barrel Exports – World Domain
// -----------------------------------------------------------------------------

export * from './aggregate'
export * from './application_service'
export * from './domain_service'
export * from './factory'
export * from './repository'
export * from './types'
export * from './value_object'

export * from './config'
export * from './domain'
export * from './helpers'
export * from './layers'
export * from './metadata'
export * from './time'
export * from './typeguards'

export type { BiomeSystem, GenerationSession, WorldGenerator } from './aggregate'

export type { BlockCoordinate, ChunkCoordinate, WorldCoordinate, WorldSeed } from './value_object'

export type { GenerationDomainError, ValidationDomainError, WorldDomainError, WorldTypesError } from './types'

export type { WorldRepositoryLayerConfig, WorldRepositoryServices } from './repository'

export type { WorldApplicationService, WorldApplicationServiceErrorType } from './application_service'
