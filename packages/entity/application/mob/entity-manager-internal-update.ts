import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
import { type Entity, type EntityId } from '../../domain/mob/entity'
import { isRemoteEntityId } from '../../domain/mob/remote-entity'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import type { DragonDeathEvent } from '../../domain/mob/ender-dragon/dragon-death'
import { type CollisionResolver } from '../../domain/mob/entity-manager-utils'
import { processEntityAI } from './entity-manager-ai'
import { runDragonUpdate } from './entity-manager-dragon-update'
import { advanceDaylightBurnCadence } from './entity-manager-daylight-burn'
import { updateManagedEntities } from './entity-manager-entity-map'
import {
  applyBurnDamageCleanup,
  invalidateEntityCacheIfNeeded,
  updateCreeperFuseStates,
  updateSheepWoolRegrowth,
} from './entity-manager-update-maintenance'
import { processEntityPhysics } from './entity-manager-physics'

// Remote entities mirror another client's authoritative simulation: position
// and health arrive via EntitySnapshot, so AI/physics must not run locally.
// Only the hostile attack cooldown ticks down — player contact/ranged damage
// is resolved locally against ALL entities (see entity-manager-combat.ts), and
// without this decrement a remote mob could hit the local player exactly once.
const tickRemoteEntity = (entity: ManagedEntity, deltaTime: number): ManagedEntity =>
  entity.attackCooldownRemaining > 0
    ? { ...entity, attackCooldownRemaining: Math.max(0, entity.attackCooldownRemaining - deltaTime) }
    : entity

export const makeEntityManagerUpdate = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  updateTickRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
  burnAccumulatorRef: Ref.Ref<number>,
  dragonEventsRef: Ref.Ref<ReadonlyArray<DragonDeathEvent>>,
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
      remotePlayerPositions: ReadonlyArray<Position> = [],
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
        const ctx = { tick, deltaTime, playerPosition, remotePlayerPositions, playerLookOrigin, playerLookDirection, playerLookBlocked, daytimeBurningActive }

        yield* updateManagedEntities(entitiesRef, (entity, entityId) =>
          isRemoteEntityId(String(entityId))
            ? tickRemoteEntity(entity, deltaTime)
            : processEntityAI(entity, entityId, ctx, dirtyRef, fireDamageRef, hasCreeperRef, hasShearedSheepRef)
        )

        // Ender Dragon boss: override the generic wander velocity with the flight FSM and
        // advance the death sequence (emitting egg/portal/XP events the app drains). Runs
        // after the AI pass so its velocity wins.
        yield* runDragonUpdate(entitiesRef, cachedEntitiesRef, structureVersionRef, dragonEventsRef, tick, playerPosition)

        yield* updateCreeperFuseStates(entitiesRef, dirtyRef, hasCreeperRef, playerPosition, deltaTime, remotePlayerPositions)
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
          isRemoteEntityId(String(entityId))
            ? entity
            : processEntityPhysics(entity, entityId, {
                tick,
                deltaTime,
                resolveCollision,
              }, dirtyRef)
        )

        yield* invalidateEntityCacheIfNeeded(cachedEntitiesRef, dirtyRef, false)
      }),
  }
}
