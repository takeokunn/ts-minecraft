import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Ref, Schema } from 'effect'
import { SceneManager } from './service'
import { SceneManagerLive } from './live'
import { SceneService } from '../service'
import {
  ActiveScene,
  PlayerStateSchema,
  SceneState,
  SceneState as Scenes,
  TransitionEffect,
  WorldIdSchema,
} from '../types'

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

const makeSceneServiceLayer = (initial: SceneState) =>
  Layer.scoped(
    SceneService,
    Effect.gen(function* () {
      const stateRef = yield* Ref.make<SceneState>(initial)

      const transitionTo: SceneService['transitionTo'] = (scene) =>
        Ref.set(stateRef, scene).pipe(Effect.as(scene))

      const saveSnapshot: SceneService['saveSnapshot'] = () => Effect.void
      const restoreFrom: SceneService['restoreFrom'] = () => Ref.get(stateRef)
      const registerFailure: SceneService['registerFailure'] = () => Ref.get(stateRef)
      const preload: SceneService['preload'] = () => Effect.void

      return SceneService.of({
        transitionTo,
        current: () => Ref.get(stateRef),
        saveSnapshot,
        restoreFrom,
        registerFailure,
        preload,
      })
    })
  )

const withManager = <A>(initial: SceneState, use: (manager: SceneManager) => Effect.Effect<A>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const manager = yield* SceneManager
      return yield* use(manager)
    }).pipe(Effect.provide(SceneManagerLive), Effect.provide(makeSceneServiceLayer(initial)))
  )

describe('domain/scene/manager/live', () => {
  it.effect('transitionTo updates manager state and history', () => {
    const initialScene = makeGameScene('initial')
    const targetScene = makeGameScene('target')
    return withManager(initialScene, (manager) =>
      Effect.gen(function* () {
        const transitioned = yield* manager.transitionTo(targetScene, TransitionEffect.Instant({}))
        expect(transitioned).toStrictEqual(targetScene)

        const current = yield* manager.current()
        expect(current).toStrictEqual(targetScene)

        const state = yield* manager.state()
        expect(state.isTransitioning).toBe(false)
        expect(state.history.at(-1)).toStrictEqual(targetScene)
        expect(state.history.length).toBe(2)
        expect(state.stack.length).toBe(0)
      })
    )
  })

  it.effect('push and pop maintain stack invariants', () => {
    const initialScene = makeGameScene('initial')
    const firstScene = makeGameScene('first')
    const secondScene = makeGameScene('second')
    return withManager(initialScene, (manager) =>
      Effect.gen(function* () {
        yield* manager.push(firstScene)
        let state = yield* manager.state()
        expect(state.current).toStrictEqual(firstScene)
        expect(state.stack).toStrictEqual([initialScene])

        yield* manager.push(secondScene)
        state = yield* manager.state()
        expect(state.current).toStrictEqual(secondScene)
        expect(state.stack).toStrictEqual([initialScene, firstScene])

        const poppedToFirst = yield* manager.pop()
        expect(poppedToFirst).toStrictEqual(firstScene)
        state = yield* manager.state()
        expect(state.current).toStrictEqual(firstScene)
        expect(state.stack).toStrictEqual([initialScene])

        const poppedToInitial = yield* manager.pop()
        expect(poppedToInitial).toStrictEqual(initialScene)
        state = yield* manager.state()
        expect(state.current).toStrictEqual(initialScene)
        expect(state.stack.length).toBe(0)
      })
    )
  })

  it.effect('reset clears stack and returns to provided scene', () => {
    const initialScene = makeGameScene('initial')
    const firstScene = makeGameScene('first')
    const secondScene = makeGameScene('second')
    const resetScene = makeGameScene('reset')
    return withManager(initialScene, (manager) =>
      Effect.gen(function* () {
        yield* manager.push(firstScene)
        yield* manager.push(secondScene)

        const result = yield* manager.reset(resetScene)
        expect(result).toStrictEqual(resetScene)

        const state = yield* manager.state()
        expect(state.stack.length).toBe(0)
        expect(state.history).toStrictEqual([resetScene])
        expect(state.current).toStrictEqual(resetScene)
      })
    )
  })
})
