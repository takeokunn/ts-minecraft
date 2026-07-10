import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { Dimension } from '@ts-minecraft/world'
import { isNearFortressSite } from '@ts-minecraft/world'
import { EntityType } from '../../domain/mob/entity'
import { MIN_SPAWN_DISTANCE } from '../../domain/mob/spawner-config'
import { AQUATIC_HOSTILE_MOBS, AQUATIC_PASSIVE_MOBS, PASSIVE_MOBS, HOSTILE_MOBS, NETHER_HOSTILE_MOBS } from '../../domain/mob/mob-categories'

export const getSpawnPosition = (playerPosition: Position, cursor: number): Position => {
  const angle = ((cursor % 16) / 16) * Math.PI * 2
  const distance = MIN_SPAWN_DISTANCE + (cursor % 4) * 8

  return {
    x: playerPosition.x + Math.cos(angle) * distance,
    y: playerPosition.y,
    z: playerPosition.z + Math.sin(angle) * distance,
  }
}

export const selectMobType = (
  isNight: boolean,
  cursor: number,
  dimension: Dimension = 'overworld',
  spawnPosition?: Position,
  isAquaticSpawn: boolean = false,
): EntityType => {
  if (dimension === 'nether') {
    // Fortress grounds are guarded by Blazes; elsewhere the nether rotation
    // applies at any time of day (the nether has no day/night cycle).
    if (spawnPosition !== undefined && isNearFortressSite(spawnPosition.x, spawnPosition.z)) {
      return EntityType.Blaze
    }
    return Option.getOrElse(
      Arr.get(NETHER_HOSTILE_MOBS, cursor % NETHER_HOSTILE_MOBS.length),
      () => EntityType.Skeleton,
    )
  }

  if (dimension === 'end') {
    // Vanilla end islands spawn endermen exclusively.
    return EntityType.Enderman
  }

  // Submerged spawn point (deep water): only aquatic mobs — guardians patrol
  // the depths at night, squid school there by day. A land rotation here would
  // put a chicken on the seabed.
  if (isAquaticSpawn) {
    return isNight
      ? Option.getOrElse(Arr.get(AQUATIC_HOSTILE_MOBS, cursor % AQUATIC_HOSTILE_MOBS.length), () => EntityType.Guardian)
      : Option.getOrElse(Arr.get(AQUATIC_PASSIVE_MOBS, cursor % AQUATIC_PASSIVE_MOBS.length), () => EntityType.Squid)
  }

  if (isNight) {
    return Option.getOrElse(Arr.get(HOSTILE_MOBS, cursor % HOSTILE_MOBS.length), () => EntityType.Zombie)
  }

  return Option.getOrElse(Arr.get(PASSIVE_MOBS, cursor % PASSIVE_MOBS.length), () => EntityType.Cow)
}
