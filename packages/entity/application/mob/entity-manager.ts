import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import type { Layer } from 'effect'
import type { EntityDrop } from '../../domain/mob/drop'
import {
  EntityId,
  createEntity as createEntityModel,
  type Entity,
  type EntityId as EntityIdType,
  type EntityType,
} from '../../domain/mob/entity'
import { getMobDefinition } from '../../domain/mob/mobs'
import type { Position, DeltaTimeSecs } from '@ts-minecraft/core'
import { zero } from '@ts-minecraft/core'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { BABY_GROW_TICKS, findBreedingPairs, afterBreedingParentState } from '../../domain/mob/breeding'
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
      Ref.make(0), // R10: births since last drain (for the player breeding-XP reward)
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([entitiesRef, nextEntityNumberRef, updateTickRef, cachedEntitiesRef, structureVersionRef, birthsRef]) => {
      const internal = makeEntityManagerInternal(entitiesRef, cachedEntitiesRef, structureVersionRef)
      const updateModule = makeEntityManagerUpdate(entitiesRef, updateTickRef, cachedEntitiesRef, structureVersionRef)

      // Hoisted so the breeding pass (update override below) can spawn babies.
      // ageTicks defaults to adult; breeding passes 0 for a newborn.
      const spawnEntity = (
        type: EntityType,
        position: Position,
        ageTicks: number = BABY_GROW_TICKS,
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
              stuckTicks: 0,
              fuseSecs: 0,
              // Naturally-spawned mobs are adults; breeding spawns babies (ageTicks 0) in R6c-4.
              loveTicksRemaining: 0,
              breedCooldownRemaining: 0,
              ageTicks,
              // FR R11: freshly spawned mobs are woolly (sheep) / irrelevant (others).
              woolRegrowthTicks: 0,
            }

            yield* Ref.update(entitiesRef, (entities) =>
              HashMap.set(entities, entityId, managedEntity)
            )
            yield* Ref.set(cachedEntitiesRef, Option.none())
            yield* Ref.update(structureVersionRef, (version) => version + 1)

            return entityId
          })

      return {
        addEntity: spawnEntity,

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

        // R10: number of babies born (and cleared) since the last call — the frame
        // loop drains this each tick to award the player breeding XP.
        drainBirths: (): Effect.Effect<number, never> => Ref.getAndSet(birthsRef, 0),

        ...internal,
        ...updateModule,

        // R6c-4b: after the AI tick, breed same-species in-love adult pairs within
        // range — spawn a baby (ageTicks 0) at the midpoint and put both parents on
        // post-breed cooldown. Overrides updateModule.update (spread just above).
        update: (deltaTime: DeltaTimeSecs, playerPosition: Position, isNight: boolean = true): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* updateModule.update(deltaTime, playerPosition, isNight)

            const entities = yield* Ref.get(entitiesRef)
            const candidates: Array<{ id: EntityIdType; type: EntityType; position: Position }> = []
            for (const [id, e] of entities) {
              if (e.loveTicksRemaining > 0 && e.ageTicks >= BABY_GROW_TICKS) {
                candidates.push({ id, type: e.type, position: e.position })
              }
            }
            if (candidates.length < 2) return // common case: no one in love → cheap exit

            yield* Effect.forEach(
              findBreedingPairs(candidates),
              (pair) =>
                Ref.update(entitiesRef, (es) => {
                  const reset = (m: HashMap.HashMap<EntityIdType, ManagedEntity>, pid: EntityIdType) =>
                    Option.match(HashMap.get(m, pid), {
                      onNone: () => m,
                      onSome: (parent) => HashMap.set(m, pid, { ...parent, ...afterBreedingParentState() }),
                    })
                  return reset(reset(es, pair.parentA), pair.parentB)
                }).pipe(
                  Effect.andThen(spawnEntity(pair.type, pair.babyPosition, 0)),
                  // R10: record the birth so the frame loop can reward the player with XP.
                  Effect.andThen(Ref.update(birthsRef, (n) => n + 1)),
                ),
              { discard: true },
            ).pipe(Effect.andThen(Ref.set(cachedEntitiesRef, Option.none())))
          }),
      }
    })),
  },
) {}

export const EntityManagerLive: Layer.Layer<EntityManager> = EntityManager.Default
