// Use the canonical EntityId from value-objects instead of duplicate definition
export { EntityId, makeEntityId } from '@domain/value-objects/entity-id.value-object'

// Re-export WorldState from domain entities for compatibility
export { WorldState as World } from '@domain/entities/world.entity'
