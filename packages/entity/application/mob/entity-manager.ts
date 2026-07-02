import { Effect, HashMap, Option, Ref } from 'effect'
import {
  type Entity,
  type EntityId as EntityIdType,
} from '../../domain/mob/entity'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { makeEntityManagerInternal } from './entity-manager-internal'
import { makeEntityManagerUpdateWithBreeding } from './entity-manager-update'
import { makeEntityManagerMutations } from './entity-manager-entity-mutation'
import { toPublicEntity } from '../../domain/mob/entity-utils'
import type { ExplosionEvent } from '../../domain/explosion'
import type { DragonDeathEvent } from '../../domain/mob/ender-dragon/dragon-death'

export class EntityManager extends Effect.Service<EntityManager>()(
  '@minecraft/entity/EntityManager',
  {
    effect: Effect.gen(function* () {
      const entitiesRef = yield* Ref.make(HashMap.empty<EntityIdType, ManagedEntity>())
      const nextEntityNumberRef = yield* Ref.make(1)
      const updateTickRef = yield* Ref.make(0)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.none())
      const structureVersionRef = yield* Ref.make(0)
      // Accumulates real seconds for the daylight-burn cadence (frame-rate independent).
      const burnAccumulatorRef = yield* Ref.make(0)
      // R10: births since last drain (for the player breeding-XP reward)
      const birthsRef = yield* Ref.make(0)
      const explosionsRef = yield* Ref.make<ReadonlyArray<ExplosionEvent>>([])
      // Ender Dragon death events (egg/portal/XP/complete) emitted during update(); the app
      // frame drains these each tick and applies the world/player effects (DDD boundary —
      // the entity layer never touches world blocks or player XP).
      const dragonEventsRef = yield* Ref.make<ReadonlyArray<DragonDeathEvent>>([])
      // Pending player burn seconds from Blaze fireball hits (drained by the frame).
      const playerIgniteSecsRef = yield* Ref.make(0)
      const internal = makeEntityManagerInternal(entitiesRef, cachedEntitiesRef, structureVersionRef, explosionsRef, playerIgniteSecsRef)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      return {
        addEntity: mutations.addEntity,
        removeEntity: mutations.removeEntity,
        applyEntitySnapshot: mutations.applyEntitySnapshot,

        getEntity: (entityId: EntityIdType): Effect.Effect<Option.Option<Entity>, never> =>
          Effect.gen(function* () {
            const entities = yield* Ref.get(entitiesRef)
            const entity = Option.getOrNull(HashMap.get(entities, entityId))
            return entity === null ? Option.none() : Option.some(toPublicEntity(entity))
          }),

        getEntities: (): Effect.Effect<ReadonlyArray<Entity>, never> =>
          Effect.gen(function* () {
            const cached = yield* Ref.get(cachedEntitiesRef)
            const cachedValue = Option.getOrNull(cached)
            if (cachedValue !== null) return cachedValue
            const entities = yield* Ref.get(entitiesRef)
            const result: Entity[] = []
            for (const entity of HashMap.values(entities)) {
              result.push(toPublicEntity(entity))
            }
            yield* Ref.set(cachedEntitiesRef, Option.some(result))
            return result
          }),

        getEntityAIState: (entityId: EntityIdType): Effect.Effect<Option.Option<import('../../domain/mob/state-machine').AIState>, never> =>
          Effect.gen(function* () {
            const entities = yield* Ref.get(entitiesRef)
            const entity = Option.getOrNull(HashMap.get(entities, entityId))
            return entity === null ? Option.none() : Option.some(entity.aiState)
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

        drainExplosions: (): Effect.Effect<ReadonlyArray<ExplosionEvent>, never> => Ref.getAndSet(explosionsRef, []),

        // Drain the Ender Dragon death events accumulated since the last call. The app frame
        // applies them (DragonEgg/ReturnPortal block placement, XP fountain, dragon removal).
        drainDragonDeathEvents: (): Effect.Effect<ReadonlyArray<DragonDeathEvent>, never> => Ref.getAndSet(dragonEventsRef, []),

        ...internal,
        ...makeEntityManagerUpdateWithBreeding(
          entitiesRef,
          updateTickRef,
          cachedEntitiesRef,
          structureVersionRef,
          burnAccumulatorRef,
          birthsRef,
          dragonEventsRef,
          mutations.addEntity,
        ),
      }
    }),
  },
) {}
