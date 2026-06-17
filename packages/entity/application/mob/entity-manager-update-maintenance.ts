import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { GAME_TICKS_PER_SEC, type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { EntityType, type Entity, type EntityId } from '../../domain/mob/entity'
import { tickCreeperFuse } from '../../domain/mob/creeper-fuse'
import { tickWoolRegrowth } from '../../domain/mob/shearing'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { invalidateEntityCache } from './entity-manager-cache'
import { pruneBurnKilledEntities } from './entity-manager-daylight-burn'
import { updateManagedEntities } from './entity-manager-entity-map'

export const updateCreeperFuseStates = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  dirtyRef: MutableRef.MutableRef<boolean>,
  hasCreeperRef: MutableRef.MutableRef<boolean>,
  playerPosition: Position,
  deltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (!MutableRef.get(hasCreeperRef)) return

    yield* updateManagedEntities(entitiesRef, (entity) => {
      if (entity.type !== EntityType.Creeper) return entity
      const nextFuse = tickCreeperFuse(
        entity.position,
        playerPosition,
        { fuseSecs: entity.fuseSecs, ignited: entity.fuseSecs > 0 },
        deltaTime,
      ).state.fuseSecs
      if (nextFuse === entity.fuseSecs) return entity
      MutableRef.set(dirtyRef, true)
      return { ...entity, fuseSecs: nextFuse }
    })
  })

export const updateSheepWoolRegrowth = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  hasShearedSheepRef: MutableRef.MutableRef<boolean>,
  deltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (!MutableRef.get(hasShearedSheepRef)) return

    const woolTicksElapsed = deltaTime * GAME_TICKS_PER_SEC
    yield* updateManagedEntities(entitiesRef, (entity) =>
      entity.woolRegrowthTicks > 0
        ? { ...entity, woolRegrowthTicks: tickWoolRegrowth(entity.woolRegrowthTicks, woolTicksElapsed) }
        : entity
    )
  })

export const applyBurnDamageCleanup = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  structureVersionRef: Ref.Ref<number>,
  daytimeBurningActive: boolean,
  fireDamageRef: MutableRef.MutableRef<boolean>,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    if (!(daytimeBurningActive || MutableRef.get(fireDamageRef))) return false

    const burnDamageKilledEntity = yield* Ref.modify(entitiesRef, pruneBurnKilledEntities)
    if (burnDamageKilledEntity) {
      yield* Ref.update(structureVersionRef, (v) => v + 1)
    }
    return burnDamageKilledEntity
  })

export const invalidateEntityCacheIfNeeded = (
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  dirtyRef: MutableRef.MutableRef<boolean>,
  burnDamageKilledEntity: boolean,
): Effect.Effect<void, never> =>
  MutableRef.get(dirtyRef) || burnDamageKilledEntity
    ? invalidateEntityCache(cachedEntitiesRef)
    : Effect.void
