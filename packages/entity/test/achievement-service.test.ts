import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { AchievementService } from '../application/achievement-service'
import { AchievementId } from '../domain/achievement/achievement'
import { INITIAL_STATISTICS, recordBlockMined, recordItemCrafted } from '../domain/statistics/statistics'

const TestLayer = Layer.provide(AchievementService.Default, Layer.empty)

describe('application/achievement-service', () => {
  it.effect('starts with nothing unlocked', () =>
    Effect.gen(function* () {
      const svc = yield* AchievementService
      expect(yield* svc.getUnlocked()).toEqual([])
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('checkUnlocks reports newly-satisfied achievements and persists them', () =>
    Effect.gen(function* () {
      const svc = yield* AchievementService
      const stats = recordBlockMined(INITIAL_STATISTICS, 'WOOD')
      const newlyUnlocked = yield* svc.checkUnlocks(stats)
      expect(newlyUnlocked.map((a) => a.id)).toContain(AchievementId.make('getting-wood'))
      expect(yield* svc.getUnlocked()).toContain(AchievementId.make('getting-wood'))
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('checkUnlocks does not re-report an already-unlocked achievement', () =>
    Effect.gen(function* () {
      const svc = yield* AchievementService
      const stats = recordBlockMined(INITIAL_STATISTICS, 'WOOD')
      yield* svc.checkUnlocks(stats)
      const second = yield* svc.checkUnlocks(stats)
      expect(second).toEqual([])
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('a gated achievement unlocks once its prerequisite is already satisfied', () =>
    Effect.gen(function* () {
      const svc = yield* AchievementService
      yield* svc.checkUnlocks(recordBlockMined(INITIAL_STATISTICS, 'WOOD'))
      const stats = recordItemCrafted(recordBlockMined(INITIAL_STATISTICS, 'WOOD'), 'WOODEN_PICKAXE')
      const newlyUnlocked = yield* svc.checkUnlocks(stats)
      expect(newlyUnlocked.map((a) => a.id)).toContain(AchievementId.make('time-to-mine'))
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('serialize/deserialize round-trips the unlocked set', () =>
    Effect.gen(function* () {
      const svc = yield* AchievementService
      yield* svc.checkUnlocks(recordBlockMined(INITIAL_STATISTICS, 'WOOD'))
      const saved = yield* svc.serialize()
      yield* svc.reset()
      expect(yield* svc.getUnlocked()).toEqual([])
      yield* svc.deserialize(saved)
      expect(yield* svc.getUnlocked()).toContain(AchievementId.make('getting-wood'))
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect('reset clears the unlocked set', () =>
    Effect.gen(function* () {
      const svc = yield* AchievementService
      yield* svc.checkUnlocks(recordBlockMined(INITIAL_STATISTICS, 'WOOD'))
      yield* svc.reset()
      expect(yield* svc.getUnlocked()).toEqual([])
    }).pipe(Effect.provide(TestLayer)),
  )
})
