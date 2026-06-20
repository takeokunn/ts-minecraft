import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { VillageId, VillagerActivity, VillagerId, VillageStructureId } from '@ts-minecraft/entity/domain/village/village-model'
import { snapVillageCenter } from '@ts-minecraft/entity/domain/village/village-placement-geometry';
import { distanceSq, moveTowards } from '@ts-minecraft/entity/domain/village/village-position';
import { findNearestVillage, findStructureAnchor } from '@ts-minecraft/entity/domain/village/village-search';
import { TRADE_DISTANCE } from '@ts-minecraft/entity/domain/village/village-simulation-constants';
import { advanceVillageState } from '@ts-minecraft/entity/domain/village/village-simulation-update';
import { getTargetPosition, nextActivityForVillager } from '@ts-minecraft/entity/domain/village/village-simulation-activity';
import { WANDER_RADIUS } from '@ts-minecraft/entity/domain/village/village-simulation.config';
import { hashString } from '@ts-minecraft/entity/domain/village/village-hash';
import { flattenVillagers, type VillageState } from '@ts-minecraft/entity/domain/village/village-state';
import type { Villager, Village, VillageStructure } from '@ts-minecraft/entity/domain/village/village-model'
import {
  makeTestVillager,
  makeTestVillage,
  makeTestVillageStructure,
} from '../village/test-utils'
import { expectSome } from '../test-utils'

const makeVillage = (id: string, cx: number, cy: number, cz: number) =>
  makeTestVillage({
    villageId: VillageId.make(id),
    center: { x: cx, y: cy, z: cz },
    structures: [],
    villagers: [],
  })

const makeVillager = (id: string, px: number, py: number, pz: number): Villager =>
  makeTestVillager({
    villagerId: VillagerId.make(id),
    villageId: VillageId.make('village-1'),
    homeStructureId: VillageStructureId.make('village-1:house-a'),
    workplaceStructureId: VillageStructureId.make('village-1:farm'),
    position: { x: px, y: py, z: pz },
  })

const makeStructure = (id: string, ax: number, ay: number, az: number): VillageStructure =>
  makeTestVillageStructure({
    structureId: VillageStructureId.make(id),
    anchor: { x: ax, y: ay, z: az },
    size: { x: 1, y: 1, z: 1 },
  })

