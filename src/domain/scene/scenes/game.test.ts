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

  it.prop('applyDamage keeps health within bounds', [fc.integer({ min: 0, max: 200 })], ([amount]) =>
    Effect.gen(function* () {
      const controller = yield* createGameSceneController()
      const health = yield* controller.applyDamage(amount)
      expect(health).toBeGreaterThanOrEqual(0)
      expect(health).toBeLessThanOrEqual(100)
      return true
    })
  )

  it.prop('heal restores health without exceeding maximum', [fc.integer({ min: 0, max: 200 })], ([amount]) =>
    Effect.gen(function* () {
      const controller = yield* createGameSceneController()
      yield* controller.applyDamage(50)
      const health = yield* controller.heal(amount)
      expect(health).toBeLessThanOrEqual(100)
      expect(health).toBeGreaterThanOrEqual(0)
      return true
    })
  )
})
