import { Option } from 'effect'

import { type VillagerId, type Village, type Villager } from './village-model'

export const findVillagerById = (
  villages: ReadonlyArray<Village>,
  villagerId: VillagerId,
): Option.Option<Villager> => {
  for (const village of villages) {
    for (const villager of village.villagers) {
      if (villager.villagerId === villagerId) {
        return Option.some(villager)
      }
    }
  }

  return Option.none()
}

const replaceVillagerInVillages = (villages: ReadonlyArray<Village>, updatedVillager: Villager): ReadonlyArray<Village> => {
  const nextVillages: Array<Village> = new Array(villages.length)
  let anyUpdated = false
  for (let i = 0; i < villages.length; i++) {
    const village = villages[i]!
    const villagers: Array<Villager> = new Array(village.villagers.length)
    for (let j = 0; j < village.villagers.length; j++) {
      const villager = village.villagers[j]!
      if (villager.villagerId === updatedVillager.villagerId) {
        villagers[j] = updatedVillager
        anyUpdated = true
      } else {
        villagers[j] = villager
      }
    }
    nextVillages[i] = {
      ...village,
      villagers,
    }
  }

  return anyUpdated ? nextVillages : villages
}

export const awardVillagerExperience = (
  villages: ReadonlyArray<Village>,
  villagerId: VillagerId,
  amount: number,
): readonly [Option.Option<Villager>, ReadonlyArray<Village>] => {
  if (amount <= 0) {
    return [Option.none(), villages] as const
  }

  const foundVillager = Option.getOrNull(findVillagerById(villages, villagerId))
  if (foundVillager === null) {
    return [Option.none(), villages] as const
  }

  const experience = foundVillager.experience + amount
  const updatedVillager = {
    ...foundVillager,
    experience,
    level: villagerLevelFromExperience(experience),
  }

  return [Option.some(updatedVillager), replaceVillagerInVillages(villages, updatedVillager)] as const
}

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
