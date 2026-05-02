import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/kernel'
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

export const distanceSq = (a: Position, b: Position): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return dx * dx + dy * dy + dz * dz
}

export const hashString = (source: string): number =>
  Math.abs(Arr.reduce(Arr.fromIterable(source), 0, (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0))

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
  Arr.reduce(villages, Option.none<Village>(), (closest, village) =>
    Option.match(closest, {
      onNone: () => Option.some(village),
      onSome: (current) =>
        distanceSq(village.center, position) < distanceSq(current.center, position)
          ? Option.some(village)
          : closest,
    })
  )

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

  if (timeOfDay >= ACTIVITY_WORK_START && timeOfDay <= ACTIVITY_WORK_END) {
    return VillagerActivity.Work
  }

  return VillagerActivity.Wander
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
