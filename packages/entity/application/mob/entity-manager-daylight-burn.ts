import { HashMap } from 'effect'
import { type DeltaTimeSecs } from '@ts-minecraft/core'
import { type EntityId } from '../../domain/mob/entity'
import { type ManagedEntity } from '../../domain/mob/entity-internal'

export const DAYTIME_BURN_INTERVAL_SECS = 1.0

export const advanceDaylightBurnCadence = (
  burnAccumulatorSecs: number,
  deltaTime: DeltaTimeSecs,
): [boolean, number] => {
  const next = burnAccumulatorSecs + deltaTime
  return next >= DAYTIME_BURN_INTERVAL_SECS
    ? [true, next - DAYTIME_BURN_INTERVAL_SECS]
    : [false, next]
}

export const pruneBurnKilledEntities = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
  let updated = HashMap.empty<EntityId, ManagedEntity>()
  let changed = false
  for (const [id, entity] of entities) {
    if (entity.health > 0) {
      updated = HashMap.set(updated, id, entity)
    } else {
      changed = true
    }
  }
  return [changed, updated]
}
