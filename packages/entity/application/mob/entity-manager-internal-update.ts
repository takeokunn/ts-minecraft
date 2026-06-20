import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
import { type Entity, type EntityId } from '../../domain/mob/entity'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { type CollisionResolver } from '../../domain/mob/entity-manager-utils'
import { processEntityAI } from './entity-manager-ai'
import { advanceDaylightBurnCadence } from './entity-manager-daylight-burn'
import { updateManagedEntities } from './entity-manager-entity-map'
import {
  applyBurnDamageCleanup,
  invalidateEntityCacheIfNeeded,
  updateCreeperFuseStates,
  updateSheepWoolRegrowth,
} from './entity-manager-update-maintenance'
import { processEntityPhysics } from './entity-manager-physics'

export const makeEntityManagerUpdate = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  updateTickRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
  burnAccumulatorRef: Ref.Ref<number>,
) => {
  return {
    update: (
      deltaTime: DeltaTimeSecs,
      playerPosition: Position,
      isNight: boolean = true,
      playerLookDirection?: Vector3,
      playerLookOrigin: Position = playerPosition,
      playerLookBlocked?: (position: Position) => boolean,
      daylightBurnProtected: boolean = false,
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const tick = yield* Ref.updateAndGet(updateTickRef, (value) => value + 1)
        const dirtyRef = MutableRef.make(false)
        const fireDamageRef = MutableRef.make(false)
        const daytimeBurningActive = yield* Ref.modify(
          burnAccumulatorRef,
          (acc): [boolean, number] => {
            const [burnFires, nextAcc] = advanceDaylightBurnCadence(acc, deltaTime)
            return [!isNight && !daylightBurnProtected && burnFires, nextAcc]
          },
        )
        const hasCreeperRef = MutableRef.make(false)
        const hasShearedSheepRef = MutableRef.make(false)
        const ctx = { tick, deltaTime, playerPosition, playerLookOrigin, playerLookDirection, playerLookBlocked, daytimeBurningActive }

        yield* updateManagedEntities(entitiesRef, (entity, entityId) =>
          processEntityAI(entity, entityId, ctx, dirtyRef, fireDamageRef, hasCreeperRef, hasShearedSheepRef)
        )

        yield* updateCreeperFuseStates(entitiesRef, dirtyRef, hasCreeperRef, playerPosition, deltaTime)
        yield* updateSheepWoolRegrowth(entitiesRef, hasShearedSheepRef, deltaTime)

        const burnDamageKilledEntity = yield* applyBurnDamageCleanup(
          entitiesRef,
          structureVersionRef,
          daytimeBurningActive,
          fireDamageRef,
        )
        // Invalidate the entity-snapshot cache whenever any entity changed this frame — INCLUDING
        // a daylight burn that damaged a mob without killing it. The previous `else if` skipped the
        // dirty check on burning frames, so getEntities() could return stale health until the next
        // non-burning frame happened to invalidate the cache.
        yield* invalidateEntityCacheIfNeeded(cachedEntitiesRef, dirtyRef, burnDamageKilledEntity)
      }),

    applyPhysics: (
      deltaTime: DeltaTimeSecs,
      resolveCollision: CollisionResolver,
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const dirtyRef = MutableRef.make(false)
        const tick = yield* Ref.get(updateTickRef)

        yield* updateManagedEntities(entitiesRef, (entity, entityId) =>
          processEntityPhysics(entity, entityId, {
            tick,
            deltaTime,
            resolveCollision,
          }, dirtyRef)
        )

        yield* invalidateEntityCacheIfNeeded(cachedEntitiesRef, dirtyRef, false)
      }),
  }
}
