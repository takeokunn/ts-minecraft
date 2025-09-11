/**
 * Core module exports - fundamental types, values, and utilities
 */

// Core types and schemas
export * from './types'

// Core common utilities and branded types
export * from './common'

// All value objects (without conflicts)
export * from './values'

// Core entities (excluding duplicates)
export type { EntityId } from './entities/entity'
export { EntityIdSchema, toEntityId, World } from './entities/entity'
export type { PlacedBlock, FaceName, BlockType } from './entities/block'
export { PlacedBlockSchema, FaceNameSchema } from './entities/block'
export { 
  BlockDefinitionSchema as EntityBlockDefinitionSchema,
  blockDefinitions 
} from './entities/block-definitions'
export type { 
  BlockDefinition as EntityBlockDefinition,
  BlockDefinitions 
} from './entities/block-definitions'

// Core errors
export * from './errors'

// Core components
export * from './components'