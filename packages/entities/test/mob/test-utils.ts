import { EntityId, EntityType, createEntity } from '@ts-minecraft/entities'
import type { Entity, EntityType as EntityTypeT } from '@ts-minecraft/entities'
import type { Position, Vector3, Quaternion } from '@ts-minecraft/kernel'
import { zero, identity } from '@ts-minecraft/kernel'

type EntityOverrides = Partial<{
  position: Position
  velocity: Vector3
  rotation: Quaternion
  health: number
  type: EntityTypeT
}>

/**
 * Returns a valid Entity with sensible defaults.
 * Useful for unit tests that need an entity without going through EntityManager.
 */
export const makeTestEntity = (overrides: EntityOverrides = {}): Entity => {
  const position = overrides.position ?? { x: 0, y: 0, z: 0 }
  const type = overrides.type ?? EntityType.Zombie
  const health = overrides.health ?? 20
  const entityId = EntityId.make(`test-entity-${Math.random().toString(36).slice(2, 8)}`)

  return createEntity({
    entityId,
    position,
    type,
    health,
    velocity: overrides.velocity ?? zero,
    rotation: overrides.rotation ?? identity,
  })
}
