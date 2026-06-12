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
    effect: Effect.gen(function* () {
      const entitiesRef = yield* Ref.make(HashMap.empty<EntityIdType, ManagedEntity>())
      const nextEntityNumberRef = yield* Ref.make(1)
      const updateTickRef = yield* Ref.make(0)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.none())
      const structureVersionRef = yield* Ref.make(0)
      // R10: births since last drain (for the player breeding-XP reward)
      const birthsRef = yield* Ref.make(0)
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
          Effect.gen(function* () {
            const removed = yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityIdType, ManagedEntity>] => {
              const entity = Option.getOrNull(HashMap.get(entities, entityId))
              return entity === null ? [false, entities] : [true, HashMap.remove(entities, entityId)]
            })
            if (removed) {
              yield* Ref.set(cachedEntitiesRef, Option.none())
              yield* Ref.update(structureVersionRef, (version) => version + 1)
            }
            return removed
          }),

        getEntity: (entityId: EntityIdType): Effect.Effect<Option.Option<Entity>, never> =>
          Effect.gen(function* () {
            const entities = yield* Ref.get(entitiesRef)
            return Option.map(HashMap.get(entities, entityId), toPublicEntity)
          }),

        getEntities: (): Effect.Effect<ReadonlyArray<Entity>, never> =>
          Effect.gen(function* () {
            const cached = yield* Ref.get(cachedEntitiesRef)
            const cachedValue = Option.getOrNull(cached)
            if (cachedValue !== null) return cachedValue
            const entities = yield* Ref.get(entitiesRef)
            const result = Arr.map(
              Arr.fromIterable(HashMap.values(entities)),
              toPublicEntity
            ) as ReadonlyArray<Entity>
            yield* Ref.set(cachedEntitiesRef, Option.some(result))
            return result
          }),

        getEntityAIState: (entityId: EntityIdType): Effect.Effect<Option.Option<import('../../domain/mob/state-machine').AIState>, never> =>
          Effect.gen(function* () {
            const entities = yield* Ref.get(entitiesRef)
            return Option.map(HashMap.get(entities, entityId), (entity) => entity.aiState)
          }),

        getCount: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const entities = yield* Ref.get(entitiesRef)
            return HashMap.size(entities)
          }),

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

            for (const pair of findBreedingPairs(candidates)) {
              yield* Ref.update(entitiesRef, (es) => {
                const reset = (m: HashMap.HashMap<EntityIdType, ManagedEntity>, pid: EntityIdType) => {
                  const parent = Option.getOrNull(HashMap.get(m, pid))
                  return parent === null ? m : HashMap.set(m, pid, { ...parent, ...afterBreedingParentState() })
                }
                return reset(reset(es, pair.parentA), pair.parentB)
              })
              yield* spawnEntity(pair.type, pair.babyPosition, 0)
              // R10: record the birth so the frame loop can reward the player with XP.
              yield* Ref.update(birthsRef, (n) => n + 1)
            }
            yield* Ref.set(cachedEntitiesRef, Option.none())
          }),
      }
    }),
  },
) {}

export const EntityManagerLive: Layer.Layer<EntityManager> = EntityManager.Default
