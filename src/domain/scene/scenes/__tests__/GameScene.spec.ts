import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { buildSceneRuntime, type SceneRuntime, type SceneSnapshot } from '../base'
import { GameDefinition } from '../game'
import type { SceneState as SceneConstructors } from '../../types'

type GameState = ReturnType<typeof SceneConstructors.GameWorld>

type GameRuntime = SceneRuntime<GameState>
type GameSnapshot = SceneSnapshot<GameState>

const withScene = <A>(use: (scene: GameRuntime) => Effect.Effect<A>) =>
  buildSceneRuntime(GameDefinition).pipe(Effect.flatMap(use))

describe('GameScene runtime', () => {
  it.effect('snapshot exposes game metadata', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const snapshot = yield* scene.snapshot()
        expect(snapshot.kind).toBe('GameWorld')
        expect(snapshot.metadata).toEqual({
          gameMode: 'Creative',
          worldName: 'New World',
          difficulty: 'Normal',
        })
        return undefined
      })
    )
  )

  it.effect('initialize returns default player state', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const initialized = yield* scene.initialize()
        expect(initialized.state.playerState.health).toBe(100)
        expect(initialized.state.playerState.hunger).toBe(100)
        return undefined
      })
    )
  )

  it.effect('double initialization fails with SceneInitializationError', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        const result = yield* Effect.either(scene.initialize())
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneInitializationError')
          expect(result.left.sceneType).toBe('GameWorld')
        }
        return undefined
      })
    )
  )

  it.effect('update before initialize is a no-op', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const before = yield* scene.snapshot()
        const after = yield* scene.update(32)
        expect(after).toEqual(before)
        return undefined
      })
    )
  )

  it.effect('active update reduces hunger but keeps bounds', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        const afterFirst = yield* scene.update(160)
        expect(afterFirst.state.playerState.hunger).toBeLessThan(100)
        expect(afterFirst.state.playerState.hunger).toBeGreaterThanOrEqual(0)
        return undefined
      })
    )
  )

  it.effect('onExit marks scene inactive', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        const exited = yield* scene.onExit()
        expect(exited.isActive).toBe(false)
        return undefined
      })
    )
  )

  it.effect('cleanup resets player stats', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        yield* scene.update(320)
        const cleaned = yield* scene.cleanup()
        expect(cleaned.state.playerState.health).toBe(100)
        expect(cleaned.state.playerState.hunger).toBe(100)
        return undefined
      })
    )
  )

  it('repeated updates maintain stats within range (property)', () =>
    FastCheck.assert(
      FastCheck.property(
        FastCheck.array(FastCheck.integer({ min: 1, max: 240 }), { minLength: 1, maxLength: 50 }),
        (deltas) =>
          Effect.runSync(
            withScene((scene) =>
              Effect.gen(function* () {
                yield* scene.initialize()
                yield* scene.onEnter()
                const initial = yield* scene.snapshot()
                const result = yield* Effect.reduce<GameSnapshot>(
                  deltas,
                  initial,
                  (_current, delta) => scene.update(delta)
                )
                const { health, hunger } = result.state.playerState
                expect(health).toBeGreaterThanOrEqual(0)
                expect(health).toBeLessThanOrEqual(100)
                expect(hunger).toBeGreaterThanOrEqual(0)
                expect(hunger).toBeLessThanOrEqual(100)
                return undefined
              })
            )
          )
      )
    )
  )

  it.effect('cleanup after exit still succeeds', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        yield* scene.onExit()
        const cleaned = yield* scene.cleanup()
        expect(cleaned.isActive).toBe(false)
        return undefined
      })
    )
  )
})
