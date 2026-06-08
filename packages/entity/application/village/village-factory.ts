// Factory helpers for creating and initialising Village state.
// Extracted from village-service.ts to keep the service file focused on the
// stateful orchestration layer.
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
} from '../../domain/village/village-model'
import {
  STRUCTURE_TEMPLATES,
  VILLAGER_TEMPLATES,
  buildAnchor,
  buildScopedId,
} from './village-service.config'
import {
  VILLAGE_NEAR_DISTANCE,
  distanceSq,
  findNearestVillage,
  findStructureAnchor,
  snapVillageCenter,
  flattenVillagers,
} from '../../domain/village/village-simulation'

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

export const createVillage = (villageNumber: number, center: Position): Village => {
  const villageId = VillageId.make(`village-${villageNumber}`)
  const structureId = (suffix: string): VillageStructureId =>
    VillageStructureId.make(buildScopedId(villageId, suffix))

  const structures: ReadonlyArray<VillageStructure> = Arr.map(STRUCTURE_TEMPLATES, (template) => ({
    structureId: structureId(template.suffix),
    type: template.type,
    anchor: buildAnchor(center, template),
    size: { x: template.sizeX, y: template.sizeY, z: template.sizeZ },
  }))

  const villagers: ReadonlyArray<Villager> = Arr.map(VILLAGER_TEMPLATES, (template) => ({
    villagerId: VillagerId.make(buildScopedId(villageId, template.suffix)),
    villageId,
    profession: VillagerProfession[template.profession],
    homeStructureId: structureId(template.homeStructureSuffix),
    workplaceStructureId: structureId(template.workplaceStructureSuffix),
    level: 1,
    experience: 0,
    position: findStructureAnchor(structures, structureId(template.homeStructureSuffix), center),
    activity: VillagerActivity.Idle,
  }))

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
): readonly [VillageState, Village] =>
  Option.match(findNearestVillage(state.villages, playerPosition), {
    onNone: () => {
      const village = createVillage(state.nextVillageNumber, snapVillageCenter(playerPosition))
      return [
        {
          ...state,
          villages: Arr.append(state.villages, village),
          nextVillageNumber: state.nextVillageNumber + 1,
        },
        village,
      ] as const
    },
    onSome: (nearestVillage) => {
      if (distanceSq(nearestVillage.center, playerPosition) <= VILLAGE_NEAR_DISTANCE * VILLAGE_NEAR_DISTANCE) {
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
    },
  })

type ClosestAcc = { readonly villager: Option.Option<Villager>; readonly bestDSq: number }

export const findClosestVillagerInRange = (
  villagers: ReadonlyArray<Villager>,
  position: Position,
  maxDistanceSq: number,
): Option.Option<Villager> => {
  const result = Arr.reduce(
    villagers,
    { villager: Option.none<Villager>(), bestDSq: Infinity } as ClosestAcc,
    (acc, v) => {
      const dSq = distanceSq(v.position, position)
      return dSq <= maxDistanceSq && dSq < acc.bestDSq
        ? { villager: Option.some(v), bestDSq: dSq }
        : acc
    },
  )
  return result.villager
}

export { flattenVillagers }
