import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { SceneState as Scenes } from '../types'
import { createSceneController } from './base'

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

  it('controller maintains schema validity for generated selections (property)', () =>
    FastCheck.assert(
      FastCheck.property(FastCheck.array(FastCheck.constantFrom('NewGame', 'LoadGame', 'Settings', 'Exit')), (options) =>
        Effect.runSync(
          Effect.gen(function* () {
            const controller = yield* createSceneController(Scenes.MainMenu())
            yield* Effect.reduce(options, Option.none<string>(), (_, option) =>
              controller
                .update((current) => ({
                  ...current,
                  selectedOption: Option.some(option),
                }))
                .pipe(Effect.map((state) => state.selectedOption))
            )
            const snapshot = yield* controller.reset()
            expect(snapshot.selectedOption).toStrictEqual(Option.none())
            return undefined
          })
        )
      )
    )
  )
})
