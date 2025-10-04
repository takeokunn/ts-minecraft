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
      const worldId = Schema.decodeSync(WorldIdSchema)('world:base')
      const playerState = Schema.decodeSync(PlayerStateSchema)({
        position: { x: 0, y: 64, z: 0 },
        health: 100,
        hunger: 100,
      })

      const controller = yield* createSceneController(Scenes.GameWorld({ worldId, playerState }))

      const result = yield* controller
        .update((state) => ({
          ...state,
          playerState: {
            ...state.playerState,
            health: 200,
          },
        }))
        .pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('InvalidMutation')
      }
    })
  )
})
