import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import {
  VillageId,
  VillageStructureId,
  VillagerId,
  VillagerActivity,
  VillagerProfession,
  type Village,
  type Villager,
  type VillageStructure,
} from './village-model'
import {
  STRUCTURE_TEMPLATES,
  VILLAGER_TEMPLATES,
  buildAnchor,
  buildScopedId,
} from './village-creation-data'
import { VILLAGE_NEAR_DISTANCE } from './village-simulation'
import { distanceSq } from './village-position'
import { findNearestVillage, findStructureAnchor } from './village-search'
import { snapVillageCenter } from './village-placement-geometry'
import type { VillageState } from './village-state'

export const createVillage = (villageNumber: number, center: Position): Village => {
  const villageId = VillageId.make(`village-${villageNumber}`)
  const structureId = (suffix: string): VillageStructureId =>
    VillageStructureId.make(buildScopedId(villageId, suffix))

  const structures: Array<VillageStructure> = new Array(STRUCTURE_TEMPLATES.length)
  for (let i = 0; i < STRUCTURE_TEMPLATES.length; i++) {
    const template = STRUCTURE_TEMPLATES[i]!
    structures[i] = {
      structureId: structureId(template.suffix),
      type: template.type,
      anchor: buildAnchor(center, template),
      size: { x: template.sizeX, y: template.sizeY, z: template.sizeZ },
    }
  }

  const villagers: Array<Villager> = new Array(VILLAGER_TEMPLATES.length)
  for (let i = 0; i < VILLAGER_TEMPLATES.length; i++) {
    const template = VILLAGER_TEMPLATES[i]!
    villagers[i] = {
      villagerId: VillagerId.make(buildScopedId(villageId, template.suffix)),
      villageId,
      profession: VillagerProfession[template.profession],
      homeStructureId: structureId(template.homeStructureSuffix),
      workplaceStructureId: structureId(template.workplaceStructureSuffix),
      level: 1,
      experience: 0,
      position: Option.getOrThrow(findStructureAnchor(structures, structureId(template.homeStructureSuffix))),
      activity: VillagerActivity.Idle,
    }
  }

  return {
    villageId,
    center,
    structures,
    villagers,
  }
}

export const ensureVillageInState = (
  state: VillageState,
  playerPosition: Position,
): readonly [VillageState, Village] => {
  const nearestVillage = Option.getOrNull(findNearestVillage(state.villages, playerPosition))
  if (
    nearestVillage !== null &&
    distanceSq(nearestVillage.center, playerPosition) <= VILLAGE_NEAR_DISTANCE * VILLAGE_NEAR_DISTANCE
  ) {
    return [state, nearestVillage] as const
  }
  const village = createVillage(state.nextVillageNumber, snapVillageCenter(playerPosition))
  return [
    {
      ...state,
      villages: Arr.append(state.villages, village),
      nextVillageNumber: state.nextVillageNumber + 1,
    },
    village,
  ] as const
}
