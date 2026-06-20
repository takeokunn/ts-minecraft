import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet } from 'effect'
import { VILLAGE_NEAR_DISTANCE } from '@ts-minecraft/entity/domain/village/village-simulation-constants'
import { createVillage } from '../../domain/village/village-creation'
import { ensureVillageInState } from '../../domain/village/village-creation-resolution'
import { INITIAL_VILLAGE_STATE } from '../../domain/village/village-state'

describe('village/village-creation-resolution', () => {
  it.effect('createVillage returns village with correct id pattern', () =>
    Effect.sync(() => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      expect(village.villageId).toBe('village-1')
    })
  )

  it.effect('createVillage has all required structure types: well, road, house (×3), farm', () =>
    Effect.sync(() => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      const types = HashSet.fromIterable(Arr.map(village.structures, (s) => s.type))
      expect(HashSet.has(types, 'well')).toBe(true)
      expect(HashSet.has(types, 'road')).toBe(true)
      expect(HashSet.has(types, 'house')).toBe(true)
      expect(HashSet.has(types, 'farm')).toBe(true)

      const houseCount = Arr.filter(village.structures, (s) => s.type === 'house').length
      expect(houseCount).toBe(3)
    })
  )

  it.effect('createVillage has exactly 3 villagers', () =>
    Effect.sync(() => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      expect(village.villagers).toHaveLength(3)
    })
  )

  it.effect('createVillage villager home/workplace structureIds reference existing structures', () =>
    Effect.sync(() => {
      const village = createVillage(1, { x: 48, y: 64, z: 48 })
      const structureIds = HashSet.fromIterable(Arr.map(village.structures, (s) => s.structureId))
      Arr.forEach(village.villagers, (villager) => {
        expect(HashSet.has(structureIds, villager.homeStructureId)).toBe(true)
        expect(HashSet.has(structureIds, villager.workplaceStructureId)).toBe(true)
      })
    })
  )

  it.effect('createVillage is deterministic for repeated calls', () =>
    Effect.sync(() => {
      const a = createVillage(1, { x: 48, y: 64, z: 48 })
      const b = createVillage(1, { x: 48, y: 64, z: 48 })
      expect(a.villageId).toBe(b.villageId)
      expect(a.structures).toEqual(b.structures)
      expect(a.villagers).toEqual(b.villagers)
    })
  )

  describe('ensureVillageInState', () => {
    it.effect('empty state + position creates a new village', () =>
      Effect.sync(() => {
        const [state, village] = ensureVillageInState(INITIAL_VILLAGE_STATE, { x: 48, y: 64, z: 48 })
        expect(state.villages).toHaveLength(1)
        expect(village.villageId).toBe('village-1')
      })
    )

    it.effect('state with nearby village returns the existing village (no new one)', () =>
      Effect.sync(() => {
        const existingVillage = createVillage(1, { x: 48, y: 64, z: 48 })
        const state = {
          ...INITIAL_VILLAGE_STATE,
          villages: [existingVillage],
          nextVillageNumber: 2,
        }

        const [nextState, nearbyVillage] = ensureVillageInState(state, { x: 50, y: 64, z: 50 })

        expect(nextState.villages).toHaveLength(1)
        expect(nearbyVillage.villageId).toBe('village-1')
      })
    )

    it.effect('state with a far-away village creates a second village', () =>
      Effect.sync(() => {
        const existingVillage = createVillage(1, { x: 48, y: 64, z: 48 })
        const state = {
          ...INITIAL_VILLAGE_STATE,
          villages: [existingVillage],
          nextVillageNumber: 2,
        }
        const [nextState, farVillage] = ensureVillageInState(state, { x: 48 + VILLAGE_NEAR_DISTANCE * 3, y: 64, z: 48 })

        expect(nextState.villages).toHaveLength(2)
        expect(farVillage.villageId).toBe('village-2')
      })
    )
  })
})
