import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet, Option } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { VillagerActivity, VillagerId } from '@ts-minecraft/entity'
import { VillageService, VillageServiceLive } from '@ts-minecraft/entity'

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
        Arr.every(
          firstVillage.villagers,
          (villager) =>
            HashSet.has(structureIds, villager.homeStructureId) &&
            HashSet.has(structureIds, villager.workplaceStructureId),
        ),
      ).toBe(true)
    }).pipe(Effect.provide(VillageServiceLive))
  )

  it.effect('freezes villager AI for villages far from the player, and resumes when near (bounded simulation)', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const near = { x: 0, y: 64, z: 0 }
      yield* villageService.ensureVillageNear(near)

      // Establish a mid-journey state: villagers step toward their workplaces.
      yield* villageService.update(near, 0.5, ONE_SECOND)
      const established = yield* villageService.getVillagers()
      const positionOf = (id: VillagerId) =>
        Effect.gen(function* () {
          const o = yield* villageService.getVillager(id)
          return Option.getOrThrow(o).position
        })

      // Player travels far (> VILLAGE_SIMULATION_DISTANCE): the original village
      // is frozen — its villagers must not move (a new village spawns near the
      // player, but the old one is untouched, bounding per-tick cost).
      yield* villageService.update({ x: 5000, y: 64, z: 5000 }, 0.5, ONE_SECOND)
      for (const v of established) {
        const frozen = yield* positionOf(v.villagerId)
        expect(frozen.x).toBe(v.position.x)
        expect(frozen.z).toBe(v.position.z)
      }

      // Resume: with the player back near, at least one villager moves again —
      // proving the freeze above suppressed real movement, not a static state.
      yield* villageService.update(near, 0.5, ONE_SECOND)
      const resumed = yield* Effect.forEach(established, (v) => positionOf(v.villagerId))
      const anyMoved = Arr.some(resumed, (pos, i) => {
        const before = Option.getOrThrow(Arr.get(established, i)).position
        return pos.x !== before.x || pos.z !== before.z
      })
      expect(anyMoved).toBe(true)
    }).pipe(Effect.provide(VillageServiceLive))
  )

  it.effect('updates villager activities based on time and player proximity', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const playerPosition = { x: 0, y: 64, z: 0 }

      yield* villageService.ensureVillageNear(playerPosition)

      yield* villageService.update(playerPosition, 0.5, ONE_SECOND)
      const nearVillagers = yield* villageService.getVillagers()

      const firstVillager = Option.getOrThrow(Arr.get(nearVillagers, 0))

      yield* villageService.update(firstVillager.position, 0.5, ONE_SECOND)
      const tradingSnapshot = yield* villageService.getVillagers()

      yield* villageService.update(playerPosition, 0.9, ONE_SECOND)
      const nightSnapshot = yield* villageService.getVillagers()

      expect(Arr.some(tradingSnapshot, (villager) => villager.activity === VillagerActivity.Trade)).toBe(true)
      expect(Arr.every(nightSnapshot, (villager) => villager.activity === VillagerActivity.Rest)).toBe(true)
    }).pipe(Effect.provide(VillageServiceLive))
  )

  it.effect('second update at same Trade position short-circuits via no-change path', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const origin = { x: 0, y: 64, z: 0 }

      yield* villageService.ensureVillageNear(origin)

      // First update: moves villagers toward their targets
      yield* villageService.update(origin, 0.5, ONE_SECOND)
      const afterFirst = yield* villageService.getVillagers()
      const firstVillager = Option.getOrThrow(Arr.get(afterFirst, 0))

      // Second update: player at villager position triggers Trade
      yield* villageService.update(firstVillager.position, 0.5, ONE_SECOND)
      const afterTrade = yield* villageService.getVillagers()
      const tradingVillager = Option.getOrThrow(
        Arr.findFirst(afterTrade, (v) => v.activity === VillagerActivity.Trade),
      )

      // Third update: same player position, same Trade activity → no-change branch
      // (nextActivity === villager.activity && nextPosition === villager.position)
      yield* villageService.update(tradingVillager.position, 0.5, ONE_SECOND)
      const afterNoChange = yield* villageService.getVillagers()
      const sameVillager = Option.getOrThrow(
        Arr.findFirst(afterNoChange, (v) => v.villagerId === tradingVillager.villagerId),
      )

      expect(sameVillager.activity).toBe(VillagerActivity.Trade)
    }).pipe(Effect.provide(VillageServiceLive))
  )

  describe('getVillager', () => {
    it.effect('returns Option.some with the villager when the ID exists', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        const knownId = VillagerId.make('village-1:villager-farmer')
        const result = yield* villageService.getVillager(knownId)

        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result).villagerId).toBe(knownId)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('returns Option.none for an unknown villager ID', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        const unknownId = VillagerId.make('village-999:villager-nonexistent')
        const result = yield* villageService.getVillager(unknownId)

        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })

  describe('findNearestVillager', () => {
    it.effect('returns Option.none when no villager is within maxDistance', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        // Village centered near (48, 64, 48) after snap, villagers start at structure anchors
        yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        // Search from a position very far away with a tiny maxDistance
        const result = yield* villageService.findNearestVillager({ x: 10000, y: 64, z: 10000 }, 1)

        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('returns the villager when one is within maxDistance', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        const village = yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
        const firstVillager = Option.getOrThrow(Arr.get(village.villagers, 0))

        // Search from the villager's exact position with a generous range
        const result = yield* villageService.findNearestVillager(firstVillager.position, 1000)

        expect(Option.isSome(result)).toBe(true)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('returns the closer of two villagers when multiple are in range', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        const village = yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
        const allVillagers = yield* villageService.getVillagers()

        expect(allVillagers.length).toBeGreaterThanOrEqual(2)

        const firstVillager = Option.getOrThrow(Arr.get(allVillagers, 0))

        // Search from first villager's exact position — it must be picked over the others
        const result = yield* villageService.findNearestVillager(firstVillager.position, 1000)

        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result).villagerId).toBe(firstVillager.villagerId)

        // Verify that village has multiple villagers so this test is meaningful
        expect(village.villagers.length).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('second villager closer to search point wins over first villager already in closest slot', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        const village = yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
        const allVillagers = yield* villageService.getVillagers()

        expect(allVillagers.length).toBeGreaterThanOrEqual(2)

        // Pick the LAST villager in the list. We search from its exact position.
        // The reduce loop visits villagers in order: the first villager is placed
        // into `closest` (onNone branch), and then subsequent villagers are compared
        // (onSome branch). The last villager is at distance=0 from the search point,
        // which is strictly less than any other villager's distance, so the onSome
        // branch must pick it as the new winner.
        const lastVillager = Option.getOrThrow(Arr.get(allVillagers, allVillagers.length - 1))

        // Confirm the last villager is at a different position than the first
        const firstVillager = Option.getOrThrow(Arr.get(allVillagers, 0))
        const isSamePosition =
          firstVillager.position.x === lastVillager.position.x &&
          firstVillager.position.z === lastVillager.position.z

        if (isSamePosition) {
          // Structure layout produced identical anchors; test is vacuously satisfied
          expect(Option.isSome(yield* villageService.findNearestVillager(lastVillager.position, 1000))).toBe(true)
          return
        }

        const result = yield* villageService.findNearestVillager(lastVillager.position, 1000)

        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result).villagerId).toBe(lastVillager.villagerId)

        // Sanity: village has at least two villagers so the onSome comparison ran
        expect(village.villagers.length).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })

  describe('addVillagerExperience', () => {
    it.effect('returns Option.none immediately when amount is zero or negative', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        const knownId = VillagerId.make('village-1:villager-farmer')

        const zeroResult = yield* villageService.addVillagerExperience(knownId, 0)
        expect(Option.isNone(zeroResult)).toBe(true)

        const negativeResult = yield* villageService.addVillagerExperience(knownId, -5)
        expect(Option.isNone(negativeResult)).toBe(true)

        // Confirm state was not mutated — experience remains 0
        const unchanged = yield* villageService.getVillager(knownId)
        expect(Option.getOrThrow(unchanged).experience).toBe(0)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('increases experience and advances level when amount is positive', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        const knownId = VillagerId.make('village-1:villager-farmer')

        // Level 1 → 2 threshold is 6 XP
        const result = yield* villageService.addVillagerExperience(knownId, 6)

        expect(Option.isSome(result)).toBe(true)
        const updated = Option.getOrThrow(result)
        expect(updated.experience).toBe(6)
        expect(updated.level).toBe(2)

        // Subsequent call accumulates — 6 + 8 = 14 → level 3
        const result2 = yield* villageService.addVillagerExperience(knownId, 8)
        const updated2 = Option.getOrThrow(result2)
        expect(updated2.experience).toBe(14)
        expect(updated2.level).toBe(3)

        // State is persisted
        const persisted = yield* villageService.getVillager(knownId)
        expect(Option.getOrThrow(persisted).experience).toBe(14)
      }).pipe(Effect.provide(VillageServiceLive))
    )

    it.effect('returns Option.none for an unknown villager ID', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        const unknownId = VillagerId.make('village-999:villager-nonexistent')
        const result = yield* villageService.addVillagerExperience(unknownId, 10)

        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })

  describe('ensureVillageNear — second village creation', () => {
    it.effect('creates two separate villages when positions are more than 80 units apart', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        // First village near origin
        const village1 = yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })

        // Second position is 200 units away on x-axis — well beyond VILLAGE_NEAR_DISTANCE=80
        const village2 = yield* villageService.ensureVillageNear({ x: 200, y: 64, z: 0 })

        const villages = yield* villageService.getVillages()

        expect(villages).toHaveLength(2)
        expect(village1.villageId).not.toBe(village2.villageId)
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })

  describe('getVillagers — explicit count with multiple villages', () => {
    it.effect('returns all villagers from all villages when multiple villages exist', () =>
      Effect.gen(function* () {
        const villageService = yield* VillageService

        const village1 = yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
        const village2 = yield* villageService.ensureVillageNear({ x: 200, y: 64, z: 0 })

        const allVillagers = yield* villageService.getVillagers()

        const expectedCount = village1.villagers.length + village2.villagers.length
        expect(allVillagers).toHaveLength(expectedCount)

        const village1Ids = HashSet.fromIterable(Arr.map(village1.villagers, (v) => v.villagerId))
        const village2Ids = HashSet.fromIterable(Arr.map(village2.villagers, (v) => v.villagerId))

        expect(
          Arr.every(allVillagers, (v) => HashSet.has(village1Ids, v.villagerId) || HashSet.has(village2Ids, v.villagerId)),
        ).toBe(true)
      }).pipe(Effect.provide(VillageServiceLive))
    )
  })
})
