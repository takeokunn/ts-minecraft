import { Option } from 'effect'
import type { Position } from '@ts-minecraft/core'

import { VillagerActivity, type Village, type Villager, VillageStructureId } from './village-model'
import { ACTIVITY_REST_END, ACTIVITY_REST_START, ACTIVITY_WORK_END, ACTIVITY_WORK_START, WANDER_PHASE_TICK_STEP, WANDER_RADIUS } from './village-simulation.config'
import { distanceSq } from './village-position'
import { findStructureAnchor } from './village-search'

const TRADE_DISTANCE = 4

const hashString = (source: string): number => {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const isInTradeRange = (villagerPosition: Position, playerPosition: Position): boolean =>
  distanceSq(villagerPosition, playerPosition) <= TRADE_DISTANCE * TRADE_DISTANCE

const isRestTime = (timeOfDay: number): boolean =>
  timeOfDay < ACTIVITY_REST_END || timeOfDay > ACTIVITY_REST_START

const isWorkTime = (timeOfDay: number): boolean =>
  timeOfDay >= ACTIVITY_WORK_START && timeOfDay <= ACTIVITY_WORK_END

export const nextActivityForVillager = (
  villager: Villager,
  playerPosition: Position,
  timeOfDay: number,
): VillagerActivity => {
  if (isInTradeRange(villager.position, playerPosition)) {
    return VillagerActivity.Trade
  }

  if (isRestTime(timeOfDay)) {
    return VillagerActivity.Rest
  }
  return isWorkTime(timeOfDay) ? VillagerActivity.Work : VillagerActivity.Wander
}

const getVillageStructurePosition = (village: Village, structureId: VillageStructureId): Option.Option<Position> =>
  findStructureAnchor(village.structures, structureId)

const wanderTargetFromHome = (villager: Villager, homePosition: Position, tick: number): Position => {
  const phase = (hashString(villager.villagerId) + tick * WANDER_PHASE_TICK_STEP) % 360
  const angle = phase * (Math.PI / 180)
  return {
    x: homePosition.x + Math.cos(angle) * WANDER_RADIUS,
    y: homePosition.y,
    z: homePosition.z + Math.sin(angle) * WANDER_RADIUS,
  }
}

export const getTargetPosition = (
  village: Village,
  villager: Villager,
  nextActivity: VillagerActivity,
  tick: number,
): Option.Option<Position> => {
  if (nextActivity === VillagerActivity.Work) {
    return getVillageStructurePosition(village, villager.workplaceStructureId)
  }

  if (nextActivity === VillagerActivity.Rest) {
    return getVillageStructurePosition(village, villager.homeStructureId)
  }

  if (nextActivity === VillagerActivity.Wander) {
    const homePosition = Option.getOrNull(getVillageStructurePosition(village, villager.homeStructureId))
    return homePosition === null ? Option.none() : Option.some(wanderTargetFromHome(villager, homePosition, tick))
  }

  return Option.some(villager.position)
}
