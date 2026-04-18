import { describe, it, expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { INITIAL_STATE, createVillage, ensureVillageInState } from './village-factory'
import { VILLAGE_NEAR_DISTANCE } from './village-simulation'

describe('village/village-factory', () => {
  describe('createVillage', () => {
    it('returns village with correct id pattern', () => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      expect(village.villageId).toBe('village-1')
    })

    it('returns village-3 id for villageNumber 3', () => {
      const village = createVillage(3, { x: 48, y: 64, z: 48 })
      expect(village.villageId).toBe('village-3')
    })

    it('has all required structure types: well, road, house (×3), farm', () => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      const types = HashSet.fromIterable(Arr.map(village.structures, (s) => s.type))
      expect(HashSet.has(types, 'well')).toBe(true)
      expect(HashSet.has(types, 'road')).toBe(true)
      expect(HashSet.has(types, 'house')).toBe(true)
      expect(HashSet.has(types, 'farm')).toBe(true)

      const houseCount = Arr.filter(village.structures, (s) => s.type === 'house').length
      expect(houseCount).toBe(3)
    })

    it('has exactly 3 villagers', () => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      expect(village.villagers).toHaveLength(3)
    })

    it('villager home/workplace structureIds reference existing structures', () => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      const structureIds = HashSet.fromIterable(Arr.map(village.structures, (s) => s.structureId))
      Arr.forEach(village.villagers, (villager) => {
        expect(HashSet.has(structureIds, villager.homeStructureId)).toBe(true)
        expect(HashSet.has(structureIds, villager.workplaceStructureId)).toBe(true)
      })
    })

    it('is deterministic: same number + center produces identical result', () => {
      const center = { x: 48, y: 64, z: 48 }
      const a = createVillage(2, center)
      const b = createVillage(2, center)
      expect(a.villageId).toBe(b.villageId)
      expect(a.structures).toEqual(b.structures)
      expect(a.villagers).toEqual(b.villagers)
    })
  })

  describe('ensureVillageInState', () => {
    it('empty state + position creates a new village', () => {
      const position = { x: 48, y: 64, z: 48 }
      const [nextState, village] = ensureVillageInState(INITIAL_STATE, position)
      expect(nextState.villages).toHaveLength(1)
      expect(nextState.nextVillageNumber).toBe(2)
      expect(village.villageId).toBe('village-1')
    })

    it('state with nearby village returns the existing village (no new one)', () => {
      const position = { x: 48, y: 64, z: 48 }
      const [stateWithVillage] = ensureVillageInState(INITIAL_STATE, position)

      const nearbyPosition = { x: 50, y: 64, z: 50 }
      const [nextState, village] = ensureVillageInState(stateWithVillage, nearbyPosition)

      expect(nextState.villages).toHaveLength(1)
      expect(village.villageId).toBe('village-1')
    })

    it('state with a far-away village creates a second village', () => {
      const firstPosition = { x: 48, y: 64, z: 48 }
      const [stateWithVillage] = ensureVillageInState(INITIAL_STATE, firstPosition)

      // Place player far beyond VILLAGE_NEAR_DISTANCE
      const farPosition = { x: 48 + VILLAGE_NEAR_DISTANCE * 3, y: 64, z: 48 }
      const [nextState, village] = ensureVillageInState(stateWithVillage, farPosition)

      expect(nextState.villages).toHaveLength(2)
      expect(village.villageId).toBe('village-2')
    })
  })
})
