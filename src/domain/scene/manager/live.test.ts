import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Ref, Schema } from 'effect'
import { SceneManager } from './service'
import { SceneManagerLive } from './live'
import { SceneService } from '../service'
import { ActiveScene, PlayerStateSchema, SceneState as Scenes, TransitionEffect, WorldIdSchema } from '../types'

const defaultPlayerState = Schema.decodeSync(PlayerStateSchema)({
  position: { x: 0, y: 64, z: 0 },
  health: 100,
  hunger: 100,
})

const makeGameScene = (name: string): ActiveScene =>
  Scenes.GameWorld({
    worldId: Schema.decodeSync(WorldIdSchema)(name),
    playerState: defaultPlayerState,
  })

const makeSceneServiceLayer = (initial: ActiveScene) =>
  Layer.scoped(SceneService, (
    Effect.gen(function* () {
      const ref = yield* Ref.make<ActiveScene>(initial)

      const transitionTo: SceneService['transitionTo'] = (scene) =>
        Ref.set(ref, scene).pipe(Effect.as(scene))

      return {
        transitionTo,
        current: () => Ref.get(ref),
        saveSnapshot: () => Effect.void,
        restoreFrom: () => Ref.get(ref),
        registerFailure: () => Ref.get(ref),
        preload: () => Effect.void,
      }
    })
  ))

describe('domain/scene/manager/live', () => {
  it.effect('transitionTo updates manager state and history', () =>
    Effect.gen(function* () {
      const initial = Scenes.MainMenu()
      const layer = Layer.mergeAll(makeSceneServiceLayer(initial), SceneManagerLive)

      yield* Effect.gen(function* () {
        const manager = yield* SceneManager
        const settings = Scenes.Settings()
        const transitioned = yield* manager.transitionTo(settings, TransitionEffect.Instant({}))
        expect(transitioned).toStrictEqual(settings)

        const state = yield* manager.state()
        expect(state.current).toStrictEqual(settings)
        expect(state.history.at(-1)).toStrictEqual(settings)
      }).pipe(Layer.provide(layer))
    })
  )

  it.effect('push and pop maintain stack invariants', () =>
    Effect.gen(function* () {
      const initial = Scenes.MainMenu()
      const layer = Layer.mergeAll(makeSceneServiceLayer(initial), SceneManagerLive)

      yield* Effect.gen(function* () {
        const manager = yield* SceneManager
        const game = makeGameScene('world:push')

        yield* manager.push(game)
        const pushed = yield* manager.state()
        expect(pushed.stack.length).toBe(1)
        expect(pushed.current).toStrictEqual(game)

        yield* manager.pop()
        const popped = yield* manager.state()
        expect(popped.stack.length).toBe(0)
        expect(popped.current._tag).toBe('MainMenu')
      }).pipe(Layer.provide(layer))
    })
  )

  it.effect('reset clears stack and returns to provided scene', () =>
    Effect.gen(function* () {
      const initial = makeGameScene('world:initial')
      const layer = Layer.mergeAll(makeSceneServiceLayer(initial), SceneManagerLive)

      yield* Effect.gen(function* () {
        const manager = yield* SceneManager
        const settings = Scenes.Settings()

        yield* manager.reset(settings)
        const state = yield* manager.state()
        expect(state.stack).toEqual([])
        expect(state.current).toStrictEqual(settings)
      }).pipe(Layer.provide(layer))
    })
  )
})
