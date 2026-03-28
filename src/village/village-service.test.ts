import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import type { DeltaTimeSecs } from '@/shared/kernel'
import { VillagerActivity } from '@/village/village-model'
import { VillageService, VillageServiceLive } from '@/village/village-service'

const ONE_SECOND = 1 as DeltaTimeSecs

describe('village/village-service', () => {
  it('creates a deterministic village with required structures and villager links', async () => {
    const program = Effect.gen(function* () {
      const villageService = yield* VillageService

      const firstVillage = yield* villageService.ensureVillageNear({ x: 10, y: 64, z: -20 })
      const secondVillage = yield* villageService.ensureVillageNear({ x: 12, y: 64, z: -18 })
      const villages = yield* villageService.getVillages()

      return { firstVillage, secondVillage, villages }
    }).pipe(Effect.provide(VillageServiceLive))

    const { firstVillage, secondVillage, villages } = await Effect.runPromise(program)

    expect(villages).toHaveLength(1)
    expect(firstVillage.villageId).toBe(secondVillage.villageId)

    const structureTypes = new Set(firstVillage.structures.map((structure) => structure.type))
    expect(structureTypes.has('house')).toBe(true)
    expect(structureTypes.has('road')).toBe(true)
    expect(structureTypes.has('well')).toBe(true)
    expect(structureTypes.has('farm')).toBe(true)

    const structureIds = new Set(firstVillage.structures.map((structure) => structure.structureId))
    expect(
      firstVillage.villagers.every(
        (villager) =>
          structureIds.has(villager.homeStructureId) &&
          structureIds.has(villager.workplaceStructureId),
      ),
    ).toBe(true)
  })

  it('updates villager activities based on time and player proximity', async () => {
    const program = Effect.gen(function* () {
      const villageService = yield* VillageService
      const playerPosition = { x: 0, y: 64, z: 0 }

      yield* villageService.ensureVillageNear(playerPosition)

      yield* villageService.update(playerPosition, 0.5, ONE_SECOND)
      const nearVillagers = yield* villageService.getVillagers()

      const firstVillager = nearVillagers[0]
      if (!firstVillager) {
        return { hasTradeVillager: false, allRestingAtNight: false }
      }

      yield* villageService.update(firstVillager.position, 0.5, ONE_SECOND)
      const tradingSnapshot = yield* villageService.getVillagers()

      yield* villageService.update(playerPosition, 0.9, ONE_SECOND)
      const nightSnapshot = yield* villageService.getVillagers()

      return {
        hasTradeVillager: tradingSnapshot.some((villager) => villager.activity === VillagerActivity.Trade),
        allRestingAtNight: nightSnapshot.every((villager) => villager.activity === VillagerActivity.Rest),
      }
    }).pipe(Effect.provide(VillageServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.hasTradeVillager).toBe(true)
    expect(result.allRestingAtNight).toBe(true)
  })
})
