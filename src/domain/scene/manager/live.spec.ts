import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Ref, Schema } from 'effect'
import * as Context from 'effect/Context'
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
      const restoreFrom: SceneService['restoreFrom'] = (_saveId) => Ref.get(ref)
      const registerFailure: SceneService['registerFailure'] = (_error) => Ref.get(ref)
      const preload: SceneService['preload'] = (_scene) => Effect.void

      return {
        transitionTo,
        current: () => Ref.get(ref),
        saveSnapshot: () => Effect.void,
        restoreFrom,
        registerFailure,
        preload,
      }
    })
  ))

const withManager = <A>(initial: ActiveScene, body: (manager: SceneManager) => Effect.Effect<A>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const layer = SceneManagerLive.pipe(Layer.provide(makeSceneServiceLayer(initial)))
      const context = yield* Layer.build(layer)
      const manager = Context.unsafeGet(context, SceneManager)
      return yield* body(manager)
    })
  )

describe('domain/scene/manager/live', () => {
  it.effect('transitionTo updates manager state and history', () => {
    const initial = Scenes.MainMenu()
    const next = makeGameScene('world-next')

    return withManager(initial, (manager) =>
      Effect.gen(function* () {
        const result = yield* manager.transitionTo(next, TransitionEffect.Instant({}))
        expect(result).toStrictEqual(next)

        const state = yield* manager.state()
        expect(state.current).toStrictEqual(next)
        expect(state.history).toHaveLength(2)
        expect(state.history[0]).toStrictEqual(initial)
        expect(state.history.at(-1)).toStrictEqual(next)
      })
    )
  })

  it.effect('push and pop maintain stack invariants', () => {
    const initial = makeGameScene('world-start')
    const pushed = makeGameScene('world-dungeon')

    return withManager(initial, (manager) =>
      Effect.gen(function* () {
        yield* manager.push(pushed, TransitionEffect.Instant({}))
        let state = yield* manager.state()
        expect(state.current).toStrictEqual(pushed)
        expect(state.stack).toHaveLength(1)
        expect(state.stack[0]).toStrictEqual(initial)

        const popped = yield* manager.pop(TransitionEffect.Instant({}))
        expect(popped).toStrictEqual(initial)

        state = yield* manager.state()
        expect(state.current).toStrictEqual(initial)
        expect(state.stack).toHaveLength(0)
        expect(state.history.at(-1)).toStrictEqual(initial)
      })
    )
  })

  it.effect('reset clears stack and returns to provided scene', () => {
    const initial = makeGameScene('world-start')
    const intermediate = makeGameScene('world-deep')
    const resetTarget = makeGameScene('world-reset')

    return withManager(initial, (manager) =>
      Effect.gen(function* () {
        yield* manager.push(intermediate, TransitionEffect.Instant({}))
        let state = yield* manager.state()
        expect(state.stack).toHaveLength(1)

        const result = yield* manager.reset(resetTarget)
        expect(result).toStrictEqual(resetTarget)

        state = yield* manager.state()
        expect(state.current).toStrictEqual(resetTarget)
        expect(state.stack).toHaveLength(0)
        expect(state.history).toStrictEqual([resetTarget])
      })
    )
  })
})
