import { Option } from 'effect'

import {
  VillagerActivity,
  VillagerId,
  VillageStructureId,
  VillagerProfession,
  type Village,
  type VillageStructure,
  type Villager,
} from './village-model'
import { VILLAGER_TEMPLATES } from './village-creation-data'
import { buildScopedId } from './village-creation-data.helpers'
import { findStructureAnchor } from './village-search'

export const buildVillageVillagers = (
  villageId: Village['villageId'],
  structures: ReadonlyArray<VillageStructure>,
): ReadonlyArray<Villager> => {
  const structureId = (suffix: string): VillageStructureId => VillageStructureId.make(buildScopedId(villageId, suffix))

  const villagers = Array.from({ length: VILLAGER_TEMPLATES.length }) as Array<Villager>
  for (let i = 0; i < VILLAGER_TEMPLATES.length; i++) {
    const template = VILLAGER_TEMPLATES[i]!
    const homeStructureId = structureId(template.homeStructureSuffix)
    villagers[i] = {
      villagerId: VillagerId.make(buildScopedId(villageId, template.suffix)),
      villageId,
      profession: VillagerProfession[template.profession],
      homeStructureId,
      workplaceStructureId: VillageStructureId.make(structureId(template.workplaceStructureSuffix)),
      level: 1,
      experience: 0,
      position: Option.getOrThrow(findStructureAnchor(structures, homeStructureId)),
      activity: VillagerActivity.Idle,
    }
  }

  return villagers
}
