import { describe, expect, it } from '@effect/vitest'
import { Effect, Match } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { createGameSceneController } from './game'

describe('domain/scene/scenes/game', () => {
  it.effect('movePlayer applies delta offsets', () =>
    Effect.gen(function* () {
      const controller = yield* createGameSceneController()
      const position = yield* controller.movePlayer({ dx: 1, dy: 2, dz: -3 })
      expect(position).toEqual({ x: 1, y: 66, z: -3 })
    })
  )

  it.effect('applyDamage keeps health within bounds', () =>
    Effect.gen(function* () {
      const controller = yield* createGameSceneController()
      yield* controller.applyDamage(150)
      const damaged = yield* controller.current()
      expect(damaged.playerState.health).toBe(0)
      return undefined
    })
  )

  it.effect('heal restores health without exceeding maximum', () =>
    Effect.gen(function* () {
      const controller = yield* createGameSceneController()
      yield* controller.applyDamage(50)
      const healed = yield* controller.heal(100)
      expect(healed).toBe(100)
      return undefined
    })
  )

  it('heal and damage compositions remain within [0,100] (property)', () =>
    FastCheck.assert(
      FastCheck.property(
        FastCheck.array(FastCheck.integer({ min: -120, max: 120 }), { minLength: 1, maxLength: 40 }),
        (deltas) =>
          Effect.runSync(
            Effect.gen(function* () {
              const controller = yield* createGameSceneController()
              yield* Effect.reduce(deltas, 0, (_, delta) =>
                Match.value(delta).pipe(
                  Match.when(
                    (value) => value >= 0,
                    (value) => controller.heal(value)
                  ),
                  Match.orElse((value) => controller.applyDamage(Math.abs(value)))
                ).pipe(Effect.asVoid)
              )
              const state = yield* controller.current()
              expect(state.playerState.health).toBeGreaterThanOrEqual(0)
              expect(state.playerState.health).toBeLessThanOrEqual(100)
              return undefined
            })
          )
      )
    )
  )
})
