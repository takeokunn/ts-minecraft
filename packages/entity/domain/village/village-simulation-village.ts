import type { Position } from '@ts-minecraft/core'

import { distanceSq } from './village-position'
import type { Village } from './village-model'
import { VILLAGE_SIMULATION_DISTANCE } from './village-simulation-constants'
import { tickVillager } from './village-simulation-villager'

const VILLAGE_SIMULATION_DISTANCE_SQ = VILLAGE_SIMULATION_DISTANCE * VILLAGE_SIMULATION_DISTANCE

export const tickVillage = (
  village: Village,
  playerPosition: Position,
  timeOfDay: number,
  tick: number,
  maxMoveDelta: number,
): Village => {
  if (distanceSq(village.center, playerPosition) > VILLAGE_SIMULATION_DISTANCE_SQ) {
    return village
  }

  const villagers = Array.from({ length: village.villagers.length }) as Array<Village['villagers'][number]>
  let anyUpdated = false
  for (let i = 0; i < village.villagers.length; i++) {
    const villager = village.villagers[i]!
    const nextVillager = tickVillager(villager, village, playerPosition, timeOfDay, tick, maxMoveDelta)
    villagers[i] = nextVillager
    if (nextVillager !== villager) {
      anyUpdated = true
    }
  }

  if (!anyUpdated) {
    return village
  }

  return {
    ...village,
    villagers,
  }
}
