import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet } from 'effect'
import { VILLAGE_NEAR_DISTANCE } from '@ts-minecraft/entity'
import { VillageService, VillageServiceLive } from '@ts-minecraft/entity'

describe('village/village-factory', () => {
  describe('createVillage (via VillageService.ensureVillageNear)', () => {
    it.effect('returns village with correct id pattern', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        const village = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        expect(village.villageId).toBe('village-1')
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('has all required structure types: well, road, house (×3), farm', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        const village = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        const types = HashSet.fromIterable(Arr.map(village.structures, (s) => s.type))
        expect(HashSet.has(types, 'well')).toBe(true)
        expect(HashSet.has(types, 'road')).toBe(true)
        expect(HashSet.has(types, 'house')).toBe(true)
        expect(HashSet.has(types, 'farm')).toBe(true)

        const houseCount = Arr.filter(village.structures, (s) => s.type === 'house').length
        expect(houseCount).toBe(3)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('has exactly 3 villagers', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        const village = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        expect(village.villagers).toHaveLength(3)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('villager home/workplace structureIds reference existing structures', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        const village = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        const structureIds = HashSet.fromIterable(Arr.map(village.structures, (s) => s.structureId))
        Arr.forEach(village.villagers, (villager) => {
          expect(HashSet.has(structureIds, villager.homeStructureId)).toBe(true)
          expect(HashSet.has(structureIds, villager.workplaceStructureId)).toBe(true)
        })
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('is deterministic: same position produces the same village on repeated calls', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        const a = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        const b = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        expect(a.villageId).toBe(b.villageId)
        expect(a.structures).toEqual(b.structures)
        expect(a.villagers).toEqual(b.villagers)
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })

  describe('ensureVillageInState (via VillageService)', () => {
    it.effect('empty service + position creates a new village', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        const village = yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })
        const villages = yield* villageService.getVillages()
        expect(villages).toHaveLength(1)
        expect(village.villageId).toBe('village-1')
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('state with nearby village returns the existing village (no new one)', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })

        const nearbyVillage = yield* villageService.ensureVillageNear({ x: 50, y: 64, z: 50 })
        const villages = yield* villageService.getVillages()

        expect(villages).toHaveLength(1)
        expect(nearbyVillage.villageId).toBe('village-1')
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('state with a far-away village creates a second village', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService
        yield* villageService.ensureVillageNear({ x: 48, y: 64, z: 48 })

        // Place player far beyond VILLAGE_NEAR_DISTANCE
        const farVillage = yield* villageService.ensureVillageNear({ x: 48 + VILLAGE_NEAR_DISTANCE * 3, y: 64, z: 48 })
        const villages = yield* villageService.getVillages()

        expect(villages).toHaveLength(2)
        expect(farVillage.villageId).toBe('village-2')
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })
})
