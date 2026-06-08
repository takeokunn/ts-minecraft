import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { XPService, XPServiceLive } from '../application/xp-service'

const TestLayer = Layer.provide(XPServiceLive, Layer.empty)

describe('application/xp-service', () => {
  describe('getXP', () => {
    it.effect('returns initial XP state at level 0', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        const xp = yield* svc.getXP()
        expect(xp.totalXP).toBe(0)
        expect(xp.level).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('addXP', () => {
    it.effect('accumulates XP and returns updated state', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        const after = yield* svc.addXP(7)
        expect(after.totalXP).toBe(7)
        expect(after.level).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('negative XP is clamped to 0', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        const after = yield* svc.addXP(-100)
        expect(after.totalXP).toBe(0)
        expect(after.level).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('multiple addXP calls accumulate correctly', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        yield* svc.addXP(5)
        const after = yield* svc.addXP(5)
        expect(after.totalXP).toBe(10)
        expect(after.level).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('setTotalXP', () => {
    it.effect('sets XP to the specified total', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        yield* svc.setTotalXP(100)
        const xp = yield* svc.getXP()
        expect(xp.totalXP).toBe(100)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('clamps negative values to 0', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        yield* svc.setTotalXP(-50)
        const xp = yield* svc.getXP()
        expect(xp.totalXP).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('spendLevels', () => {
    it.effect('reduces level and resets XP within that level', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        // Add enough XP to reach level 5 (requires 55 total XP)
        yield* svc.setTotalXP(55)
        const after = yield* svc.spendLevels(3)
        // After spending 3 levels, should be at level 2 (5 - 3)
        expect(after.level).toBe(2)
        // Total XP should be the XP at start of level 2
        expect(after.totalXP).toBe(16)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('clamps to level 0 when spending more levels than available', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        yield* svc.addXP(7) // level 1
        const after = yield* svc.spendLevels(5)
        expect(after.level).toBe(0)
        expect(after.totalXP).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('reset', () => {
    it.effect('resets XP back to initial state', () =>
      Effect.gen(function* () {
        const svc = yield* XPService
        yield* svc.addXP(100)
        yield* svc.reset()
        const xp = yield* svc.getXP()
        expect(xp.totalXP).toBe(0)
        expect(xp.level).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
