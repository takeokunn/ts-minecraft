import {
  VillageId,
  VillageStructureId,
  VillagerId,
  VillagerProfession,
  VillagerActivity,
} from '@ts-minecraft/entity'
import type {
  Village,
  Villager,
  VillageStructure,
  VillagerProfession as VillagerProfessionT,
  VillagerActivity as VillagerActivityT,
} from '@ts-minecraft/entity'
import type { Position } from '@ts-minecraft/core'

type VillageStructureOverrides = Partial<{
  structureId: VillageStructure['structureId']
  type: VillageStructure['type']
  anchor: Position
  size: VillageStructure['size']
}>

/**
 * Returns a valid VillageStructure with sensible defaults.
 */
export const makeTestVillageStructure = (overrides: VillageStructureOverrides = {}): VillageStructure => ({
  structureId: overrides.structureId ?? VillageStructureId.make('test-village:house-a'),
  type: overrides.type ?? 'house',
  anchor: overrides.anchor ?? { x: 0, y: 64, z: 0 },
  size: overrides.size ?? { x: 6, y: 5, z: 6 },
})

type VillagerOverrides = Partial<{
  villagerId: Villager['villagerId']
  villageId: Villager['villageId']
  profession: VillagerProfessionT
  homeStructureId: Villager['homeStructureId']
  workplaceStructureId: Villager['workplaceStructureId']
  level: number
  experience: number
  position: Position
  activity: VillagerActivityT
}>

/**
 * Returns a valid Villager with sensible defaults.
 */
export const makeTestVillager = (overrides: VillagerOverrides = {}): Villager => {
  const villageId = overrides.villageId ?? VillageId.make('test-village')
  return {
    villagerId: overrides.villagerId ?? VillagerId.make(`${villageId}:villager-farmer`),
    villageId,
    profession: overrides.profession ?? VillagerProfession.Farmer,
    homeStructureId: overrides.homeStructureId ?? VillageStructureId.make(`${villageId}:house-a`),
    workplaceStructureId: overrides.workplaceStructureId ?? VillageStructureId.make(`${villageId}:farm`),
    level: overrides.level ?? 1,
    experience: overrides.experience ?? 0,
    position: overrides.position ?? { x: 0, y: 64, z: 0 },
    activity: overrides.activity ?? VillagerActivity.Idle,
  }
}

type VillageOverrides = Partial<{
  villageId: Village['villageId']
  center: Position
  structures: ReadonlyArray<VillageStructure>
  villagers: ReadonlyArray<Villager>
}>

/**
 * Returns a valid Village with at least one linked villager and structure.
 */
export const makeTestVillage = (overrides: VillageOverrides = {}): Village => {
  const villageId = overrides.villageId ?? VillageId.make('test-village')
  const center = overrides.center ?? { x: 0, y: 64, z: 0 }
  const structures = overrides.structures ?? [makeTestVillageStructure()]
  const villagers = overrides.villagers ?? [makeTestVillager({ villageId })]
  return { villageId, center, structures, villagers }
}
