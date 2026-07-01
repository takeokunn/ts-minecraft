import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { awardVillagerExperience } from '@ts-minecraft/entity/domain/village/village-villager-experience'
import {
  VillageId,
  VillagerActivity,
  VillagerId,
  VillagerProfession,
  VillageStructureId,
  type Village,
  type Villager,
} from '@ts-minecraft/entity/domain/village/village-model'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeVillager = (id: string, experience = 0): Villager => ({
  villagerId: VillagerId.make(id),
  villageId: VillageId.make('village-1'),
  profession: VillagerProfession.Farmer,
  homeStructureId: VillageStructureId.make('home-1'),
  workplaceStructureId: VillageStructureId.make('work-1'),
  level: 1,
  experience,
  position: { x: 0, y: 64, z: 0 },
  activity: VillagerActivity.Idle,
})

const makeVillage = (villagers: Villager[]): Village => ({
  villageId: VillageId.make('village-1'),
  center: { x: 0, y: 64, z: 0 },
  structures: [],
  villagers,
})

// ─── awardVillagerExperience ─────────────────────────────────────────────────
describe('awardVillagerExperience', () => {
  it('returns None and unchanged villages when amount is 0', () => {
    const villager = makeVillager('v1')
    const villages = [makeVillage([villager])]
    const [updated, newVillages] = awardVillagerExperience(villages, villager.villagerId, 0)
    expect(Option.isNone(updated)).toBe(true)
    expect(newVillages).toBe(villages)
  })

  it('returns None and unchanged villages when amount is negative', () => {
    const villager = makeVillager('v1')
    const villages = [makeVillage([villager])]
    const [updated, newVillages] = awardVillagerExperience(villages, villager.villagerId, -5)
    expect(Option.isNone(updated)).toBe(true)
    expect(newVillages).toBe(villages)
  })

  it('returns None when villager id does not exist', () => {
    const villager = makeVillager('v1')
    const villages = [makeVillage([villager])]
    const [updated] = awardVillagerExperience(villages, VillagerId.make('nonexistent'), 5)
    expect(Option.isNone(updated)).toBe(true)
  })

  it('increments experience by the given amount', () => {
    const villager = makeVillager('v1', 0)
    const villages = [makeVillage([villager])]
    const [updated] = awardVillagerExperience(villages, villager.villagerId, 5)
    expect(Option.isSome(updated)).toBe(true)
    if (Option.isSome(updated)) {
      expect(updated.value.experience).toBe(5)
    }
  })

  it('upgrades level when XP crosses the level-2 threshold (6 XP)', () => {
    const villager = makeVillager('v1', 5) // 5 xp → level 1 still
    const villages = [makeVillage([villager])]
    const [updated] = awardVillagerExperience(villages, villager.villagerId, 1) // now 6 → level 2
    if (Option.isSome(updated)) {
      expect(updated.value.level).toBe(2)
    }
  })

  it('replaces the villager in the returned villages list', () => {
    const villager = makeVillager('v1', 0)
    const villages = [makeVillage([villager])]
    const [, newVillages] = awardVillagerExperience(villages, villager.villagerId, 3)
    const found = newVillages[0]?.villagers.find((v) => v.villagerId === villager.villagerId)
    expect(found?.experience).toBe(3)
  })

  it('does not mutate other villagers when updating one', () => {
    const v1 = makeVillager('v1')
    const v2 = makeVillager('v2')
    const village = makeVillage([v1, v2])
    const [, newVillages] = awardVillagerExperience([village], v1.villagerId, 10)
    const found = newVillages[0]?.villagers.find((v) => v.villagerId === v2.villagerId)
    expect(found?.experience).toBe(0)
  })
})
