import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Option, Schema } from 'effect'
import {
  SceneProgressSchema,
  SceneState as Scenes,
  SceneStateSchema,
  TransitionDurationSchema,
  TransitionEffect,
  TransitionError,
  WorldIdSchema,
  PlayerStateSchema,
} from './types'

describe('domain/scene/types', () => {
  it.effect('SceneState constructors are schema compatible', () =>
    Effect.gen(function* () {
      const mainMenu = Scenes.MainMenu()
      const loading = Scenes.Loading({ target: mainMenu, progress: yield* Schema.decode(SceneProgressSchema)(0.5) })
      const decodedMainMenu = yield* Schema.decode(SceneStateSchema)(mainMenu)
      const decodedLoading = yield* Schema.decode(SceneStateSchema)(loading)
      expect(decodedMainMenu).toStrictEqual(mainMenu)
      expect(decodedLoading).toStrictEqual(loading)
    })
  )

  it.prop('Loading progress is branded within [0,1]', [fc.float({ min: 0, max: 1 })], ([value]) =>
    Effect.gen(function* () {
      const progress = yield* Schema.decode(SceneProgressSchema)(value)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(1)
      return true
    })
  )

  it.prop('TransitionEffect.Fade stores branded durations', [fc.float({ min: 0, max: 10_000 })], ([millis]) =>
    Effect.gen(function* () {
      const duration = yield* Schema.decode(TransitionDurationSchema)(millis)
      const effect = TransitionEffect.Fade({ duration })
      expect(effect._tag).toBe('Fade')
      expect(effect.duration).toBe(duration)
      return true
    })
  )

  it.effect('TransitionError.InvalidScene captures formatted reason', () =>
    Effect.gen(function* () {
      const scene = Scenes.MainMenu()
      const error = TransitionError.InvalidScene({ requested: scene, reason: 'invalid' })
      expect(error.reason).toBe('invalid')
      expect(error.requested).toStrictEqual(scene)
    })
  )

  it.effect('GameWorld scene validates worldId and playerState brands', () =>
    Effect.gen(function* () {
      const worldId = yield* Schema.decode(WorldIdSchema)('world:test')
      const playerState = yield* Schema.decode(PlayerStateSchema)({
        position: { x: 1, y: 64, z: -3 },
        health: 80,
        hunger: 75,
      })

      const scene = Scenes.GameWorld({ worldId, playerState })
      const decoded = yield* Schema.decode(SceneStateSchema)(scene)
      expect(decoded).toStrictEqual(scene)
    })
  )

  it.effect('SceneState.MainMenu preserves optional selections', () =>
    Effect.gen(function* () {
      const withSelection = Scenes.MainMenu(Option.some('Settings'))
      const decoded = yield* Schema.decode(SceneStateSchema)(withSelection)
      expect(decoded.selectedOption).toStrictEqual(Option.some('Settings'))
    })
  )
})
