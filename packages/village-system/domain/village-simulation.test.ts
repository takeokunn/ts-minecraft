import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  VillageId,
  VillageStructureId,
  VillagerId,
  VillagerActivity,
  VillagerProfession,
  TRADE_DISTANCE,
  distanceSq,
  hashString,
  moveTowards,
  findNearestVillage,
  snapVillageCenter,
  nextActivityForVillager,
  flattenVillagers,
} from '@ts-minecraft/village-system'
import type { Village, Villager } from '@ts-minecraft/village-system'

const makeVillage = (id: string, cx: number, cy: number, cz: number): Village => ({
  villageId: VillageId.make(id),
  center: { x: cx, y: cy, z: cz },
  structures: [],
  villagers: [],
})

const makeVillager = (id: string, px: number, py: number, pz: number): Villager => ({
  villagerId: VillagerId.make(id),
  villageId: VillageId.make('village-1'),
  profession: VillagerProfession.Farmer,
  homeStructureId: VillageStructureId.make('village-1:house-a'),
  workplaceStructureId: VillageStructureId.make('village-1:farm'),
  level: 1,
  experience: 0,
  position: { x: px, y: py, z: pz },
  activity: VillagerActivity.Idle,
})

describe('village/village-simulation', () => {
  describe('distanceSq', () => {
    it('same point returns 0', () => {
      const p = { x: 5, y: 10, z: -3 }
      expect(distanceSq(p, p)).toBe(0)
    })

    it('(0,0,0) to (3,4,0) returns 25', () => {
      expect(distanceSq({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(25)
    })

    it('is symmetric', () => {
      const a = { x: 1, y: 2, z: 3 }
      const b = { x: 7, y: -1, z: 5 }
      expect(distanceSq(a, b)).toBe(distanceSq(b, a))
    })
  })

  describe('hashString', () => {
    it('same string produces same result (deterministic)', () => {
      expect(hashString('hello')).toBe(hashString('hello'))
    })

    it('empty string does not throw and returns a defined number', () => {
      const result = hashString('')
      expect(typeof result).toBe('number')
    })

    it('different strings likely produce different results', () => {
      expect(hashString('foo')).not.toBe(hashString('bar'))
    })
  })

  describe('moveTowards', () => {
    it('already at target returns target', () => {
      const pos = { x: 1, y: 2, z: 3 }
      expect(moveTowards(pos, pos, 1)).toEqual(pos)
    })

    it('maxDelta >= distance returns target', () => {
      const from = { x: 0, y: 0, z: 0 }
      const to = { x: 3, y: 4, z: 0 }
      expect(moveTowards(from, to, 10)).toEqual(to)
    })

    it('maxDelta = 0 returns from unchanged', () => {
      const from = { x: 0, y: 0, z: 0 }
      const to = { x: 3, y: 4, z: 0 }
      expect(moveTowards(from, to, 0)).toEqual(from)
    })

    it('moves exactly maxDelta distance towards target', () => {
      const from = { x: 0, y: 0, z: 0 }
      const to = { x: 10, y: 0, z: 0 }
      const result = moveTowards(from, to, 2)
      const dist = Math.sqrt(distanceSq(from, result))
      expect(dist).toBeCloseTo(2, 5)
    })

    it('direction is towards target', () => {
      const from = { x: 0, y: 0, z: 0 }
      const to = { x: 5, y: 0, z: 0 }
      const result = moveTowards(from, to, 1)
      expect(result.x).toBeGreaterThan(from.x)
      expect(result.x).toBeLessThan(to.x)
      expect(result.y).toBe(from.y)
      expect(result.z).toBe(from.z)
    })
  })

  describe('findNearestVillage', () => {
    it('empty array returns Option.none()', () => {
      expect(Option.isNone(findNearestVillage([], { x: 0, y: 64, z: 0 }))).toBe(true)
    })

    it('single village returns that village', () => {
      const village = makeVillage('village-1', 0, 64, 0)
      const result = findNearestVillage([village], { x: 5, y: 64, z: 5 })
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).villageId).toBe(village.villageId)
    })

    it('multiple villages returns the closest one', () => {
      const near = makeVillage('village-1', 10, 64, 0)
      const far = makeVillage('village-2', 500, 64, 0)
      const query = { x: 0, y: 64, z: 0 }
      const result = findNearestVillage([near, far], query)
      expect(Option.getOrThrow(result).villageId).toBe(near.villageId)
    })
  })

  describe('snapVillageCenter', () => {
    it('snaps to grid center for position at (48, 64, 48)', () => {
      const result = snapVillageCenter({ x: 48, y: 64, z: 48 })
      expect(result).toEqual({ x: 48, y: 64, z: 48 })
    })

    it('snaps correctly for positions in different grid cells', () => {
      // x=100 → floor(100/96)*96 + 48 = 96+48=144; z=0 → floor(0/96)*96+48=48
      const result = snapVillageCenter({ x: 100, y: 64, z: 0 })
      expect(result.x).toBe(144)
      expect(result.z).toBe(48)
    })

    it('y is at least 64', () => {
      const result = snapVillageCenter({ x: 0, y: 10, z: 0 })
      expect(result.y).toBe(64)
    })

    it('y preserves values above 64', () => {
      const result = snapVillageCenter({ x: 0, y: 80, z: 0 })
      expect(result.y).toBe(80)
    })
  })

  describe('nextActivityForVillager', () => {
    const villager = makeVillager('village-1:villager-farmer', 0, 64, 0)

    it('player within TRADE_DISTANCE returns Trade', () => {
      const playerPosition = { x: TRADE_DISTANCE - 1, y: 64, z: 0 }
      expect(nextActivityForVillager(villager, playerPosition, 0.5)).toBe(VillagerActivity.Trade)
    })

    it('timeOfDay < 0.22 returns Rest', () => {
      const farPlayer = { x: 1000, y: 64, z: 0 }
      expect(nextActivityForVillager(villager, farPlayer, 0.1)).toBe(VillagerActivity.Rest)
    })

    it('timeOfDay > 0.78 returns Rest', () => {
      const farPlayer = { x: 1000, y: 64, z: 0 }
      expect(nextActivityForVillager(villager, farPlayer, 0.9)).toBe(VillagerActivity.Rest)
    })

    it('timeOfDay in [0.28, 0.72] returns Work', () => {
      const farPlayer = { x: 1000, y: 64, z: 0 }
      expect(nextActivityForVillager(villager, farPlayer, 0.5)).toBe(VillagerActivity.Work)
      expect(nextActivityForVillager(villager, farPlayer, 0.28)).toBe(VillagerActivity.Work)
      expect(nextActivityForVillager(villager, farPlayer, 0.72)).toBe(VillagerActivity.Work)
    })

    it('timeOfDay in transition range returns Wander', () => {
      const farPlayer = { x: 1000, y: 64, z: 0 }
      // Between 0.22 and 0.28 → Wander
      expect(nextActivityForVillager(villager, farPlayer, 0.25)).toBe(VillagerActivity.Wander)
      // Between 0.72 and 0.78 → Wander
      expect(nextActivityForVillager(villager, farPlayer, 0.75)).toBe(VillagerActivity.Wander)
    })
  })

  describe('flattenVillagers', () => {
    it('empty villages returns empty array', () => {
      expect(flattenVillagers([])).toHaveLength(0)
    })

    it('two villages each with 3 villagers returns 6 total villagers', () => {
      const v1 = makeVillager('village-1:v1', 0, 64, 0)
      const v2 = makeVillager('village-1:v2', 1, 64, 0)
      const v3 = makeVillager('village-1:v3', 2, 64, 0)
      const v4 = makeVillager('village-2:v1', 3, 64, 0)
      const v5 = makeVillager('village-2:v2', 4, 64, 0)
      const v6 = makeVillager('village-2:v3', 5, 64, 0)

      const village1: Village = { ...makeVillage('village-1', 0, 64, 0), villagers: [v1, v2, v3] }
      const village2: Village = { ...makeVillage('village-2', 200, 64, 0), villagers: [v4, v5, v6] }

      expect(flattenVillagers([village1, village2])).toHaveLength(6)
    })
  })
})
