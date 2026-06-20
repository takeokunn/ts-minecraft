import { Option } from 'effect'
import type { Village, Villager, VillagerId } from './village-model'
import { findVillagerById } from './village-villager-search'
import { villagerLevelFromExperience } from './village-villager-level'

const replaceVillagerInVillages = (
  villages: ReadonlyArray<Village>,
  updatedVillager: Villager,
): ReadonlyArray<Village> =>
  villages.map((village) => {
    let changed = false
    const villagers = village.villagers.map((villager) => {
      if (villager.villagerId !== updatedVillager.villagerId) {
        return villager
      }

      changed = true
      return updatedVillager
    })

    return changed ? { ...village, villagers } : village
  })

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
