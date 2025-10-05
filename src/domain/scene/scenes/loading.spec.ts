import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { createLoadingSceneController } from './loading'

describe('domain/scene/scenes/loading', () => {
  it.effect('setProgress accepts SceneProgress range values', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const samples = fc.sample(fc.float({ min: 0, max: 1, noNaN: true }), 25)

      yield* Effect.forEach(
        samples,
        (value) =>
          controller.setProgress(value).pipe(
            Effect.tap((progress) =>
              Effect.sync(() => {
                expect(progress).toBeCloseTo(value, 5)
              })
            ),
            Effect.zipRight(
              controller.current().pipe(
                Effect.tap((current) =>
                  Effect.sync(() => {
                    expect(current.progress).toBeCloseTo(value, 5)
                  })
                )
              )
            )
          ),
        { concurrency: 1 }
      )
    })
  )

  it.effect('advance accumulates progress until exceeding bounds', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const deltas = [0.1, 0.2, 0.15]

      yield* Effect.reduce(deltas, 0, (expected, delta) =>
        controller.advance(delta).pipe(
          Effect.tap((progress) =>
            Effect.sync(() => {
              expect(progress).toBeCloseTo(expected + delta, 5)
            })
          ),
          Effect.as(expected + delta)
        )
      )

      yield* controller.advance(0.8).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.fail('advance should fail when exceeding bounds'),
          onFailure: (error) =>
            Effect.sync(() => {
              expect(error._tag).toBe('InvalidMutation')
              expect(error.reason).toContain('between')
            }),
        })
      )
    })
  )

  it.effect('setProgress rejects values outside SceneProgress range', () =>
    Effect.gen(function* () {
      const controller = yield* createLoadingSceneController()
      const invalidValues = [-1, -0.01, 1.01, 2]

      const expectInvalidMutation = (value: number) =>
        controller.setProgress(value).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.fail(`value ${value} should be rejected`),
            onFailure: (error) =>
              Effect.sync(() => {
                expect(error._tag).toBe('InvalidMutation')
              }),
          })
        )

      yield* Effect.forEach(invalidValues, expectInvalidMutation, { concurrency: 1 })

      const arbitraryErrors = fc.sample(
        fc.float({ min: -10, max: 10, noNaN: true }).filter((value) => value < 0 || value > 1),
        20
      )

      yield* Effect.forEach(arbitraryErrors, expectInvalidMutation, { concurrency: 1 })
    })
  )
})
