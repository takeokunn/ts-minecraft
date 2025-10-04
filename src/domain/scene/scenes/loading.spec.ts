import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { createLoadingSceneController } from './loading'

describe('domain/scene/scenes/loading', () => {
  it('setProgress clamps values into [0,1]', () => {
    fc.assert(
      fc.property(fc.float({ min: -2, max: 2, noDefaultInfinity: true, noNaN: true }), (value) => {
        const controller = Effect.runSync(createLoadingSceneController())
        const result = Effect.runSync(controller.setProgress(value))
        const clamped = Math.max(0, Math.min(1, value))
        expect(result).toBeCloseTo(clamped, 5)
      })
    )

    const controller = Effect.runSync(createLoadingSceneController())
    const exit = Effect.runSyncExit(controller.setProgress(Number.NaN))
    expect(exit._tag).toBe('Failure')
  })

  it.effect('advance accumulates progress within bounds', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const first = yield* controller.advance(0.3)
      expect(first).toBeCloseTo(0.3, 5)

      const second = yield* controller.advance(0.4)
      expect(second).toBeCloseTo(0.7, 5)

      const capped = yield* controller.advance(1.0)
      expect(capped).toBeCloseTo(1, 5)

      const lowered = yield* controller.advance(-0.8)
      expect(lowered).toBeCloseTo(0.2, 5)
    })
  )

  it('setProgress rejects non-finite numbers', () => {
    const controller = Effect.runSync(createLoadingSceneController())
    const invalids = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    invalids.forEach((value) => {
      const exit = Effect.runSyncExit(controller.setProgress(value))
      expect(exit._tag).toBe('Failure')
    })
  })
})
