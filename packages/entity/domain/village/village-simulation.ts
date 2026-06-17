import { Option } from 'effect'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import {
  VillagerActivity,
  type Village,
  type Villager,
} from './village-model'
import { ensureVillageInState } from './village-creation'
import type { VillageState } from './village-state'
import { distanceSq, moveTowards } from './village-position'
import { getTargetPosition, nextActivityForVillager } from './village-simulation-activity'

export const VILLAGE_GRID_SIZE = 96
export const VILLAGE_NEAR_DISTANCE = 80
export const TRADE_DISTANCE = 4
// Villages are generated on exploration and never evicted, so the village list
// grows with the explored world. Only villages within this radius of the player
// have their villagers simulated each tick — distant villages are frozen (state
// preserved, resumes on return), bounding per-tick cost to the player's vicinity
// instead of O(every village ever generated). Comfortably exceeds the grid +
// near-distance so the player's current village is always simulated.
export const VILLAGE_SIMULATION_DISTANCE = 192

// Performance boundary: plain for-loop avoids Arr.fromIterable array allocation per villager per tick
export const hashString = (source: string): number => {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const VILLAGER_MOVE_SPEED = 0.045
const VILLAGE_SIMULATION_DISTANCE_SQ = VILLAGE_SIMULATION_DISTANCE * VILLAGE_SIMULATION_DISTANCE

const tickVillage = (
  village: Village,
  playerPosition: Position,
  timeOfDay: number,
  tick: number,
  maxMoveDelta: number,
): Village => {
  if (distanceSq(village.center, playerPosition) > VILLAGE_SIMULATION_DISTANCE_SQ) {
    return village
  }

  const villagers: Array<Villager> = new Array(village.villagers.length)
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

const tickVillager = (
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

export const advanceVillageState = (
  state: VillageState,
  playerPosition: Position,
  timeOfDay: number,
  deltaTime: DeltaTimeSecs,
): VillageState => {
  const [ensuredState] = ensureVillageInState(state, playerPosition)
  const tick = ensuredState.updateTick + 1
  const maxMoveDelta = Math.max(0, VILLAGER_MOVE_SPEED * deltaTime * 60)

  const villages: Array<Village> = new Array(ensuredState.villages.length)
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
