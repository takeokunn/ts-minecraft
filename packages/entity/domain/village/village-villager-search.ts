import { Option } from 'effect'
import type { Villager, VillagerId, Village } from './village-model'

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
