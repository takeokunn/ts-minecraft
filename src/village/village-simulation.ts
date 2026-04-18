import { Array as Arr, Option } from 'effect'
import type { Position } from '@/shared/kernel'
import {
  VillagerActivity,
  type Village,
  type Villager,
  type VillageStructure,
  VillageStructureId,
} from '@/village/village-model'

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

  if (timeOfDay < 0.22 || timeOfDay > 0.78) {
    return VillagerActivity.Rest
  }

  if (timeOfDay >= 0.28 && timeOfDay <= 0.72) {
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
    const phase = (hashString(villager.villagerId) + tick * 9) % 360
    const angle = phase * (Math.PI / 180)
    return {
      x: homePosition.x + Math.cos(angle) * 2,
      y: homePosition.y,
      z: homePosition.z + Math.sin(angle) * 2,
    }
  }

  return villager.position
}

export const flattenVillagers = (villages: ReadonlyArray<Village>): ReadonlyArray<Villager> =>
  Arr.flatMap(villages, (village) => village.villagers)
