import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
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

      const damageValues = [10, 45.5, 200]
      for (const amount of damageValues) {
        const health = yield* controller.applyDamage(amount)
        expect(health).toBeGreaterThanOrEqual(0)
        expect(health).toBeLessThanOrEqual(100)
      }

      const minHealth = yield* controller.applyDamage(1_000)
      expect(minHealth).toBe(0)
    })
  )

  it.effect('heal restores health without exceeding maximum', () =>
    Effect.gen(function* () {
      const controller = yield* createGameSceneController()
      yield* controller.applyDamage(60)

      const health = yield* controller.heal(30)
      expect(health).toBe(70)

      const capped = yield* controller.heal(1_000)
      expect(capped).toBe(100)
    })
  )
})
