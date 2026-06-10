import type { Entity, EntityId as EntityIdType } from './entity'
import type { Position } from '@ts-minecraft/core'
import type { Vector3 } from '@ts-minecraft/core'
import type { ManagedEntity } from './entity-internal'
import { isAdult } from './breeding'

// prime tick multiplier — avoids axis-aligned movement bias
const WANDER_ANGLE_TICK_STEP = 29

// Performance boundary: plain for-loop avoids Arr.fromIterable array allocation per entity per tick
export const hashEntityId = (entityId: EntityIdType): number => {
  const str = entityId as string
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export const makeWanderDirectionFromHash = (hash: number, tick: number): Vector3 => {
  const angleDegrees = (hash + tick * WANDER_ANGLE_TICK_STEP) % 360
  const angle = angleDegrees * (Math.PI / 180)
  return {
    x: Math.cos(angle),
    y: 0,
    z: Math.sin(angle),
  }
}

export const makeWanderDirection = (entityId: EntityIdType, tick: number): Vector3 =>
  makeWanderDirectionFromHash(hashEntityId(entityId), tick)

export const toPublicEntity = (entity: ManagedEntity): Entity => ({
  entityId: entity.entityId,
  position: entity.position,
  velocity: entity.velocity,
  rotation: entity.rotation,
  health: entity.health,
  type: entity.type,
  isBaby: !isAdult(entity.ageTicks),
})


// ─── Enderman teleport ────────────────────────────────────────────────────────
// Pure function: computes the deterministic teleport position for an Enderman
// hit to nextHealth HP. The golden-ratio angle and distance-from-health formula
// reproduce vanilla Enderman escape behaviour without RNG.

export const computeEndermanTeleportPosition = (
  currentPosition: Position,
  nextHealth: number,
): Position => {
  const angle = (nextHealth * 1.618) % (Math.PI * 2)
  const dist = 4 + (Math.floor(nextHealth) % 8)
  return {
    x: currentPosition.x + Math.cos(angle) * dist,
    y: currentPosition.y,
    z: currentPosition.z + Math.sin(angle) * dist,
  }
}