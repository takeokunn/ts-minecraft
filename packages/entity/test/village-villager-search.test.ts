import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { findVillagerById } from '@ts-minecraft/entity/domain/village/village-villager-search'
import {
  VillagerId,
  VillageId,
  VillageStructureId,
  VillagerActivity,
} from '@ts-minecraft/entity/domain/village/village-model'
import type { Village } from '@ts-minecraft/entity/domain/village/village-model'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const HOME_ID = VillageStructureId.make('home-1')
const WORK_ID = VillageStructureId.make('work-1')

const makeVillage = (villagerIdStr: string): Village => ({
  villageId: VillageId.make('v1'),
  center: { x: 48, y: 64, z: 48 },
  structures: [],
  villagers: [
    {
      villagerId: VillagerId.make(villagerIdStr),
      villageId: VillageId.make('v1'),
      profession: 'Farmer',
      homeStructureId: HOME_ID,
      workplaceStructureId: WORK_ID,
      level: 1,
      experience: 0,
      position: { x: 48, y: 64, z: 48 },
      activity: VillagerActivity.Idle,
    },
  ],
})

// ─── findVillagerById ─────────────────────────────────────────────────────────
describe('findVillagerById', () => {
  it('returns Some when the villager exists in a single village', () => {
    const villages = [makeVillage('v1-farmer')]
    const result = findVillagerById(villages, VillagerId.make('v1-farmer'))
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.villagerId).toBe('v1-farmer')
    }
  })

  it('returns None when the villager does not exist', () => {
    const villages = [makeVillage('v1-farmer')]
    const result = findVillagerById(villages, VillagerId.make('non-existent'))
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None for an empty villages list', () => {
    const result = findVillagerById([], VillagerId.make('v1-farmer'))
    expect(Option.isNone(result)).toBe(true)
  })

  it('finds a villager in the second village when absent from the first', () => {
    const village1 = makeVillage('v1-farmer')
    const village2: Village = { ...makeVillage('v2-librarian'), villageId: VillageId.make('v2') }
    const result = findVillagerById([village1, village2], VillagerId.make('v2-librarian'))
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.villagerId).toBe('v2-librarian')
    }
  })

  it('returns the correct villager when multiple villagers exist in the same village', () => {
    const village: Village = {
      villageId: VillageId.make('v1'),
      center: { x: 48, y: 64, z: 48 },
      structures: [],
      villagers: [
        {
          villagerId: VillagerId.make('v1-farmer'),
          villageId: VillageId.make('v1'),
          profession: 'Farmer',
          homeStructureId: HOME_ID,
          workplaceStructureId: WORK_ID,
          level: 1,
          experience: 0,
          position: { x: 48, y: 64, z: 48 },
          activity: VillagerActivity.Idle,
        },
        {
          villagerId: VillagerId.make('v1-librarian'),
          villageId: VillageId.make('v1'),
          profession: 'Librarian',
          homeStructureId: HOME_ID,
          workplaceStructureId: WORK_ID,
          level: 1,
          experience: 0,
          position: { x: 50, y: 64, z: 50 },
          activity: VillagerActivity.Work,
        },
      ],
    }
    const result = findVillagerById([village], VillagerId.make('v1-librarian'))
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.profession).toBe('Librarian')
    }
  })
})
