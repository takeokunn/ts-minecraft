import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import type { EntityDrop } from '../../domain/mob/drop'
import {
  EntityId,
  EntityType,
  createEntity as createEntityModel,
  type Entity,
  type EntityId as EntityIdType,
} from '../../domain/mob/entity'
import { getMobDefinition } from '../../domain/mob/mobs'
import type { Position } from '@ts-minecraft/core'
import { zero } from '@ts-minecraft/core'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { AIState } from '../../domain/mob/state-machine'
import { makeEntityManagerInternal } from './entity-manager-internal'
import { makeEntityManagerUpdate } from './entity-manager-internal-update'
import { toPublicEntity } from '../../domain/mob/entity-utils'

export class EntityManager extends Effect.Service<EntityManager>()(
  '@minecraft/entity/EntityManager',
  {
    effect: Effect.all([
      Ref.make(HashMap.empty<EntityIdType, ManagedEntity>()),
      Ref.make(1),
      Ref.make(0),
      Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.none()),
      Ref.make(0),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([entitiesRef, nextEntityNumberRef, updateTickRef, cachedEntitiesRef, structureVersionRef]) => {
      const internal = makeEntityManagerInternal(entitiesRef, cachedEntitiesRef, structureVersionRef)
      const updateModule = makeEntityManagerUpdate(entitiesRef, updateTickRef, cachedEntitiesRef, structureVersionRef)

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

        getEntityAIState: (entityId: EntityIdType): Effect.Effect<Option.Option<import('../../domain/mob/state-machine').AIState>, never> =>
          Ref.get(entitiesRef).pipe(
            Effect.map((entities) => Option.map(HashMap.get(entities, entityId), (entity) => entity.aiState))
          ),

        getCount: (): Effect.Effect<number, never> =>
          Ref.get(entitiesRef).pipe(Effect.map(HashMap.size)),

        getStructureVersion: (): Effect.Effect<number, never> => Ref.get(structureVersionRef),

        ...internal,
        ...updateModule,
      }
    })),
  },
) {}

export const EntityManagerLive = EntityManager.Default
