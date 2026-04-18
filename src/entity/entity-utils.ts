import type { Entity, EntityId as EntityIdType } from '@/entity/entity'
import type { Vector3 } from '@/shared/math/three'
import type { ManagedEntity } from './entity-internal'

// Performance boundary: plain for-loop avoids Arr.fromIterable array allocation per entity per tick
export const hashEntityId = (entityId: EntityIdType): number => {
  const str = entityId as string
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export const makeWanderDirection = (entityId: EntityIdType, tick: number): Vector3 => {
  const angleDegrees = (hashEntityId(entityId) + tick * 29) % 360
  const angle = angleDegrees * (Math.PI / 180)
  return {
    x: Math.cos(angle),
    y: 0,
    z: Math.sin(angle),
  }
}

export const toPublicEntity = (entity: ManagedEntity): Entity => ({
  entityId: entity.entityId,
  position: entity.position,
  velocity: entity.velocity,
  rotation: entity.rotation,
  health: entity.health,
  type: entity.type,
})
