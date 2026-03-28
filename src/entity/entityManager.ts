import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import type { ItemStack } from '@/domain/item-stack'
import { AIState, computeStateVelocity, distanceToPlayer, resolveAIState } from '@/ai/stateMachine'
import {
  EntityId,
  EntityType,
  createEntity as createEntityModel,
  type Entity,
  type EntityId as EntityIdType,
  type MobBehavior,
} from '@/entity/entity'
import { getMobDefinition } from '@/entity/mobs'
import type { DeltaTimeSecs, Position } from '@/shared/kernel'
import type { Vector3 } from '@/shared/math/three'
import { zero } from '@/shared/math/three'

type ManagedEntity = Entity & {
  readonly behavior: MobBehavior
  readonly maxHealth: number
  readonly attackDamage: number
  readonly speed: number
  readonly detectionRange: number
  readonly attackRange: number
  readonly fleeHealthThreshold: number
  readonly drops: ReadonlyArray<ItemStack>
  readonly aiState: AIState
  readonly wanderDirection: Vector3
}

const toPublicEntity = (entity: ManagedEntity): Entity => ({
  entityId: entity.entityId,
  position: entity.position,
  velocity: entity.velocity,
  rotation: entity.rotation,
  health: entity.health,
  type: entity.type,
})

const hashEntityId = (entityId: EntityIdType): number =>
  Math.abs(Arr.reduce(Arr.fromIterable(entityId as string), 0, (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0))

const makeWanderDirection = (entityId: EntityIdType, tick: number): Vector3 => {
  const angleDegrees = (hashEntityId(entityId) + tick * 29) % 360
  const angle = angleDegrees * (Math.PI / 180)
  return {
    x: Math.cos(angle),
    y: 0,
    z: Math.sin(angle),
  }
}

export class EntityManager extends Effect.Service<EntityManager>()(
  '@minecraft/entity/EntityManager',
  {
    effect: Effect.gen(function* () {
      const entitiesRef = yield* Ref.make(HashMap.empty<EntityIdType, ManagedEntity>())
      const nextEntityNumberRef = yield* Ref.make(1)
      const updateTickRef = yield* Ref.make(0)

      return {
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
            }

            yield* Ref.update(entitiesRef, (entities) =>
              HashMap.set(entities, entityId, managedEntity)
            )

            return entityId
          }),

        removeEntity: (entityId: EntityIdType): Effect.Effect<boolean, never> =>
          Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityIdType, ManagedEntity>] =>
            Option.match(HashMap.get(entities, entityId), {
              onNone: () => [false, entities],
              onSome: () => [true, HashMap.remove(entities, entityId)],
            })
          ),

        getEntity: (entityId: EntityIdType): Effect.Effect<Option.Option<Entity>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), toPublicEntity))
          ),

        getEntities: (): Effect.Effect<ReadonlyArray<Entity>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) =>
              Arr.map(Arr.fromIterable(HashMap.values(entities)), toPublicEntity) as ReadonlyArray<Entity>
            )
          ),

        getEntityAIState: (entityId: EntityIdType): Effect.Effect<Option.Option<AIState>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), (entity) => entity.aiState))
          ),

        getCount: (): Effect.Effect<number, never> =>
          Ref.get(entitiesRef).pipe(Effect.map(HashMap.size)),

        update: (
          deltaTime: DeltaTimeSecs,
          playerPosition: Position,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)

            yield* Ref.update(entitiesRef, (entities) =>
              Arr.reduce(
                Arr.fromIterable(entities),
                HashMap.empty<EntityIdType, ManagedEntity>(),
                (nextEntities, [entityId, entity]) => {
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

                  return HashMap.set(nextEntities, entityId, {
                    ...entity,
                    aiState: nextState,
                    velocity,
                    position: nextPosition,
                    wanderDirection,
                  })
                },
              )
            )
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
          )
        },
      }
    }),
  },
) {}

export const EntityManagerLive = EntityManager.Default
