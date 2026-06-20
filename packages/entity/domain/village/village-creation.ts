import type { Position } from '@ts-minecraft/core'

import { VillageId, type Village } from './village-model'
import { buildVillageStructures } from './village-creation-structures'
import { buildVillageVillagers } from './village-creation-villagers'

export const createVillage = (villageNumber: number, center: Position): Village => {
  const villageId = VillageId.make(`village-${villageNumber}`)
  const structures = buildVillageStructures(villageId, center)
  const villagers = buildVillageVillagers(villageId, structures)

  return {
    villageId,
    center,
    structures,
    villagers,
  }
}
