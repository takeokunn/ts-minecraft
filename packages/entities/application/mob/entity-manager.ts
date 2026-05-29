import { Array as Arr, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import type { EntityDrop } from '../../domain/mob/drop'
import { AIState, computeStateVelocity, distanceToPlayerSq, resolveAIState } from '../../domain/mob/state-machine'
import {
  EntityId,
  EntityType,
  createEntity as createEntityModel,
  type Entity,
  type EntityId as EntityIdType,
} from '../../domain/mob/entity'
import { getMobDefinition } from '../../domain/mob/mobs'
import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/kernel'
import { zero } from '@ts-minecraft/kernel'
import { HOSTILE_ATTACK_COOLDOWN_SECS, type ManagedEntity } from '../../domain/mob/entity-internal'
import { KNOCKBACK_DURATION_TICKS } from '../../domain/combat'
import { hashEntityId, makeWanderDirectionFromHash, toPublicEntity } from '../../domain/mob/entity-utils'

// probability of choosing a new wander direction each tick
const WANDER_REDIRECT_PROBABILITY = 0.2
// prime tick multiplier — avoids periodicity in wander direction
const WANDER_PHASE_TICK_STEP = 17
const MOB_GRAVITY_Y = -9.82
// Terminal downward fall velocity for mobs (mirrors the player cap in
// physics-world-service). Without it, free-fall velocity grows unbounded and a
// single step can move a mob farther than its own ~1.8-block height, past the
// AABB resolver's current-bbox scan, letting it tunnel through floors. Safe cap
// = mobHeight / dtCeiling = 1.8 / 0.05 = 36; -32 leaves margin (per-step ≤ 1.6).
const MOB_TERMINAL_VELOCITY_Y = -32
const MOB_JUMP_VELOCITY_Y = 4.2
const MOB_STUCK_EPSILON = 1e-4
const WANDER_STUCK_REDIRECT_TICK_OFFSET = 11

const isHorizontalBlocked = (before: Vector3, after: Vector3): boolean =>
  (Math.abs(before.x) > MOB_STUCK_EPSILON && Math.abs(after.x) <= MOB_STUCK_EPSILON)
  || (Math.abs(before.z) > MOB_STUCK_EPSILON && Math.abs(after.z) <= MOB_STUCK_EPSILON)

type CollisionResolution = {
  readonly position: Position
  readonly velocity: Vector3
  readonly isGrounded: boolean
}

type CollisionResolver = (
  position: Position,
  velocity: Vector3,
) => CollisionResolution

const toHorizontalTarget = (entityPosition: Position, playerPosition: Position): Position => ({
  x: playerPosition.x,
  y: entityPosition.y,
  z: playerPosition.z,
})

const isSamePosition = (left: Position, right: Position): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z

const isSameVelocity = (left: Vector3, right: Vector3): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z

const isFinitePosition = (position: Position): boolean =>
  Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)

const isFiniteVelocity = (velocity: Vector3): boolean =>
  Number.isFinite(velocity.x) && Number.isFinite(velocity.y) && Number.isFinite(velocity.z)

const shouldDespawnEntity = (
  entity: ManagedEntity,
  playerPosition: Position,
  maxDistance: number,
): boolean => {
  if (!isFinitePosition(entity.position) || !isFiniteVelocity(entity.velocity)) {
    return true
  }

  return distanceToPlayerSq(entity.position, playerPosition) > maxDistance * maxDistance
}

