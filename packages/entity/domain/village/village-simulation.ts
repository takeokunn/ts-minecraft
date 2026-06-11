import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import {
  VillagerActivity,
  type Village,
  type Villager,
  type VillageStructure,
  VillageStructureId,
} from './village-model'
import {
  ACTIVITY_REST_START, ACTIVITY_REST_END,
  ACTIVITY_WORK_START, ACTIVITY_WORK_END,
  WANDER_RADIUS, WANDER_PHASE_TICK_STEP,
} from './village-simulation.config'

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

export const distanceSq = (a: Position, b: Position): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return dx * dx + dy * dy + dz * dz
}

// Performance boundary: plain for-loop avoids Arr.fromIterable array allocation per villager per tick
export const hashString = (source: string): number => {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export const moveTowards = (from: Position, to: Position, maxDelta: number): Position => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

  if (distance === 0 || distance <= maxDelta) {
    return to
  }

  return {
    x: from.x + (dx / distance) * maxDelta,
    y: from.y + (dy / distance) * maxDelta,
    z: from.z + (dz / distance) * maxDelta,
  }
}

export const findNearestVillage = (
  villages: ReadonlyArray<Village>,
  position: Position,
): Option.Option<Village> =>
  Arr.reduce(villages, Option.none<Village>(), (closest, village) => {
    const c = Option.getOrNull(closest)
    if (c === null) return Option.some(village)
    return distanceSq(village.center, position) < distanceSq(c.center, position)
      ? Option.some(village)
      : closest
  })

export const findStructureAnchor = (
  structures: ReadonlyArray<VillageStructure>,
  structureId: VillageStructureId,
  fallback: Position,
): Position =>
  Option.getOrElse(
    Arr.findFirst(structures, (s) => s.structureId === structureId).pipe(
      Option.map((s) => s.anchor),
    ),
    () => fallback,
  )

export const snapVillageCenter = (position: Position): Position => ({
  x: Math.floor(position.x / VILLAGE_GRID_SIZE) * VILLAGE_GRID_SIZE + VILLAGE_GRID_SIZE / 2,
  y: Math.max(64, Math.round(position.y)),
  z: Math.floor(position.z / VILLAGE_GRID_SIZE) * VILLAGE_GRID_SIZE + VILLAGE_GRID_SIZE / 2,
})

export const nextActivityForVillager = (
  villager: Villager,
  playerPosition: Position,
  timeOfDay: number,
): VillagerActivity => {
  if (distanceSq(villager.position, playerPosition) <= TRADE_DISTANCE * TRADE_DISTANCE) {
    return VillagerActivity.Trade
  }

  if (timeOfDay < ACTIVITY_REST_END || timeOfDay > ACTIVITY_REST_START) {
    return VillagerActivity.Rest
  }
  return timeOfDay >= ACTIVITY_WORK_START && timeOfDay <= ACTIVITY_WORK_END
    ? VillagerActivity.Work
    : VillagerActivity.Wander
}

export const getTargetPosition = (
  village: Village,
  villager: Villager,
  nextActivity: VillagerActivity,
  tick: number,
): Position => {
  const findStructurePosition = (structureId: VillageStructureId): Position =>
    findStructureAnchor(village.structures, structureId, villager.position)

  if (nextActivity === VillagerActivity.Work) {
    return findStructurePosition(villager.workplaceStructureId)
  }

  const homePosition = findStructurePosition(villager.homeStructureId)
  if (nextActivity === VillagerActivity.Rest) {
    return homePosition
  }

  if (nextActivity === VillagerActivity.Wander) {
    const phase = (hashString(villager.villagerId) + tick * WANDER_PHASE_TICK_STEP) % 360
    const angle = phase * (Math.PI / 180)
    return {
      x: homePosition.x + Math.cos(angle) * WANDER_RADIUS,
      y: homePosition.y,
      z: homePosition.z + Math.sin(angle) * WANDER_RADIUS,
    }
  }

  return villager.position
}

export const flattenVillagers = (villages: ReadonlyArray<Village>): ReadonlyArray<Villager> =>
  Arr.flatMap(villages, (village) => village.villagers)

const LEVEL_2_XP_THRESHOLD = 6
const LEVEL_3_XP_THRESHOLD = 14
const LEVEL_4_XP_THRESHOLD = 28

export const villagerLevelFromExperience = (experience: number): number => {
  if (experience >= LEVEL_4_XP_THRESHOLD) {
    return 4
  }

  if (experience >= LEVEL_3_XP_THRESHOLD) {
    return 3
  }

  if (experience >= LEVEL_2_XP_THRESHOLD) {
    return 2
  }

  return 1
}
