import { Option } from 'effect'

import type { Position } from '@ts-minecraft/core'

import { VillagerActivity, type Village, type Villager } from './village-model'
import { moveTowards } from './village-position'
import { getTargetPosition, nextActivityForVillager } from './village-simulation-activity'

export const VILLAGER_MOVE_SPEED = 0.045

export const tickVillager = (
  villager: Villager,
  village: Village,
  playerPosition: Position,
  timeOfDay: number,
  tick: number,
  maxMoveDelta: number,
): Villager => {
  const nextActivity = nextActivityForVillager(villager, playerPosition, timeOfDay)
  const targetPosition = nextActivity === VillagerActivity.Trade ? null : Option.getOrNull(getTargetPosition(village, villager, nextActivity, tick))
  const nextPosition = targetPosition === null ? villager.position : moveTowards(villager.position, targetPosition, maxMoveDelta)

  if (nextActivity === villager.activity && nextPosition === villager.position) {
    return villager
  }

  return {
    ...villager,
    activity: nextActivity,
    position: nextPosition,
  }
}
