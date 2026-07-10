import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { hashEntityId, makeWanderDirectionFromHash } from '../../domain/mob/entity-utils'
import { AIState } from '../../domain/mob/state-machine'
import {
  type CollisionResolver,
  MOB_GRAVITY_Y,
  MOB_JUMP_VELOCITY_Y,
  MOB_TERMINAL_VELOCITY_Y,
  WANDER_STUCK_REDIRECT_TICK_OFFSET,
  isHorizontalBlocked,
} from '../../domain/mob/entity-manager-utils'
import type { EntityPhysicsFrame } from './entity-manager-physics-reuse'

// Module-scoped scratch for the per-entity collision INPUTS (candidate position/velocity).
// These are never retained — the resolver only reads them — and the shared entity-map
// traversal used by the mob manager stays sequential, so a single shared pair is safe and
// avoids two object literals per entity per physics tick.
// Hover tuning (Ghast/Blaze): a firm lift while touching ground, then a slow
// ±0.6-block/s bob that keeps them airborne without net climb.
const HOVER_LIFT_VELOCITY_Y = 2.2
const HOVER_BOB_RATE = 0.11
const HOVER_BOB_AMPLITUDE_Y = 0.6

const _candPos = { x: 0, y: 0, z: 0 }
const _candVel = { x: 0, y: 0, z: 0 }

export type EntityPhysicsFrameContext = {
  readonly tick: number
  readonly deltaTime: DeltaTimeSecs
  readonly resolveCollision: CollisionResolver
}

export const prepareEntityPhysicsFrame = (
  entity: ManagedEntity,
  entityId: EntityId,
  ctx: EntityPhysicsFrameContext,
): EntityPhysicsFrame => {
  const { tick, deltaTime, resolveCollision } = ctx
  // The dragon's flight AI owns its own vertical velocity; Ghasts and Blazes
  // HOVER instead of walking (the long-deferred flight gap): lift off while
  // grounded, then ride a deterministic tick-driven bob around their altitude.
  const isDragon = entity.type === EntityType.EnderDragon
  // Guardians "hover" too: the same mechanic keeps them suspended in their
  // water column instead of sinking to the seabed like a land mob.
  const isHoverType = entity.type === EntityType.Ghast || entity.type === EntityType.Blaze || entity.type === EntityType.Guardian
  const hoverY = entity.isGrounded
    ? HOVER_LIFT_VELOCITY_Y
    : Math.sin(tick * HOVER_BOB_RATE) * HOVER_BOB_AMPLITUDE_Y

  // Transient collision inputs — written into shared module scratch (not retained).
  _candVel.x = entity.velocity.x
  _candVel.y = isDragon
    ? entity.velocity.y
    : isHoverType
      ? hoverY
      : Math.max(entity.velocity.y + MOB_GRAVITY_Y * deltaTime, MOB_TERMINAL_VELOCITY_Y)
  _candVel.z = entity.velocity.z
  _candPos.x = entity.position.x + _candVel.x * deltaTime
  _candPos.y = entity.position.y + _candVel.y * deltaTime
  _candPos.z = entity.position.z + _candVel.z * deltaTime

  // outPos/outVel ARE retained (they become the entity's next position/velocity),
  // so they must be freshly allocated per entity; the resolver writes into them and
  // returns isGrounded — no transient wrapper object is allocated.
  const position = { x: 0, y: 0, z: 0 }
  const velocity = { x: 0, y: 0, z: 0 }
  const isGrounded = resolveCollision(position, velocity, _candPos, _candVel)
  const shouldHop = entity.isGrounded
    && isGrounded
    && isHorizontalBlocked(_candVel, velocity)
  const nextVelocity = shouldHop
    ? { x: velocity.x, y: MOB_JUMP_VELOCITY_Y, z: velocity.z }
    : velocity
  const wanderDirection = shouldHop
    ? makeWanderDirectionFromHash(
        hashEntityId(entityId),
        tick + WANDER_STUCK_REDIRECT_TICK_OFFSET,
      )
    : entity.wanderDirection
  // Any chaser bumping an obstacle accumulates stuckTicks: endermen use it
  // for their unstick teleport, every other mob for the A* chase detour.
  const stuckTicks = entity.aiState === AIState.Chase
    ? shouldHop
      ? entity.stuckTicks + 1
      : 0
    : entity.stuckTicks

  return {
    position,
    velocity: nextVelocity,
    wanderDirection,
    isGrounded,
    stuckTicks,
  }
}
