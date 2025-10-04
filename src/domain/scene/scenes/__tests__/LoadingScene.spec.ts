import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { buildSceneRuntime, type SceneRuntime, type SceneSnapshot } from '../base'
import { LoadingDefinition } from '../loading'
import type { SceneState as SceneConstructors } from '../../types'

type LoadingState = ReturnType<typeof SceneConstructors.Loading>

type LoadingRuntime = SceneRuntime<LoadingState>
type LoadingSnapshot = SceneSnapshot<LoadingState>

const withScene = <A>(use: (scene: LoadingRuntime) => Effect.Effect<A>) =>
  buildSceneRuntime(LoadingDefinition).pipe(Effect.flatMap(use))

describe('LoadingScene runtime', () => {
  it.effect('snapshot exposes loading metadata', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const snapshot = yield* scene.snapshot()
        expect(snapshot.kind).toBe('Loading')
        expect(snapshot.metadata).toEqual({
          loadingType: 'WorldGeneration',
          showTips: true,
          animationType: 'spinner',
        })
        expect(snapshot.state.progress).toBeGreaterThanOrEqual(0)
        expect(snapshot.state.progress).toBeLessThanOrEqual(1)
        return undefined
      })
    )
  )

  it.effect('initialize keeps progress at zero', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const snapshot = yield* scene.initialize()
        expect(snapshot.state.progress).toBeCloseTo(0, 5)
        return undefined
      })
    )
  )

  it.effect('update advances progress when active', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        const afterUpdate = yield* scene.update(400)
        expect(afterUpdate.state.progress).toBeGreaterThanOrEqual(0.3)
        expect(afterUpdate.state.progress).toBeLessThanOrEqual(1)
        return undefined
      })
    )
  )

  it.effect('cleanup fails before initialize', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const result = yield* Effect.either(scene.cleanup())
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneCleanupError')
        }
        return undefined
      })
    )
  )

  it.effect('cleanup resets progress to zero', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        yield* scene.update(800)
        const cleaned = yield* scene.cleanup()
        expect(cleaned.state.progress).toBeCloseTo(0, 5)
        return undefined
      })
    )
  )

  it.effect('onExit completes progress', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        const exited = yield* scene.onExit()
        expect(exited.state.progress).toBeCloseTo(1, 5)
        return undefined
      })
    )
  )

  it('update keeps progress within bounds (property)', () =>
    FastCheck.assert(
      FastCheck.property(
        FastCheck.array(FastCheck.integer({ min: 1, max: 1200 }), { minLength: 1, maxLength: 30 }),
        (deltas) =>
          Effect.runSync(
            withScene((scene) =>
              Effect.gen(function* () {
                yield* scene.initialize()
                yield* scene.onEnter()
                const initial = yield* scene.snapshot()
                const finalSnapshot = yield* Effect.reduce<LoadingSnapshot>(
                  deltas,
                  initial,
                  (_current, delta) => scene.update(delta)
                )
                expect(finalSnapshot.state.progress).toBeGreaterThanOrEqual(0)
                expect(finalSnapshot.state.progress).toBeLessThanOrEqual(1)
                return undefined
              })
            )
          )
      )
    )
  )
})
