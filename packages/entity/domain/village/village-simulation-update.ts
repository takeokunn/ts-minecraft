import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'

import { ensureSeededVillagesInState } from './village-creation-resolution'
import type { Village } from './village-model'
import type { VillageState } from './village-state'
import { tickVillage } from './village-simulation-village'
import { VILLAGER_MOVE_SPEED } from './village-simulation-villager'

export const advanceVillageState = (
  state: VillageState,
  playerPosition: Position,
  timeOfDay: number,
  deltaTime: DeltaTimeSecs,
  worldSeed: number = 0,
): VillageState => {
  const ensuredState = ensureSeededVillagesInState(state, playerPosition, worldSeed)
  const tick = ensuredState.updateTick + 1
  const maxMoveDelta = Math.max(0, VILLAGER_MOVE_SPEED * deltaTime * 60)

  const villages = Array.from({ length: ensuredState.villages.length }) as Array<Village>
  let anyUpdated = false
  for (let i = 0; i < ensuredState.villages.length; i++) {
    const village = ensuredState.villages[i]!
    const nextVillage = tickVillage(village, playerPosition, timeOfDay, tick, maxMoveDelta)
    villages[i] = nextVillage
    if (nextVillage !== village) {
      anyUpdated = true
    }
  }

  return {
    ...ensuredState,
    villages: anyUpdated ? villages : ensuredState.villages,
    updateTick: tick,
  }
}
