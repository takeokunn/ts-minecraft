import type { Position, Vector3 } from '@ts-minecraft/core'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import {
  isSamePosition,
  isSameVelocity,
} from '../../domain/mob/entity-manager-utils'

export type EntityPhysicsFrame = Readonly<{
  position: Position
  velocity: Vector3
  wanderDirection: Vector3
  isGrounded: boolean
  stuckTicks: number
}>

export const shouldReuseEntityPhysicsFrame = (
  entity: ManagedEntity,
  frame: EntityPhysicsFrame,
): boolean =>
  isSamePosition(entity.position, frame.position)
  && isSameVelocity(entity.velocity, frame.velocity)
  && isSameVelocity(entity.wanderDirection, frame.wanderDirection)
  && entity.isGrounded === frame.isGrounded
  && entity.stuckTicks === frame.stuckTicks
