import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/kernel'
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
  findNearestVillage,
  findStructureAnchor,
  snapVillageCenter,
  distanceSq,
  VILLAGE_NEAR_DISTANCE,
} from './village-simulation'

export type VillageState = {
  readonly villages: ReadonlyArray<Village>
  readonly nextVillageNumber: number
  readonly updateTick: number
}

export const INITIAL_STATE: VillageState = {
  villages: [],
  nextVillageNumber: 1,
  updateTick: 0,
}

export const createVillage = (villageNumber: number, center: Position): Village => {
  const villageId = VillageId.make(`village-${villageNumber}`)
  const structureId = (suffix: string): VillageStructureId => VillageStructureId.make(`${villageId}:${suffix}`)

  const structures: ReadonlyArray<VillageStructure> = [
    {
      structureId: structureId('well'),
      type: 'well',
      anchor: { x: center.x, y: center.y, z: center.z },
      size: { x: 3, y: 4, z: 3 },
    },
    {
      structureId: structureId('road-main'),
      type: 'road',
      anchor: { x: center.x - 12, y: center.y, z: center.z },
      size: { x: 24, y: 1, z: 3 },
    },
    {
      structureId: structureId('house-a'),
      type: 'house',
      anchor: { x: center.x - 8, y: center.y, z: center.z - 8 },
      size: { x: 6, y: 5, z: 6 },
    },
    {
      structureId: structureId('house-b'),
      type: 'house',
      anchor: { x: center.x + 2, y: center.y, z: center.z - 8 },
      size: { x: 6, y: 5, z: 6 },
    },
    {
      structureId: structureId('house-c'),
      type: 'house',
      anchor: { x: center.x + 8, y: center.y, z: center.z + 2 },
      size: { x: 6, y: 5, z: 6 },
    },
    {
      structureId: structureId('farm'),
      type: 'farm',
      anchor: { x: center.x - 10, y: center.y, z: center.z + 6 },
      size: { x: 8, y: 1, z: 8 },
    },
  ]

  const byId = (id: VillageStructureId): Position =>
    findStructureAnchor(structures, id, center)

  const villagers: ReadonlyArray<Villager> = [
    {
      villagerId: VillagerId.make(`${villageId}:villager-farmer`),
      villageId,
      profession: VillagerProfession.Farmer,
      homeStructureId: structureId('house-a'),
      workplaceStructureId: structureId('farm'),
      level: 1,
      experience: 0,
      position: byId(structureId('house-a')),
      activity: VillagerActivity.Idle,
    },
    {
      villagerId: VillagerId.make(`${villageId}:villager-librarian`),
      villageId,
      profession: VillagerProfession.Librarian,
      homeStructureId: structureId('house-b'),
      workplaceStructureId: structureId('well'),
      level: 1,
      experience: 0,
      position: byId(structureId('house-b')),
      activity: VillagerActivity.Idle,
    },
    {
      villagerId: VillagerId.make(`${villageId}:villager-blacksmith`),
      villageId,
      profession: VillagerProfession.Blacksmith,
      homeStructureId: structureId('house-c'),
      workplaceStructureId: structureId('road-main'),
      level: 1,
      experience: 0,
      position: byId(structureId('house-c')),
      activity: VillagerActivity.Idle,
    },
  ]

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
