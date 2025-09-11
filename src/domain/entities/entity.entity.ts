// Use the canonical EntityId from value-objects instead of duplicate definition
export { EntityId, makeEntityId } from '../value-objects/entity-id.vo'

// Re-export WorldState from domain entities for compatibility
export { WorldState as World } from './world.entity'
