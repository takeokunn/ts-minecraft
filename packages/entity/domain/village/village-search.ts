import { Option } from 'effect'
import type { Position } from '@ts-minecraft/core'

import { distanceSq } from './village-position'
import type { Village, VillageStructure, Villager } from './village-model'

export const findClosestVillagerInRange = (
  villagers: ReadonlyArray<Villager>,
  position: Position,
  maxDistanceSq: number,
): Option.Option<Villager> => {
  let closest: Villager | null = null
  let bestDSq = Infinity
  for (let i = 0; i < villagers.length; i++) {
    const villager = villagers[i]!
    const dSq = distanceSq(villager.position, position)
    if (dSq <= maxDistanceSq && dSq < bestDSq) {
      closest = villager
      bestDSq = dSq
    }
  }
  return closest === null ? Option.none() : Option.some(closest)
}

export const findNearestVillage = (
  villages: ReadonlyArray<Village>,
  position: Position,
): Option.Option<Village> => {
  let closest: Village | null = null
  let closestDistanceSq = Infinity
  for (let i = 0; i < villages.length; i++) {
    const village = villages[i]!
    const dSq = distanceSq(village.center, position)
    if (dSq < closestDistanceSq) {
      closest = village
      closestDistanceSq = dSq
    }
  }
  return closest === null ? Option.none() : Option.some(closest)
}

export const findStructureAnchor = (
  structures: ReadonlyArray<VillageStructure>,
  structureId: VillageStructure['structureId'],
): Option.Option<Position> => {
  for (let i = 0; i < structures.length; i++) {
    const structure = structures[i]!
    if (structure.structureId === structureId) {
      return Option.some(structure.anchor)
    }
  }
  return Option.none()
}