export class EntityManager extends Effect.Service<EntityManager>()(
  '@minecraft/entity/EntityManager',
  {
    effect: Effect.all([
      Ref.make(HashMap.empty<EntityIdType, ManagedEntity>()),
      Ref.make(1),
      Ref.make(0),
      Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.none()),
      Ref.make(0),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([entitiesRef, nextEntityNumberRef, updateTickRef, cachedEntitiesRef, structureVersionRef]) => ({
        addEntity: (
          type: EntityType,
          position: Position,
        ): Effect.Effect<EntityIdType, never> =>
          Effect.gen(function* () {
            const definition = getMobDefinition(type)
            const entityId = yield* Ref.modify(nextEntityNumberRef, (next): [EntityIdType, number] => [
              EntityId.make(`entity-${next}`),
              next + 1,
            ])

            const managedEntity: ManagedEntity = {
              ...createEntityModel({
                entityId,
                position,
                type,
                health: definition.maxHealth,
              }),
              behavior: definition.behavior,
              maxHealth: definition.maxHealth,
              attackDamage: definition.attackDamage,
              speed: definition.speed,
              detectionRange: definition.detectionRange,
              attackRange: definition.attackRange,
              fleeHealthThreshold: definition.fleeHealthThreshold,
              drops: definition.drops as ReadonlyArray<EntityDrop>,
              aiState: AIState.Idle,
              wanderDirection: zero,
              attackCooldownRemaining: 0,
              isGrounded: false,
              knockbackTicksRemaining: 0,
            }

            yield* Ref.update(entitiesRef, (entities) =>
              HashMap.set(entities, entityId, managedEntity)
            )
            yield* Ref.set(cachedEntitiesRef, Option.none())
            yield* Ref.update(structureVersionRef, (version) => version + 1)

            return entityId
          }),

        removeEntity: (entityId: EntityIdType): Effect.Effect<boolean, never> =>
          Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityIdType, ManagedEntity>] =>
            Option.match(HashMap.get(entities, entityId), {
              onNone: () => [false, entities],
              onSome: () => [true, HashMap.remove(entities, entityId)],
            })
          ).pipe(Effect.tap((removed) => removed
            ? Effect.all([
                Ref.set(cachedEntitiesRef, Option.none()),
                Ref.update(structureVersionRef, (version) => version + 1),
              ], { concurrency: 'unbounded', discard: true })
            : Effect.void)),

        getEntity: (entityId: EntityIdType): Effect.Effect<Option.Option<Entity>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), toPublicEntity))
          ),

        getEntities: (): Effect.Effect<ReadonlyArray<Entity>, never> =>
          Ref.get(cachedEntitiesRef).pipe(
            Effect.flatMap((cached) =>
              Option.match(cached, {
                onSome: Effect.succeed,
                onNone: () =>
                  Ref.get(entitiesRef).pipe(
                    Effect.flatMap((entities) => {
                      const result = Arr.map(
                        Arr.fromIterable(HashMap.values(entities)),
                        toPublicEntity
                      ) as ReadonlyArray<Entity>
                      return Ref.set(cachedEntitiesRef, Option.some(result)).pipe(Effect.as(result))
                    })
                  ),
              })
            )
          ),

        getEntityAIState: (entityId: EntityIdType): Effect.Effect<Option.Option<AIState>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), (entity) => entity.aiState))
          ),

        getCount: (): Effect.Effect<number, never> =>
          Ref.get(entitiesRef).pipe(Effect.map(HashMap.size)),

        getStructureVersion: (): Effect.Effect<number, never> => Ref.get(structureVersionRef),

        getPlayerContactDamage: (playerPosition: Position): Effect.Effect<number, never> =>
          Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityIdType, ManagedEntity>] => {
              let totalDamage = 0
              let updatedEntities = entities
              HashMap.forEach(entities, (entity) => {
                if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return
                if (entity.attackCooldownRemaining > 0) return
                const distSq = distanceToPlayerSq(entity.position, playerPosition)
                if (distSq <= entity.attackRange * entity.attackRange) {
                  totalDamage += entity.attackDamage
                  updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
                    ...entity,
                    attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
                  })
                }
              })
              return [totalDamage, totalDamage > 0 ? updatedEntities : entities]
            }).pipe(Effect.tap((damage) => damage > 0 ? Ref.set(cachedEntitiesRef, Option.none()) : Effect.void)),

        update: (
          deltaTime: DeltaTimeSecs,
          playerPosition: Position,
          isNight: boolean = true,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)
            const dirtyRef = MutableRef.make(false)
            // Hostile mobs burn in daylight every 20 ticks (≈ 1 s at 20 UPS).
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

                // Knockback active: yield horizontal velocity control to the shove
                // (applyPhysics integrates entity.velocity) and tick the timer down.
                if (entity.knockbackTicksRemaining > 0) {
                  MutableRef.set(dirtyRef, true)
                  return {
                    ...entity,
                    attackCooldownRemaining: nextAttackCooldown,
                    knockbackTicksRemaining: entity.knockbackTicksRemaining - 1,
                  }
                }

                // Entity idle/attack skip: avoid object allocation when nothing changed,
                // but still allow attack cooldowns to tick down while stationary.
                if (nextState === entity.aiState
                  && (nextState === AIState.Idle || nextState === AIState.Attack)
                  && entity.velocity.x === 0 && entity.velocity.z === 0) {
                  if (nextAttackCooldown === entity.attackCooldownRemaining) {
                    return entity
                  }
                  MutableRef.set(dirtyRef, true)
                  return {
                    ...entity,
                    attackCooldownRemaining: nextAttackCooldown,
                  }
                }

                MutableRef.set(dirtyRef, true)

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

                const burnDamage = daytimeBurningActive && entity.behavior === 'hostile' ? 1 : 0
                if (burnDamage > 0) MutableRef.set(dirtyRef, true)

                return {
                  ...entity,
                  health: Math.max(0, entity.health - burnDamage),
                  aiState: nextState,
                  velocity,
                  wanderDirection,
                  attackCooldownRemaining: nextAttackCooldown,
                }
              })
            )
            // Remove hostile mobs that burned to death (health=0). No drops for
            // environmental death — consistent with vanilla fire damage behaviour.
            if (daytimeBurningActive) {
              yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityIdType, ManagedEntity>] => {
                let changed = false
                let updated = entities
                HashMap.forEach(entities, (entity, id) => {
                  if (entity.behavior === 'hostile' && entity.health <= 0) {
                    updated = HashMap.remove(updated, id)
                    changed = true
                  }
                })
                return [changed, updated]
              }).pipe(Effect.flatMap((changed) =>
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
                const candidateVelocity: Vector3 = {
                  x: entity.velocity.x,
                  // Clamp downward fall to terminal velocity (tunneling guard).
                  y: Math.max(entity.velocity.y + MOB_GRAVITY_Y * deltaTime, MOB_TERMINAL_VELOCITY_Y),
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

                if (
                  isSamePosition(entity.position, resolved.position)
                  && isSameVelocity(entity.velocity, velocity)
                  && isSameVelocity(entity.wanderDirection, wanderDirection)
                  && entity.isGrounded === resolved.isGrounded
                ) {
                  return entity
                }

                MutableRef.set(dirtyRef, true)
                return {
                  ...entity,
                  position: resolved.position,
                  velocity,
                  wanderDirection,
                  isGrounded: resolved.isGrounded,
                }
              })
            )

            if (MutableRef.get(dirtyRef)) {
              yield* Ref.set(cachedEntitiesRef, Option.none())
            }
          }),

        despawnFarEntities: (
          playerPosition: Position,
          maxDistance: number,
        ): Effect.Effect<number, never> =>
          Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityIdType, ManagedEntity>] => {
            let removedCount = 0
            let updatedEntities = entities

            HashMap.forEach(entities, (entity, entityId) => {
              if (!shouldDespawnEntity(entity, playerPosition, maxDistance)) {
                return
              }

              removedCount += 1
              updatedEntities = HashMap.remove(updatedEntities, entityId)
            })

            return [removedCount, removedCount > 0 ? updatedEntities : entities]
          }).pipe(
            Effect.tap((removedCount) =>
              removedCount > 0
                ? Effect.all([
                    Ref.set(cachedEntitiesRef, Option.none()),
                    Ref.update(structureVersionRef, (version) => version + 1),
                  ], { concurrency: 'unbounded', discard: true })
                : Effect.void,
            ),
          ),

        despawnAllEntities: (): Effect.Effect<number, never> =>
          Ref.modify(
            entitiesRef,
            (entities): [number, HashMap.HashMap<EntityIdType, ManagedEntity>] => {
              const removedCount = HashMap.size(entities)
              return [removedCount, removedCount > 0 ? HashMap.empty() : entities]
            },
          ).pipe(
            Effect.tap((removedCount) =>
              removedCount > 0
                ? Effect.all([
                    Ref.set(cachedEntitiesRef, Option.none()),
                    Ref.update(structureVersionRef, (version) => version + 1),
                  ], { concurrency: 'unbounded', discard: true })
                : Effect.void,
            ),
          ),

        applyDamage: (
          entityId: EntityIdType,
          amount: number,
        ): Effect.Effect<Option.Option<ReadonlyArray<EntityDrop>>, never> => {
          if (amount <= 0) {
            return Effect.succeed(Option.none())
          }

          return Ref.modify(
            entitiesRef,
            (
              entities,
            ): [Option.Option<ReadonlyArray<EntityDrop>>, HashMap.HashMap<EntityIdType, ManagedEntity>] =>
              Option.match(HashMap.get(entities, entityId), {
                onNone: () => [Option.none(), entities],
                onSome: (entity) => {
                  const nextHealth = entity.health - amount
                  if (nextHealth <= 0) {
                    return [Option.some(entity.drops), HashMap.remove(entities, entityId)]
                  }

                  // Enderman teleports when hit but survives (deterministic offset
                  // derived from remaining health so each hit lands at a different spot).
                  const nextPosition: Position = entity.type === EntityType.Enderman
                    ? (() => {
                        const angle = (nextHealth * 1.618) % (Math.PI * 2)
                        const dist = 4 + (Math.floor(nextHealth) % 8)
                        return {
                          x: entity.position.x + Math.cos(angle) * dist,
                          y: entity.position.y,
                          z: entity.position.z + Math.sin(angle) * dist,
                        }
                      })()
                    : entity.position

                  return [
                    Option.none(),
                    HashMap.set(entities, entityId, {
                      ...entity,
                      health: nextHealth,
                      position: nextPosition,
                    }),
                  ]
                },
              }),
          ).pipe(Effect.tap((dropsOpt) =>
            Effect.all([
              Ref.set(cachedEntitiesRef, Option.none()),
              Option.match(dropsOpt, {
                onSome: () => Ref.update(structureVersionRef, (version) => version + 1),
                onNone: () => Effect.void,
              }),
            ], { concurrency: 'unbounded', discard: true })
          ))
        },

        // Applies a combat knockback: replaces the entity's velocity with the
        // impulse and arms the knockback timer so AI does not immediately reclaim
        // horizontal velocity (see update). No-op for unknown entities.
        applyKnockback: (
          entityId: EntityIdType,
          impulse: Vector3,
        ): Effect.Effect<void, never> =>
          Ref.update(entitiesRef, (entities) =>
            Option.match(HashMap.get(entities, entityId), {
              onNone: () => entities,
              onSome: (entity) =>
                HashMap.set(entities, entityId, {
                  ...entity,
                  velocity: impulse,
                  knockbackTicksRemaining: KNOCKBACK_DURATION_TICKS,
                }),
            }),
          ).pipe(Effect.andThen(Ref.set(cachedEntitiesRef, Option.none()))),
    })))
  },
) {}

export const EntityManagerLive = EntityManager.Default
