import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet, Option } from 'effect'
import type { DeltaTimeSecs } from '@/shared/kernel'
import { VillagerActivity } from '@/village/village-model'
import { VillageService, VillageServiceLive } from '@/village/village-service'

const ONE_SECOND = 1 as DeltaTimeSecs

describe('village/village-service', () => {
  it.effect('creates a deterministic village with required structures and villager links', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService

      const firstVillage = yield* villageService.ensureVillageNear({ x: 10, y: 64, z: -20 })
      const secondVillage = yield* villageService.ensureVillageNear({ x: 12, y: 64, z: -18 })
      const villages = yield* villageService.getVillages()

      expect(villages).toHaveLength(1)
      expect(firstVillage.villageId).toBe(secondVillage.villageId)

      const structureTypes = HashSet.fromIterable(Arr.map(firstVillage.structures, (structure) => structure.type))
      expect(HashSet.has(structureTypes, 'house')).toBe(true)
      expect(HashSet.has(structureTypes, 'road')).toBe(true)
      expect(HashSet.has(structureTypes, 'well')).toBe(true)
      expect(HashSet.has(structureTypes, 'farm')).toBe(true)

      const structureIds = HashSet.fromIterable(Arr.map(firstVillage.structures, (structure) => structure.structureId))
      expect(
        firstVillage.villagers.every(
          (villager) =>
            HashSet.has(structureIds, villager.homeStructureId) &&
            HashSet.has(structureIds, villager.workplaceStructureId),
        ),
      ).toBe(true)
    }).pipe(Effect.provide(VillageServiceLive))
  )

  it.effect('updates villager activities based on time and player proximity', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const playerPosition = { x: 0, y: 64, z: 0 }

      yield* villageService.ensureVillageNear(playerPosition)

      yield* villageService.update(playerPosition, 0.5, ONE_SECOND)
      const nearVillagers = yield* villageService.getVillagers()

      const firstVillagerOpt = Option.fromNullable(nearVillagers[0])
      if (Option.isNone(firstVillagerOpt)) {
        expect.fail('Expected at least one villager')
        return
      }
      const firstVillager = Option.getOrThrow(firstVillagerOpt)

      yield* villageService.update(firstVillager.position, 0.5, ONE_SECOND)
      const tradingSnapshot = yield* villageService.getVillagers()

      yield* villageService.update(playerPosition, 0.9, ONE_SECOND)
      const nightSnapshot = yield* villageService.getVillagers()

      expect(tradingSnapshot.some((villager) => villager.activity === VillagerActivity.Trade)).toBe(true)
      expect(nightSnapshot.every((villager) => villager.activity === VillagerActivity.Rest)).toBe(true)
    }).pipe(Effect.provide(VillageServiceLive))
  )
})
