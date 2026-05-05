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
import type { DeltaTimeSecs, Position } from '@ts-minecraft/kernel'
import { zero } from '@ts-minecraft/kernel'
import { HOSTILE_ATTACK_COOLDOWN_SECS, type ManagedEntity } from '../../domain/mob/entity-internal'
import { hashEntityId, makeWanderDirectionFromHash, toPublicEntity } from '../../domain/mob/entity-utils'

// probability of choosing a new wander direction each tick
const WANDER_REDIRECT_PROBABILITY = 0.2
// prime tick multiplier — avoids periodicity in wander direction
const WANDER_PHASE_TICK_STEP = 17

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
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)
            const dirtyRef = MutableRef.make(false)

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

                // Entity idle/attack skip: avoid object allocation when nothing changed,
                // but still allow attack cooldowns to tick down while stationary.
                if (nextState === entity.aiState
                  && entity.velocity.x === 0 && entity.velocity.y === 0 && entity.velocity.z === 0) {
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

                const velocity = computeStateVelocity({
                  state: nextState,
                  entityPosition: entity.position,
                  playerPosition,
                  speed: entity.speed,
                  wanderDirection,
                })

                const nextPosition: Position = {
                  x: entity.position.x + velocity.x * deltaTime,
                  y: entity.position.y + velocity.y * deltaTime,
                  z: entity.position.z + velocity.z * deltaTime,
                }

                return {
                  ...entity,
                  aiState: nextState,
                  velocity,
                  position: nextPosition,
                  wanderDirection,
                  attackCooldownRemaining: nextAttackCooldown,
                }
              })
            )
            if (MutableRef.get(dirtyRef)) {
              yield* Ref.set(cachedEntitiesRef, Option.none())
            }
          }),

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

                  return [
                    Option.none(),
                    HashMap.set(entities, entityId, {
                      ...entity,
                      health: nextHealth,
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
    })))
  },
) {}

export const EntityManagerLive = EntityManager.Default
