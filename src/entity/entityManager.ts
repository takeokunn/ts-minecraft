import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import type { ItemStack } from '@/domain/item-stack'
import { AIState, computeStateVelocity, distanceToPlayer, resolveAIState } from '@/ai/stateMachine'
import {
  EntityId,
  EntityType,
  createEntity as createEntityModel,
  type Entity,
  type EntityId as EntityIdType,
} from '@/entity/entity'
import { getMobDefinition } from '@/entity/mobs'
import type { DeltaTimeSecs, Position } from '@/shared/kernel'
import { zero } from '@/shared/math/three'
import { HOSTILE_ATTACK_COOLDOWN_SECS, type ManagedEntity } from './entity-internal'
import { hashEntityId, makeWanderDirection, toPublicEntity } from './entity-utils'

export class EntityManager extends Effect.Service<EntityManager>()(
  '@minecraft/entity/EntityManager',
  {
    effect: Effect.all([
      Ref.make(HashMap.empty<EntityIdType, ManagedEntity>()),
      Ref.make(1),
      Ref.make(0),
      Ref.make<ReadonlyArray<Entity> | null>(null),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([entitiesRef, nextEntityNumberRef, updateTickRef, cachedEntitiesRef]) => ({
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
              drops: definition.drops,
              aiState: AIState.Idle,
              wanderDirection: zero,
              attackCooldownRemaining: 0,
            }

            yield* Ref.update(entitiesRef, (entities) =>
              HashMap.set(entities, entityId, managedEntity)
            )
            yield* Ref.set(cachedEntitiesRef, null)

            return entityId
          }),

        removeEntity: (entityId: EntityIdType): Effect.Effect<boolean, never> =>
          Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityIdType, ManagedEntity>] =>
            Option.match(HashMap.get(entities, entityId), {
              onNone: () => [false, entities],
              onSome: () => [true, HashMap.remove(entities, entityId)],
            })
          ).pipe(Effect.tap((removed) => removed ? Ref.set(cachedEntitiesRef, null) : Effect.void)),

        getEntity: (entityId: EntityIdType): Effect.Effect<Option.Option<Entity>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), toPublicEntity))
          ),

        getEntities: (): Effect.Effect<ReadonlyArray<Entity>, never> =>
          Ref.get(cachedEntitiesRef).pipe(
            Effect.flatMap((cached) =>
              cached !== null
                ? Effect.succeed(cached)
                : Ref.get(entitiesRef).pipe(
                    Effect.flatMap((entities) => {
                      const result = Arr.map(
                        Arr.fromIterable(HashMap.values(entities)),
                        toPublicEntity
                      ) as ReadonlyArray<Entity>
                      return Ref.set(cachedEntitiesRef, result).pipe(Effect.as(result))
                    })
                  )
            )
          ),

        getEntityAIState: (entityId: EntityIdType): Effect.Effect<Option.Option<AIState>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), (entity) => entity.aiState))
          ),

        getCount: (): Effect.Effect<number, never> =>
          Ref.get(entitiesRef).pipe(Effect.map(HashMap.size)),

        getPlayerContactDamage: (playerPosition: Position): Effect.Effect<number, never> =>
          Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityIdType, ManagedEntity>] => {
              type DamageAccum = { changed: boolean; totalDamage: number; entities: typeof entities }
              const { changed, totalDamage, entities: updatedEntities } = Arr.reduce(
                Arr.fromIterable(HashMap.values(entities)),
                { changed: false, totalDamage: 0, entities } as DamageAccum,
                (acc, entity) => {
                  if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return acc
                  if (entity.attackCooldownRemaining <= 0 && distanceToPlayer(entity.position, playerPosition) <= entity.attackRange) {
                    return {
                      changed: true,
                      totalDamage: acc.totalDamage + entity.attackDamage,
                      entities: HashMap.set(acc.entities, entity.entityId, {
                        ...entity,
                        attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
                      }),
                    }
                  }
                  return acc
                }
              )

              return [totalDamage, changed ? updatedEntities : entities]
            }).pipe(Effect.tap((damage) => damage > 0 ? Ref.set(cachedEntitiesRef, null) : Effect.void)),

        update: (
          deltaTime: DeltaTimeSecs,
          playerPosition: Position,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)

            yield* Ref.update(entitiesRef, (entities) =>
              HashMap.map(entities, (entity, entityId) => {
                const distance = distanceToPlayer(entity.position, playerPosition)
                const randomWanderRoll = ((hashEntityId(entityId) + tick * 17) % 1000) / 1000
                const nextState = resolveAIState(entity.aiState, {
                  behavior: entity.behavior,
                  distanceToPlayer: distance,
                  canSeePlayer: distance <= entity.detectionRange,
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
                  return nextAttackCooldown === entity.attackCooldownRemaining
                    ? entity
                    : {
                        ...entity,
                        attackCooldownRemaining: nextAttackCooldown,
                      }
                }

                const wanderDirection =
                  nextState === AIState.Wander
                  && (entity.aiState !== AIState.Wander || randomWanderRoll < 0.2)
                    ? makeWanderDirection(entityId, tick)
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
            yield* Ref.set(cachedEntitiesRef, null)
          }),

        applyDamage: (
          entityId: EntityIdType,
          amount: number,
        ): Effect.Effect<Option.Option<ReadonlyArray<ItemStack>>, never> => {
          if (amount <= 0) {
            return Effect.succeed(Option.none())
          }

          return Ref.modify(
            entitiesRef,
            (
              entities,
            ): [Option.Option<ReadonlyArray<ItemStack>>, HashMap.HashMap<EntityIdType, ManagedEntity>] =>
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
          ).pipe(Effect.tap(() => Ref.set(cachedEntitiesRef, null)))
        },
    })))
  },
) {}

export const EntityManagerLive = EntityManager.Default
