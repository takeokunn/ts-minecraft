import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { AIState, computeStateVelocity, distanceToPlayerSq, resolveAIState } from '../../domain/mob/state-machine'
import { EntityType, type Entity, type EntityId } from '../../domain/mob/entity'
import { tickCreeperFuse } from '../../domain/mob/creeper-fuse'
import { tickBreedingTimers } from '../../domain/mob/breeding'
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
  toHorizontalTarget,
} from '../../domain/mob/entity-manager-utils'

const makeTeleportAttempts = (hash: number, tick: number): ReadonlyArray<number> =>
  Array.from({ length: TELEPORT_ATTEMPTS * 2 }, (_, index) =>
    ((hash + tick * 131 + index * 977) % 1000) / 1000
  )

export const makeEntityManagerUpdate = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  updateTickRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  update: (
    deltaTime: DeltaTimeSecs,
    playerPosition: Position,
    isNight: boolean = true,
  ): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)
      const dirtyRef = MutableRef.make(false)
      const daytimeBurningActive = !isNight && tick % 20 === 0

      yield* Ref.update(entitiesRef, (entities) =>
        HashMap.map(entities, (entity, entityId) => {
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

          // FR R6: decay breeding timers (love/cooldown down, baby age up). Clamped
          // at maturity so an idle adult yields an unchanged state — preserving the
          // early-return fast path below. `breedingChanged` is folded into every
          // return so the counters tick regardless of which AI branch fires.
          const tickedBreeding = tickBreedingTimers({
            loveTicksRemaining: entity.loveTicksRemaining,
            breedCooldownRemaining: entity.breedCooldownRemaining,
            ageTicks: entity.ageTicks,
          })
          const breedingChanged =
            tickedBreeding.loveTicksRemaining !== entity.loveTicksRemaining
            || tickedBreeding.breedCooldownRemaining !== entity.breedCooldownRemaining
            || tickedBreeding.ageTicks !== entity.ageTicks

          // A hostile mob on a daylight burn tick must take 1 burn damage; it must NOT
          // hit the unchanged-state early-return below (which skips the burn entirely),
          // or stationary idle/attacking hostiles become immune to daylight.
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

          const horizontalVelocity = computeStateVelocity({
            state: nextState,
            entityPosition: entity.position,
            playerPosition: toHorizontalTarget(entity.position, playerPosition),
            speed: entity.speed,
            wanderDirection,
          })
          const velocity: Vector3 = {
            x: horizontalVelocity.x,
            y: entity.velocity.y,
            z: horizontalVelocity.z,
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
        })
      )

      // Advance creeper detonation fuses: burn while the player is in ignition
      // range, reset otherwise. Detonation is resolved in getPlayerContactDamage,
      // which runs later this frame (physics stage follows the entity-update stage).
      yield* Ref.update(entitiesRef, (entities) =>
        HashMap.map(entities, (entity) => {
          if (entity.type !== EntityType.Creeper) return entity
          const nextFuse = tickCreeperFuse(
            entity.position,
            playerPosition,
            { fuseSecs: entity.fuseSecs, ignited: entity.fuseSecs > 0 },
            deltaTime,
          ).state.fuseSecs
          return nextFuse === entity.fuseSecs ? entity : { ...entity, fuseSecs: nextFuse }
        })
      )

      if (daytimeBurningActive) {
        yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
          let changed = false
          let updated = entities
          HashMap.forEach(entities, (entity, id) => {
            /* c8 ignore start -- daytime burning cleanup; requires tick=20 and hostile entity at 0 health */
            if (entity.behavior === 'hostile' && entity.health <= 0) {
              updated = HashMap.remove(updated, id)
              changed = true
            }
            /* c8 ignore end */
          })
          return [changed, updated]
        }).pipe(Effect.flatMap((changed) =>
          /* c8 ignore next 5 -- cache invalidation after burning cleanup; only fires when changed=true */
          changed
            ? Effect.all([
                Ref.set(cachedEntitiesRef, Option.none()),
                Ref.update(structureVersionRef, (v) => v + 1),
              ], { concurrency: 'unbounded', discard: true })
            : Effect.void,
        ))
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

      yield* Ref.update(entitiesRef, (entities) =>
        HashMap.map(entities, (entity, entityId) => {
          const isFlyingType = entity.type === 'EnderDragon'
          const candidateVelocity: Vector3 = {
            x: entity.velocity.x,
            y: isFlyingType
              ? entity.velocity.y
              : Math.max(entity.velocity.y + MOB_GRAVITY_Y * deltaTime, MOB_TERMINAL_VELOCITY_Y),
            z: entity.velocity.z,
          }
          const candidatePosition: Position = {
            x: entity.position.x + candidateVelocity.x * deltaTime,
            y: entity.position.y + candidateVelocity.y * deltaTime,
            z: entity.position.z + candidateVelocity.z * deltaTime,
          }
          const resolved = resolveCollision(candidatePosition, candidateVelocity)
          const shouldHop = entity.isGrounded
            && resolved.isGrounded
            && isHorizontalBlocked(candidateVelocity, resolved.velocity)
          const velocity = shouldHop
            ? { ...resolved.velocity, y: MOB_JUMP_VELOCITY_Y }
            : resolved.velocity
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
            isSamePosition(entity.position, resolved.position)
            && isSameVelocity(entity.velocity, velocity)
            && isSameVelocity(entity.wanderDirection, wanderDirection)
            && entity.isGrounded === resolved.isGrounded
            && entity.stuckTicks === stuckTicks
          ) {
            return entity
          }
          /* c8 ignore end */

          MutableRef.set(dirtyRef, true)
          return {
            ...entity,
            position: resolved.position,
            velocity,
            wanderDirection,
            isGrounded: resolved.isGrounded,
            stuckTicks,
          }
        })
      )

      if (MutableRef.get(dirtyRef)) {
        yield* Ref.set(cachedEntitiesRef, Option.none())
      }
    }),
})
