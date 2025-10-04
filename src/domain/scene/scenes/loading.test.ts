import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { createLoadingSceneController } from './loading'

describe('domain/scene/scenes/loading', () => {
  it.effect('setProgress accepts SceneProgress range values', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const samples = fc.sample(fc.float({ min: 0, max: 1, noNaN: true }), 25)

      for (const value of samples) {
        yield* controller
          .setProgress(value)
          .pipe(
            Effect.match({
              onFailure: () => Effect.fail('expected success'),
              onSuccess: (progress) =>
                Effect.sync(() => {
                  expect(progress).toBeCloseTo(value, 5)
                }),
            })
          )

        const current = yield* controller.current()
        expect(current.progress).toBeCloseTo(value, 5)
      }
    })
  )

  it.effect('advance accumulates progress until exceeding bounds', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const deltas = [0.1, 0.2, 0.15]
      let expected = 0

      for (const delta of deltas) {
        expected += delta
        yield* controller
          .advance(delta)
          .pipe(
            Effect.match({
              onFailure: () => Effect.fail('advance should succeed within range'),
              onSuccess: (progress) =>
                Effect.sync(() => {
                  expect(progress).toBeCloseTo(expected, 5)
                }),
            })
          )
      }

      const overflow = yield* controller.advance(0.8).pipe(Effect.either)

      expect(overflow._tag).toBe('Left')
      if (overflow._tag === 'Left') {
        expect(overflow.left._tag).toBe('InvalidMutation')
        expect(overflow.left.reason).toContain('<= 1')
      }
    })
  )

  it.effect('setProgress rejects values outside SceneProgress range', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const invalidValues = [-1, -0.01, 1.01, 2]

      for (const value of invalidValues) {
        const result = yield* controller.setProgress(value).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('InvalidMutation')
        }
      }

      const arbitraryErrors = fc.sample(
        fc.float({ min: -10, max: 10, noNaN: true }).filter((value) => value < 0 || value > 1),
        20
      )

      for (const value of arbitraryErrors) {
        const result = yield* controller.setProgress(value).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('InvalidMutation')
        }
      }
    })
  )
})
