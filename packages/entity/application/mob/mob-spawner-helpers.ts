import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { EntityType } from '../../domain/mob/entity'
import { MIN_SPAWN_DISTANCE } from '../../domain/mob/spawner-config'
import { PASSIVE_MOBS, HOSTILE_MOBS } from '../../domain/mob/mob-categories'

export const getSpawnPosition = (playerPosition: Position, cursor: number): Position => {
  const angle = ((cursor % 16) / 16) * Math.PI * 2
  const distance = MIN_SPAWN_DISTANCE + (cursor % 4) * 8

  return {
    x: playerPosition.x + Math.cos(angle) * distance,
    y: playerPosition.y,
    z: playerPosition.z + Math.sin(angle) * distance,
  }
}

export const selectMobType = (isNight: boolean, cursor: number): EntityType => {
  if (isNight) {
    return Option.getOrElse(Arr.get(HOSTILE_MOBS, cursor % HOSTILE_MOBS.length), () => EntityType.Zombie)
  }

  return Option.getOrElse(Arr.get(PASSIVE_MOBS, cursor % PASSIVE_MOBS.length), () => EntityType.Cow)
}
