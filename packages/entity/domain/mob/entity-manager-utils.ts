import type { ManagedEntity } from './entity-internal'
import { distanceToPlayerSq } from './state-machine'
import type { Position, Vector3 } from '@ts-minecraft/core'

// ── Constants ────────────────────────────────────────────────────────────────

export const WANDER_REDIRECT_PROBABILITY = 0.2
export const WANDER_PHASE_TICK_STEP = 17
export const MOB_GRAVITY_Y = -9.82
export const MOB_TERMINAL_VELOCITY_Y = -32
export const MOB_JUMP_VELOCITY_Y = 4.2
export const MOB_STUCK_EPSILON = 1e-4
export const WANDER_STUCK_REDIRECT_TICK_OFFSET = 11

// ── Types ────────────────────────────────────────────────────────────────────

export type CollisionResolution = {
  readonly position: Position
  readonly velocity: Vector3
  readonly isGrounded: boolean
}

export type CollisionResolver = (
  position: Position,
  velocity: Vector3,
) => CollisionResolution

// ── Pure Helper Functions ────────────────────────────────────────────────────

export const isHorizontalBlocked = (before: Vector3, after: Vector3): boolean =>
  (Math.abs(before.x) > MOB_STUCK_EPSILON && Math.abs(after.x) <= MOB_STUCK_EPSILON)
  || (Math.abs(before.z) > MOB_STUCK_EPSILON && Math.abs(after.z) <= MOB_STUCK_EPSILON)

export const toHorizontalTarget = (entityPosition: Position, playerPosition: Position): Position => ({
  x: playerPosition.x,
  y: entityPosition.y,
  z: playerPosition.z,
})

export const isSamePosition = (left: Position, right: Position): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z

export const isSameVelocity = (left: Vector3, right: Vector3): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z

export const isFinitePosition = (position: Position): boolean =>
  Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)

export const isFiniteVelocity = (velocity: Vector3): boolean =>
  Number.isFinite(velocity.x) && Number.isFinite(velocity.y) && Number.isFinite(velocity.z)

export const shouldDespawnEntity = (
  entity: ManagedEntity,
  playerPosition: Position,
  maxDistance: number,
): boolean => {
  if (!isFinitePosition(entity.position) || !isFiniteVelocity(entity.velocity)) {
    return true
  }

  return distanceToPlayerSq(entity.position, playerPosition) > maxDistance * maxDistance
}
