import { Array as Arr, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { AIState, computeStateVelocityInto, distanceToPlayerSq, resolveAIState } from '../../domain/mob/state-machine'
import { EntityType, type Entity, type EntityId } from '../../domain/mob/entity'
import { tickCreeperFuse } from '../../domain/mob/creeper-fuse'
import { tickBreedingTimers } from '../../domain/mob/breeding'
import { tickWoolRegrowth } from '../../domain/mob/shearing'
import {
  TELEPORT_ATTEMPTS,
  computeEndermanTeleportTarget,
  shouldEndermanTeleport,
} from '../../domain/mob/enderman-teleport'
import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { hashEntityId, makeWanderDirectionFromHash } from '../../domain/mob/entity-utils'
import {
  type CollisionResolver,
  MOB_GRAVITY_Y,
  MOB_JUMP_VELOCITY_Y,
  MOB_TERMINAL_VELOCITY_Y,
  WANDER_PHASE_TICK_STEP,
  WANDER_REDIRECT_PROBABILITY,
  WANDER_STUCK_REDIRECT_TICK_OFFSET,
  isHorizontalBlocked,
  isSamePosition,
  isSameVelocity,
} from '../../domain/mob/entity-manager-utils'

// Module-scoped scratch for the per-entity collision INPUTS (candidate position/velocity).
// These are never retained — the resolver only reads them — and updateAllEntities maps
// entities sequentially (HashMap.map), so a single shared pair is safe and avoids two
// object literals per entity per physics tick.
const _candPos = { x: 0, y: 0, z: 0 }
const _candVel = { x: 0, y: 0, z: 0 }
// Module-scoped scratch for the per-entity AI steering velocity. Not retained — the
// caller reads .x/.z immediately into a fresh velocity object — and processEntityAI runs
// inside the sequential HashMap.map, so a single shared object is safe.
const _stateVel = { x: 0, y: 0, z: 0 }

type EntityFrameContext = {
  readonly tick: number
  readonly deltaTime: DeltaTimeSecs
  readonly playerPosition: Position
  readonly daytimeBurningActive: boolean
}

const makeTeleportAttempts = (hash: number, tick: number): ReadonlyArray<number> =>
  Arr.makeBy(TELEPORT_ATTEMPTS * 2, (index) =>
    ((hash + tick * 131 + index * 977) % 1000) / 1000
  )

const processEntityAI = (
  entity: ManagedEntity,
  entityId: EntityId,
  ctx: EntityFrameContext,
  dirtyRef: MutableRef.MutableRef<boolean>,
  hasCreeperRef: MutableRef.MutableRef<boolean>,
  hasShearedSheepRef: MutableRef.MutableRef<boolean>,
): ManagedEntity => {
  const { tick, deltaTime, playerPosition, daytimeBurningActive } = ctx

  if (entity.type === EntityType.Creeper) MutableRef.set(hasCreeperRef, true)
  if (entity.woolRegrowthTicks > 0) MutableRef.set(hasShearedSheepRef, true)

  const hash = hashEntityId(entityId)
  const distSq = distanceToPlayerSq(entity.position, playerPosition)
  const distance = Math.sqrt(distSq)
  const randomWanderRoll = ((hash + tick * WANDER_PHASE_TICK_STEP) % 1000) / 1000

  const nextState = resolveAIState(entity.aiState, {
    behavior: entity.behavior,
    distanceToPlayer: distance,
    canSeePlayer: distSq <= entity.detectionRange * entity.detectionRange,
    healthRatio: entity.health / entity.maxHealth,
    randomWanderRoll,
    attackRange: entity.attackRange,
    detectionRange: entity.detectionRange,
    fleeHealthThreshold: entity.fleeHealthThreshold,
  })

  const nextAttackCooldown = Math.max(0, entity.attackCooldownRemaining - deltaTime)

  const tickedBreeding = tickBreedingTimers({
    loveTicksRemaining: entity.loveTicksRemaining,
    breedCooldownRemaining: entity.breedCooldownRemaining,
    ageTicks: entity.ageTicks,
  })
  const breedingChanged =
    tickedBreeding.loveTicksRemaining !== entity.loveTicksRemaining
    || tickedBreeding.breedCooldownRemaining !== entity.breedCooldownRemaining
    || tickedBreeding.ageTicks !== entity.ageTicks

  const burning = daytimeBurningActive && entity.behavior === 'hostile'

  if (entity.knockbackTicksRemaining > 0) {
    MutableRef.set(dirtyRef, true)
    return {
      ...entity,
      ...tickedBreeding,
      attackCooldownRemaining: nextAttackCooldown,
      knockbackTicksRemaining: entity.knockbackTicksRemaining - 1,
    }
  }

  if (!burning
    && nextState === entity.aiState
    && (nextState === AIState.Idle || nextState === AIState.Attack)
    && entity.velocity.x === 0 && entity.velocity.z === 0) {
    if (nextAttackCooldown === entity.attackCooldownRemaining && !breedingChanged) {
      return entity
    }
    MutableRef.set(dirtyRef, true)
    return {
      ...entity,
      ...tickedBreeding,
      attackCooldownRemaining: nextAttackCooldown,
    }
  }

  MutableRef.set(dirtyRef, true)

  if (
    entity.type === EntityType.Enderman
    && nextState === AIState.Chase
    && shouldEndermanTeleport(false, entity.stuckTicks ?? 0, randomWanderRoll)
  ) {
    const teleportTarget = computeEndermanTeleportTarget(
      entity.position,
      playerPosition,
      makeTeleportAttempts(hash, tick),
    )
    if (teleportTarget !== null) {
      return {
        ...entity,
        ...tickedBreeding,
        position: teleportTarget,
        velocity: { x: 0, y: entity.velocity.y, z: 0 },
        aiState: nextState,
        attackCooldownRemaining: nextAttackCooldown,
        stuckTicks: 0,
      }
    }
  }

  const wanderDirection =
    nextState === AIState.Wander
    && (entity.aiState !== AIState.Wander || randomWanderRoll < WANDER_REDIRECT_PROBABILITY)
      ? makeWanderDirectionFromHash(hash, tick)
      : entity.wanderDirection

  // toHorizontalTarget set target.y = entity.y, so the chase/flee direction is purely
  // horizontal — computeStateVelocityInto bakes that in and writes into shared scratch.
  computeStateVelocityInto(
    _stateVel,
    nextState,
    entity.position.x, entity.position.z,
    playerPosition.x, playerPosition.z,
    entity.speed,
    wanderDirection.x, wanderDirection.y, wanderDirection.z,
  )
  const velocity: Vector3 = {
    x: _stateVel.x,
    y: entity.velocity.y,
    z: _stateVel.z,
  }

  const burnDamage = burning ? 1 : 0
  if (burnDamage > 0) MutableRef.set(dirtyRef, true)

  return {
    ...entity,
    ...tickedBreeding,
    health: Math.max(0, entity.health - burnDamage),
    aiState: nextState,
    velocity,
    wanderDirection,
    attackCooldownRemaining: nextAttackCooldown,
    stuckTicks: nextState === AIState.Chase ? entity.stuckTicks : 0,
  }
}

export const makeEntityManagerUpdate = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  updateTickRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => {
  const updateAllEntities = (f: (entity: ManagedEntity, id: EntityId) => ManagedEntity) =>
    Ref.update(entitiesRef, (entities) => HashMap.map(entities, f))

  return {
    update: (
      deltaTime: DeltaTimeSecs,
      playerPosition: Position,
      isNight: boolean = true,
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)
        const dirtyRef = MutableRef.make(false)
        const daytimeBurningActive = !isNight && tick % 20 === 0
        const hasCreeperRef = MutableRef.make(false)
        const hasShearedSheepRef = MutableRef.make(false)
        const ctx = { tick, deltaTime, playerPosition, daytimeBurningActive }

        yield* updateAllEntities((entity, entityId) =>
          processEntityAI(entity, entityId, ctx, dirtyRef, hasCreeperRef, hasShearedSheepRef)
        )

        if (MutableRef.get(hasCreeperRef)) {
          yield* updateAllEntities((entity) => {
            if (entity.type !== EntityType.Creeper) return entity
            const nextFuse = tickCreeperFuse(
              entity.position,
              playerPosition,
              { fuseSecs: entity.fuseSecs, ignited: entity.fuseSecs > 0 },
              deltaTime,
            ).state.fuseSecs
            return nextFuse === entity.fuseSecs ? entity : { ...entity, fuseSecs: nextFuse }
          })
        }

        if (MutableRef.get(hasShearedSheepRef)) {
          yield* updateAllEntities((entity) =>
            entity.woolRegrowthTicks > 0
              ? { ...entity, woolRegrowthTicks: tickWoolRegrowth(entity.woolRegrowthTicks) }
              : entity
          )
        }

        if (daytimeBurningActive) {
          const changed = yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
            /* c8 ignore start -- daytime burning cleanup; requires tick=20 and hostile entity at 0 health */
            const updated = HashMap.filter(entities, (entity) => entity.behavior !== 'hostile' || entity.health > 0)
            const changedFlag = HashMap.size(updated) !== HashMap.size(entities)
            /* c8 ignore end */
            return [changedFlag, updated]
          })
          /* c8 ignore next 5 -- cache invalidation after burning cleanup; only fires when changed=true */
          if (changed) {
            yield* Ref.set(cachedEntitiesRef, Option.none())
            yield* Ref.update(structureVersionRef, (v) => v + 1)
          }
        } else if (MutableRef.get(dirtyRef)) {
          yield* Ref.set(cachedEntitiesRef, Option.none())
        }
      }),

    applyPhysics: (
      deltaTime: DeltaTimeSecs,
      resolveCollision: CollisionResolver,
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const dirtyRef = MutableRef.make(false)
        const tick = yield* Ref.get(updateTickRef)

        yield* updateAllEntities((entity, entityId) => {
          const isFlyingType = entity.type === 'EnderDragon'
          // Transient collision inputs — written into shared module scratch (not retained).
          _candVel.x = entity.velocity.x
          _candVel.y = isFlyingType
            ? entity.velocity.y
            : Math.max(entity.velocity.y + MOB_GRAVITY_Y * deltaTime, MOB_TERMINAL_VELOCITY_Y)
          _candVel.z = entity.velocity.z
          _candPos.x = entity.position.x + _candVel.x * deltaTime
          _candPos.y = entity.position.y + _candVel.y * deltaTime
          _candPos.z = entity.position.z + _candVel.z * deltaTime
          // outPos/outVel ARE retained (they become the entity's next position/velocity),
          // so they must be freshly allocated per entity; the resolver writes into them and
          // returns isGrounded — no transient wrapper object is allocated.
          const resolvedPosition = { x: 0, y: 0, z: 0 }
          const resolvedVelocity = { x: 0, y: 0, z: 0 }
          const resolvedGrounded = resolveCollision(resolvedPosition, resolvedVelocity, _candPos, _candVel)
          const shouldHop = entity.isGrounded
            && resolvedGrounded
            && isHorizontalBlocked(_candVel, resolvedVelocity)
          const velocity = shouldHop
            ? { x: resolvedVelocity.x, y: MOB_JUMP_VELOCITY_Y, z: resolvedVelocity.z }
            : resolvedVelocity
          const wanderDirection = shouldHop
            ? makeWanderDirectionFromHash(
                hashEntityId(entityId),
                tick + WANDER_STUCK_REDIRECT_TICK_OFFSET,
              )
            : entity.wanderDirection
          const stuckTicks = entity.type === EntityType.Enderman && entity.aiState === AIState.Chase
            ? shouldHop ? (entity.stuckTicks ?? 0) + 1 : 0
            : entity.stuckTicks

          /* c8 ignore start -- early-return when entity state is identical after physics; requires exact position/velocity match */
          if (
            isSamePosition(entity.position, resolvedPosition)
            && isSameVelocity(entity.velocity, velocity)
            && isSameVelocity(entity.wanderDirection, wanderDirection)
            && entity.isGrounded === resolvedGrounded
            && entity.stuckTicks === stuckTicks
          ) {
            return entity
          }
          /* c8 ignore end */

          MutableRef.set(dirtyRef, true)
          return {
            ...entity,
            position: resolvedPosition,
            velocity,
            wanderDirection,
            isGrounded: resolvedGrounded,
            stuckTicks,
          }
        })

        if (MutableRef.get(dirtyRef)) {
          yield* Ref.set(cachedEntitiesRef, Option.none())
        }
      }),
  }
}
