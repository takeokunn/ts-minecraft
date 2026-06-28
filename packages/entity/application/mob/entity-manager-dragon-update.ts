import { Effect, HashMap, Option, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { EntityType, type Entity, type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import type { DragonDeathEvent } from '../../domain/mob/ender-dragon/dragon-death'
import { tickDragonEntity } from './entity-manager-dragon'
import { invalidateEntityCache, invalidateEntityCacheAndBumpStructureVersion } from './entity-manager-cache'

// Per-tick Ender Dragon pass. Runs after the generic AI pass so the dragon's flight FSM /
// death sequence overrides the generic wander velocity. Accumulates the emitted death events
// into dragonEventsRef (drained by the app frame) and removes the dragon on Complete. The
// loop early-continues on every non-dragon, so a dragon-free world pays only one map walk
// (the AI pass already walks the same map each tick).
export const runDragonUpdate = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
  dragonEventsRef: Ref.Ref<ReadonlyArray<DragonDeathEvent>>,
  tick: number,
  playerPosition: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entities = yield* Ref.get(entitiesRef)
    const collectedEvents: DragonDeathEvent[] = []
    let updated = entities
    let changed = false
    let removed = false

    for (const [id, entity] of entities) {
      if (entity.type !== EntityType.EnderDragon) continue
      const result = tickDragonEntity(entity, id, tick, playerPosition)
      for (const event of result.events) collectedEvents.push(event)
      if (result.remove) {
        updated = HashMap.remove(updated, id)
        changed = true
        removed = true
      } else if (result.next !== entity) {
        updated = HashMap.set(updated, id, result.next)
        changed = true
      }
    }

    if (changed) yield* Ref.set(entitiesRef, updated)
    if (collectedEvents.length > 0) {
      yield* Ref.update(dragonEventsRef, (pending) => [...pending, ...collectedEvents])
    }
    if (removed) {
      yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
    } else if (changed) {
      yield* invalidateEntityCache(cachedEntitiesRef)
    }
  })
