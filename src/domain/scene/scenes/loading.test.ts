import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { createLoadingSceneController } from './loading'

describe('domain/scene/scenes/loading', () => {
  it.effect('setProgress validates range', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const progress = yield* controller.setProgress(0.75)
      expect(progress).toBeCloseTo(0.75)
    })
  )

  it.effect('advance accumulates progress', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const afterFirst = yield* controller.advance(0.2)
      expect(afterFirst).toBeCloseTo(0.2)
      const afterSecond = yield* controller.advance(0.9)
      expect(afterSecond).toBeCloseTo(1)
    })
  )

  it.prop('setProgress clamps invalid numbers into schema range', [fc.float({ min: -2, max: 2 })], ([value]) =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const progress = yield* controller.setProgress(value)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(1)
      return true
    })
  )
})
