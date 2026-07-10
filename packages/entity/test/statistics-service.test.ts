import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { StatisticsService } from '../application/statistics-service'

const TestLayer = Layer.provide(StatisticsService.Default, Layer.empty)

describe('application/statistics-service', () => {
  it.effect('starts at all-zero statistics', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      const stats = yield* svc.getStatistics()
      expect(stats.blocksMinedTotal).toBe(0)
      expect(stats.mobsKilledTotal).toBe(0)
      expect(stats.itemsCraftedTotal).toBe(0)
      expect(stats.dimensionsVisited).toEqual([])
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('recordBlockMined accumulates total and per-type counts', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      yield* svc.recordBlockMined('WOOD')
      const after = yield* svc.recordBlockMined('WOOD')
      expect(after.blocksMinedTotal).toBe(2)
      expect(after.blocksMinedByType.WOOD).toBe(2)
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('recordMobKilled accumulates total and per-type counts', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      const after = yield* svc.recordMobKilled('Cow')
      expect(after.mobsKilledTotal).toBe(1)
      expect(after.mobsKilledByType.Cow).toBe(1)
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('recordItemCrafted accumulates total and per-type counts', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      const after = yield* svc.recordItemCrafted('WOODEN_PICKAXE')
      expect(after.itemsCraftedTotal).toBe(1)
      expect(after.itemsCraftedByType.WOODEN_PICKAXE).toBe(1)
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('recordDimensionVisited dedupes repeats', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      yield* svc.recordDimensionVisited('nether')
      const after = yield* svc.recordDimensionVisited('nether')
      expect(after.dimensionsVisited).toEqual(['nether'])
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('serialize/deserialize round-trips statistics', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      yield* svc.recordBlockMined('STONE')
      yield* svc.recordDimensionVisited('end')
      const saved = yield* svc.serialize()
      yield* svc.reset()
      expect((yield* svc.getStatistics()).blocksMinedTotal).toBe(0)
      yield* svc.deserialize(saved)
      const restored = yield* svc.getStatistics()
      expect(restored.blocksMinedTotal).toBe(1)
      expect(restored.dimensionsVisited).toEqual(['end'])
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('reset clears all counters', () =>
    Effect.gen(function* () {
      const svc = yield* StatisticsService
      yield* svc.recordBlockMined('WOOD')
      yield* svc.recordMobKilled('Cow')
      yield* svc.reset()
      const stats = yield* svc.getStatistics()
      expect(stats.blocksMinedTotal).toBe(0)
      expect(stats.mobsKilledTotal).toBe(0)
    }).pipe(Effect.provide(TestLayer)),
  )
})