const ORIGIN_QUERY = { x: 0, y: 64, z: 0 }
const FAR_PLAYER_POSITION = { x: 1000, y: 64, z: 0 }

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
      expect(Option.isNone(findNearestVillage([], ORIGIN_QUERY))).toBe(true)
    })

    it('single village returns that village', () => {
      const village = makeVillage('village-1', 0, 64, 0)
      const result = findNearestVillage([village], { x: 5, y: 64, z: 5 })
      const nearestVillage = expectSome(result)
      expect(nearestVillage.villageId).toBe(village.villageId)
    })

    it('multiple villages returns the closest one', () => {
      const near = makeVillage('village-1', 10, 64, 0)
      const far = makeVillage('village-2', 500, 64, 0)
      const result = findNearestVillage([near, far], ORIGIN_QUERY)
      const nearestVillage = expectSome(result)
      expect(nearestVillage.villageId).toBe(near.villageId)
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

    const expectActivity = (timeOfDay: number, expectedActivity: VillagerActivity): void => {
      expect(nextActivityForVillager(villager, FAR_PLAYER_POSITION, timeOfDay)).toBe(expectedActivity)
    }

    it('player within TRADE_DISTANCE returns Trade', () => {
      const playerPosition = { x: TRADE_DISTANCE - 1, y: 64, z: 0 }
      expect(nextActivityForVillager(villager, playerPosition, 0.5)).toBe(VillagerActivity.Trade)
    })

    it('timeOfDay < 0.22 returns Rest', () => {
      expectActivity(0.1, VillagerActivity.Rest)
    })

    it('timeOfDay > 0.78 returns Rest', () => {
      expectActivity(0.9, VillagerActivity.Rest)
    })

    it('timeOfDay in [0.28, 0.72] returns Work', () => {
      expectActivity(0.5, VillagerActivity.Work)
      expectActivity(0.28, VillagerActivity.Work)
      expectActivity(0.72, VillagerActivity.Work)
    })

    it('timeOfDay in transition range returns Wander', () => {
      // Between 0.22 and 0.28 → Wander
      expectActivity(0.25, VillagerActivity.Wander)
      // Between 0.72 and 0.78 → Wander
      expectActivity(0.75, VillagerActivity.Wander)
    })
  })

  describe('advanceVillageState', () => {
    it('increments updateTick and leaves distant villages untouched', () => {
      const nearVillage = makeTestVillage({
        villageId: VillageId.make('village-near'),
        center: { x: 0, y: 64, z: 0 },
      })
      const farVillage = makeTestVillage({
        villageId: VillageId.make('village-far'),
        center: { x: 1000, y: 64, z: 0 },
      })
      const state: VillageState = {
        villages: [nearVillage, farVillage],
        updateTick: 7,
      }

      const next = advanceVillageState(state, ORIGIN_QUERY, 0.5, 1 / 60)

      expect(next.updateTick).toBe(8)
      expect(next.villages[1]).toBe(farVillage)
      expect(next.villages[0]).not.toBe(nearVillage)
    })
  })

  describe('findNearestVillage (onSome branch coverage)', () => {
    it('keeps the closer village when a farther one is encountered later', () => {
      // onSome branch: new village is NOT closer → return existing closest
      const near = makeVillage('village-near', 10, 64, 0)
      const far = makeVillage('village-far', 500, 64, 0)
      const result = findNearestVillage([near, far], ORIGIN_QUERY)
      const nearestVillage = expectSome(result)
      expect(nearestVillage.villageId).toBe(near.villageId)
    })

    it('replaces closest when a nearer village is encountered later', () => {
      // onSome branch: new village IS closer → return Option.some(village)
      const far = makeVillage('village-far', 500, 64, 0)
      const near = makeVillage('village-near', 10, 64, 0)
      // far is processed first (becomes initial closest), then near replaces it
      const result = findNearestVillage([far, near], ORIGIN_QUERY)
      const nearestVillage = expectSome(result)
      expect(nearestVillage.villageId).toBe(near.villageId)
    })
  })

  describe('findStructureAnchor', () => {
    it('returns anchor of matching structure', () => {
      const structures = [
        makeStructure('village-1:house-a', 10, 64, 20),
        makeStructure('village-1:farm', 30, 64, 40),
      ]
      const result = findStructureAnchor(
        structures,
        VillageStructureId.make('village-1:farm'),
      )
      expect(expectSome(result)).toEqual({ x: 30, y: 64, z: 40 })
    })

    it('returns none when structureId is not found', () => {
      const structures = [makeStructure('village-1:house-a', 10, 64, 20)]
      const result = findStructureAnchor(
        structures,
        VillageStructureId.make('village-1:nonexistent'),
      )
      expect(Option.isNone(result)).toBe(true)
    })

    it('returns none when structures array is empty', () => {
      const result = findStructureAnchor(
        [],
        VillageStructureId.make('village-1:house-a'),
      )
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('getTargetPosition', () => {
    const workplaceId = VillageStructureId.make('village-1:farm')
    const homeId = VillageStructureId.make('village-1:house-a')

    const village: Village = {
      ...makeVillage('village-1', 0, 64, 0),
      structures: [
        makeStructure('village-1:farm', 50, 64, 50),
        makeStructure('village-1:house-a', 10, 64, 10),
      ],
    }
    const villager: Villager = {
      ...makeVillager('village-1:villager-farmer', 0, 64, 0),
      workplaceStructureId: workplaceId,
      homeStructureId: homeId,
    }

    it('Work activity returns workplace structure anchor', () => {
      const result = getTargetPosition(village, villager, VillagerActivity.Work, 0)
      expect(expectSome(result)).toEqual({ x: 50, y: 64, z: 50 })
    })

    it('Rest activity returns home structure anchor', () => {
      const result = getTargetPosition(village, villager, VillagerActivity.Rest, 0)
      expect(expectSome(result)).toEqual({ x: 10, y: 64, z: 10 })
    })

    it('Wander activity returns orbiting position within WANDER_RADIUS of home', () => {
      const result = expectSome(getTargetPosition(village, villager, VillagerActivity.Wander, 0))
      const home = { x: 10, y: 64, z: 10 }
      expect(result.y).toBe(home.y)
      const dist = Math.sqrt(
        (result.x - home.x) ** 2 + (result.z - home.z) ** 2,
      )
      expect(dist).toBeCloseTo(WANDER_RADIUS, 5)
    })

    it('Trade activity (fallthrough) returns villager current position', () => {
      const result = getTargetPosition(village, villager, VillagerActivity.Trade, 0)
      expect(expectSome(result)).toEqual(villager.position)
    })

    it('Idle activity (fallthrough) returns villager current position', () => {
      const result = getTargetPosition(village, villager, VillagerActivity.Idle, 0)
      expect(expectSome(result)).toEqual(villager.position)
    })

    it('Work activity returns none when workplace structure is missing', () => {
      const result = getTargetPosition(
        { ...village, structures: [makeStructure('village-1:house-a', 10, 64, 10)] },
        villager,
        VillagerActivity.Work,
        0,
      )
      expect(Option.isNone(result)).toBe(true)
    })

    it('Wander activity returns none when home structure is missing', () => {
      const result = getTargetPosition(
        { ...village, structures: [makeStructure('village-1:farm', 50, 64, 50)] },
        villager,
        VillagerActivity.Wander,
        0,
      )
      expect(Option.isNone(result)).toBe(true)
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
