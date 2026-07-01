import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  getTargetPosition,
  nextActivityForVillager,
} from '@ts-minecraft/entity/domain/village/village-simulation-activity'
import {
  VillagerId,
  VillageId,
  VillageStructureId,
  VillagerActivity,
} from '@ts-minecraft/entity/domain/village/village-model'
import type { Village, Villager } from '@ts-minecraft/entity/domain/village/village-model'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const HOME_ID = VillageStructureId.make('home-1')
const WORK_ID = VillageStructureId.make('work-1')
const VILLAGE_ID = VillageId.make('v1')
const VILLAGER_ID = VillagerId.make('villager-1')

const makeVillager = (overrides: Partial<Villager> = {}): Villager => ({
  villagerId: VILLAGER_ID,
  villageId: VILLAGE_ID,
  profession: 'Farmer',
  homeStructureId: HOME_ID,
  workplaceStructureId: WORK_ID,
  level: 1,
  experience: 0,
  position: { x: 0, y: 64, z: 0 },
  activity: VillagerActivity.Idle,
  ...overrides,
})

const makeVillage = (): Village => ({
  villageId: VILLAGE_ID,
  center: { x: 48, y: 64, z: 48 },
  structures: [
    {
      structureId: HOME_ID,
      type: 'house',
      anchor: { x: 50, y: 64, z: 50 },
      size: { x: 3, y: 4, z: 3 },
    },
    {
      structureId: WORK_ID,
      type: 'farm',
      anchor: { x: 40, y: 64, z: 40 },
      size: { x: 3, y: 2, z: 3 },
    },
  ],
  villagers: [],
})

// ─── nextActivityForVillager ──────────────────────────────────────────────────
// Activity thresholds: rest 0.78–1.0 and 0.0–0.22; work 0.28–0.72; wander otherwise
describe('nextActivityForVillager', () => {
  const player = { x: 100, y: 64, z: 100 } // far from villager at origin

  it('returns Trade when player is within 4 blocks', () => {
    const villager = makeVillager({ position: { x: 0, y: 64, z: 0 } })
    const nearby = { x: 2, y: 64, z: 2 } // ~2.8 blocks away
    expect(nextActivityForVillager(villager, nearby, 0.5)).toBe(VillagerActivity.Trade)
  })

  it('returns Rest during late night (timeOfDay > 0.78)', () => {
    expect(nextActivityForVillager(makeVillager(), player, 0.9)).toBe(VillagerActivity.Rest)
  })

  it('returns Rest during early morning (timeOfDay < 0.22)', () => {
    expect(nextActivityForVillager(makeVillager(), player, 0.1)).toBe(VillagerActivity.Rest)
  })

  it('returns Work during daytime (timeOfDay in 0.28–0.72)', () => {
    expect(nextActivityForVillager(makeVillager(), player, 0.5)).toBe(VillagerActivity.Work)
  })

  it('returns Wander during transition times (0.22–0.28)', () => {
    expect(nextActivityForVillager(makeVillager(), player, 0.25)).toBe(VillagerActivity.Wander)
  })

  it('returns Wander during dusk transition (0.72–0.78)', () => {
    expect(nextActivityForVillager(makeVillager(), player, 0.75)).toBe(VillagerActivity.Wander)
  })
})

// ─── getTargetPosition ────────────────────────────────────────────────────────
describe('getTargetPosition', () => {
  it('returns the work structure anchor for Work activity', () => {
    const village = makeVillage()
    const villager = makeVillager()
    const result = getTargetPosition(village, villager, VillagerActivity.Work, 0)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ x: 40, y: 64, z: 40 })
    }
  })

  it('returns the home structure anchor for Rest activity', () => {
    const village = makeVillage()
    const villager = makeVillager()
    const result = getTargetPosition(village, villager, VillagerActivity.Rest, 0)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ x: 50, y: 64, z: 50 })
    }
  })

  it('returns the villager position for Trade activity', () => {
    const villager = makeVillager({ position: { x: 5, y: 64, z: 5 } })
    const result = getTargetPosition(makeVillage(), villager, VillagerActivity.Trade, 0)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ x: 5, y: 64, z: 5 })
    }
  })

  it('returns some wander target offset from home for Wander activity', () => {
    const village = makeVillage()
    const villager = makeVillager()
    const result = getTargetPosition(village, villager, VillagerActivity.Wander, 0)
    expect(Option.isSome(result)).toBe(true)
    // wander target is near home anchor, not at it exactly
    if (Option.isSome(result)) {
      expect(result.value.y).toBe(64) // y is preserved from home
    }
  })

  it('returns None for Wander when villager has no home structure in the village', () => {
    const village = { ...makeVillage(), structures: [] } // no structures
    const villager = makeVillager()
    const result = getTargetPosition(village, villager, VillagerActivity.Wander, 0)
    expect(Option.isNone(result)).toBe(true)
  })
})
