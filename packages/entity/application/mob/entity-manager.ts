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

export type EntityDimension = 'overworld' | 'nether' | 'end'

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
      const playerShotOriginsRef = yield* Ref.make<ReadonlyArray<import('./entity-manager-combat').PlayerShotOrigin>>([])
      // Entities belong to a dimension: travelling through a portal must not
      // bring overworld mobs into the nether/end. The live map always holds the
      // ACTIVE dimension's entities; the other dimensions' populations are
      // parked here (full ManagedEntity state, so AI/fuse/age survive a round trip).
      const activeDimensionRef = yield* Ref.make<EntityDimension>('overworld')
      const dimensionPoolsRef = yield* Ref.make(HashMap.empty<EntityDimension, HashMap.HashMap<EntityIdType, ManagedEntity>>())
      const internal = makeEntityManagerInternal(entitiesRef, cachedEntitiesRef, structureVersionRef, explosionsRef, playerIgniteSecsRef, playerShotOriginsRef)
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

        // Drops every entity and all pending per-tick events. This service is an
        // app-scoped singleton reused across worlds, so a new world must clear
        // the prior world's mobs (and any un-drained explosion/dragon/ignite
        // events) rather than inherit them. Bumps the structure version so the
        // renderer rebuilds against an empty set. See restoreSavedState.
        clear: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(entitiesRef, HashMap.empty<EntityIdType, ManagedEntity>())
            yield* Ref.set(cachedEntitiesRef, Option.none())
            yield* Ref.update(structureVersionRef, (v) => v + 1)
            yield* Ref.set(explosionsRef, [])
            yield* Ref.set(dragonEventsRef, [])
            yield* Ref.set(playerShotOriginsRef, [])
            yield* Ref.set(birthsRef, 0)
            yield* Ref.set(playerIgniteSecsRef, 0)
            yield* Ref.set(burnAccumulatorRef, 0)
            // Parked dimensions are part of the same world: a new world must not
            // inherit the previous world's nether/end populations either.
            yield* Ref.set(dimensionPoolsRef, HashMap.empty<EntityDimension, HashMap.HashMap<EntityIdType, ManagedEntity>>())
            yield* Ref.set(activeDimensionRef, 'overworld')
          }),

        // Swap the live entity set for the target dimension's parked population
        // (empty on first visit). Mirrors ChunkManagerService.setActiveDimension —
        // call both together when the player changes dimension.
        setActiveDimension: (dimension: EntityDimension): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const current = yield* Ref.get(activeDimensionRef)
            if (current === dimension) return
            const live = yield* Ref.get(entitiesRef)
            yield* Ref.update(dimensionPoolsRef, (pools) => HashMap.set(pools, current, live))
            const pools = yield* Ref.get(dimensionPoolsRef)
            const restored = Option.getOrElse(
              HashMap.get(pools, dimension),
              () => HashMap.empty<EntityIdType, ManagedEntity>(),
            )
            yield* Ref.set(entitiesRef, restored)
            yield* Ref.set(activeDimensionRef, dimension)
            yield* Ref.set(cachedEntitiesRef, Option.none())
            yield* Ref.update(structureVersionRef, (v) => v + 1)
          }),

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

        // Save-oriented view over ALL dimensions (live + parked pools), each
        // entity tagged with its home dimension so a load can rebuild the pools.
        getEntitiesAllDimensions: (): Effect.Effect<
          ReadonlyArray<{ readonly dimension: EntityDimension; readonly entity: Entity }>,
          never
        > =>
          Effect.gen(function* () {
            const active = yield* Ref.get(activeDimensionRef)
            const live = yield* Ref.get(entitiesRef)
            const pools = yield* Ref.get(dimensionPoolsRef)
            const result: Array<{ readonly dimension: EntityDimension; readonly entity: Entity }> = []
            for (const entity of HashMap.values(live)) {
              result.push({ dimension: active, entity: toPublicEntity(entity) })
            }
            for (const [dimension, pool] of HashMap.entries(pools)) {
              if (dimension === active) continue
              for (const entity of HashMap.values(pool)) {
                result.push({ dimension, entity: toPublicEntity(entity) })
              }
            }
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
