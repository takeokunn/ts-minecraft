import type { Village } from './village-model'
import type { Villager } from './village-model'

export type VillageState = {
  readonly villages: ReadonlyArray<Village>
  readonly nextVillageNumber: number
  readonly updateTick: number
}

export const INITIAL_VILLAGE_STATE: VillageState = {
  villages: [],
  nextVillageNumber: 1,
  updateTick: 0,
}

export const flattenVillagers = (villages: ReadonlyArray<Village>): ReadonlyArray<Villager> => {
  const villagers: Array<Villager> = []
  for (let i = 0; i < villages.length; i++) {
    const village = villages[i]!
    for (let j = 0; j < village.villagers.length; j++) {
      villagers.push(village.villagers[j]!)
    }
  }
  return villagers
}
