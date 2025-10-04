import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, Schema } from 'effect'
import { createSceneController, SceneControllerError } from './base'
import { PlayerStateSchema, SceneState as Scenes, WorldIdSchema } from '../types'

describe('domain/scene/scenes/base', () => {
  it.effect('controller returns current state and supports reset', () =>
    Effect.gen(function* () {
      const controller = yield* createSceneController(Scenes.MainMenu())
      const current = yield* controller.current()
      expect(current._tag).toBe('MainMenu')

      const updated = yield* controller.update((state) => ({
        ...state,
        selectedOption: Option.some('Settings'),
      }))
      expect(updated.selectedOption).toStrictEqual(Option.some('Settings'))

      const reset = yield* controller.reset()
      expect(reset.selectedOption).toStrictEqual(Option.none())
    })
  )

  it.effect('invalid mutation is rejected with SceneControllerError', () =>
    Effect.gen(function* () {
      const controller = yield* createSceneController(Scenes.MainMenu())
      const exit = yield* Effect.exit(
        controller.update((state) => ({
          ...state,
          selectedOption: Option.some('Launch' as unknown as 'NewGame'),
        }))
      )
      expect(exit._tag).toBe('Failure')
    })
  )
})
