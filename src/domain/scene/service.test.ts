import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Ref, Schema } from 'effect'
import { provideLayers } from '../../testing/effect'
import { SceneService } from './service'
import {
  SceneState as Scenes,
  SceneStateSchema,
  TransitionEffect,
  SaveIdSchema,
  WorldIdSchema,
  PlayerStateSchema,
} from './types'
import type { SceneState } from './types'

const makeStubSceneServiceLayer = (initial: SceneState) =>
  Layer.effect(SceneService, (
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(initial)

      const transitionTo: SceneService['transitionTo'] = (scene) =>
        Effect.gen(function* () {
          yield* Schema.decode(SceneStateSchema)(scene)
          yield* Ref.set(stateRef, scene)
          return scene
        })

      return SceneService.of({
        transitionTo,
        current: () => Ref.get(stateRef),
        saveSnapshot: () => Effect.void,
        restoreFrom: () => Ref.get(stateRef),
        registerFailure: () => Ref.get(stateRef),
        preload: () => Effect.void,
      })
    })
  ))

describe('domain/scene/service tag', () => {
  it.effect('provides SceneService via Layer', () => {
    const initialScene = Scenes.MainMenu()
    const settingsScene = Scenes.Settings(Option.some('MainMenu'))
    const worldId = Schema.decodeSync(WorldIdSchema)('world:scene-service:test')
    const playerState = Schema.decodeSync(PlayerStateSchema)({
      position: { x: 0, y: 64, z: 0 },
      health: 90,
      hunger: 80,
    })
    const gameScene = Scenes.GameWorld({ worldId, playerState })
    const saveId = Schema.decodeSync(SaveIdSchema)('save:scene-service:test')

    return Effect.gen(function* () {
      const service = yield* SceneService

      const current = yield* service.current()
      expect(current).toStrictEqual(initialScene)

      const transitioned = yield* service.transitionTo(settingsScene, TransitionEffect.Instant({}))
      expect(transitioned).toStrictEqual(settingsScene)

      const afterTransition = yield* service.current()
      expect(afterTransition).toStrictEqual(settingsScene)

      const gameWorld = yield* service.transitionTo(gameScene)
      expect(gameWorld).toStrictEqual(gameScene)

      yield* service.preload(gameScene)

      const restored = yield* service.restoreFrom(saveId)
      expect(restored).toStrictEqual(gameScene)

      const failure = yield* service.registerFailure(new Error('scene failure'))
      expect(failure).toStrictEqual(gameScene)

      yield* service.saveSnapshot()
    }).pipe(provideLayers(makeStubSceneServiceLayer(initialScene)))
  })
})
