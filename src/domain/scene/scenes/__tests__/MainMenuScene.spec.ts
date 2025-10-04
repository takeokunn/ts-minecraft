import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { buildSceneRuntime, type SceneRuntime, type SceneSnapshot } from '../base'
import { MainMenuDefinition } from '../main_menu'
import type { SceneState as SceneConstructors } from '../../types'

type MainMenuState = ReturnType<typeof SceneConstructors.MainMenu>
type MainMenuSnapshot = SceneSnapshot<MainMenuState>

type MainMenuRuntime = SceneRuntime<MainMenuState>

const withScene = <A>(use: (scene: MainMenuRuntime) => Effect.Effect<A>) =>
  buildSceneRuntime(MainMenuDefinition).pipe(Effect.flatMap(use))

describe('MainMenuScene runtime', () => {
  it.effect('初期スナップショットがメタデータを含む', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const snapshot = yield* scene.snapshot()
        expect(snapshot.kind).toBe('MainMenu')
        expect(snapshot.metadata).toEqual({
          title: 'TypeScript Minecraft Clone',
          version: '1.0.0',
          menuItems: ['新しいゲーム', '設定', '終了'],
        })
        expect(snapshot.isActive).toBe(false)
        return undefined
      })
    )
  )

  it.effect('初回のinitializationで選択肢が設定される', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const initialized = yield* scene.initialize()
        expect(initialized.state.selectedOption).toStrictEqual(Option.some('NewGame'))
        return undefined
      })
    )
  )

  it.effect('二重初期化はSceneInitializationErrorを返す', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        const result = yield* Effect.either(scene.initialize())
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneInitializationError')
          expect(result.left.sceneType).toBe('MainMenu')
        }
        return undefined
      })
    )
  )

  it.effect('cleanup前に未初期化の場合は失敗する', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const result = yield* Effect.either(scene.cleanup())
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneCleanupError')
          expect(result.left.message).toContain('Scene not initialized')
        }
        return undefined
      })
    )
  )

  it.effect('初期化後のcleanupで選択状態がリセットされる', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onEnter()
        const cleaned = yield* scene.cleanup()
        expect(cleaned.isActive).toBe(false)
        expect(cleaned.state.selectedOption).toStrictEqual(Option.none())
        return undefined
      })
    )
  )

  it.effect('updateは非初期化状態では安全にスナップショットを返す', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        const before = yield* scene.snapshot()
        const updated = yield* scene.update(16)
        expect(updated).toEqual(before)
        return undefined
      })
    )
  )

  it.effect('onEnterの後はisActiveがtrueになり、onExitでfalseに戻る', () =>
    withScene((scene) =>
      Effect.gen(function* () {
        yield* scene.initialize()
        const entered = yield* scene.onEnter()
        expect(entered.isActive).toBe(true)
        const exited = yield* scene.onExit()
        expect(exited.isActive).toBe(false)
        return undefined
      })
    )
  )

  it('onEnterとonExitの往復は常に一貫した状態を保つ (property)', () =>
    FastCheck.assert(
      FastCheck.property(
        FastCheck.array(FastCheck.boolean(), { minLength: 1, maxLength: 50 }),
        (toggles) =>
          Effect.runSync(
            withScene((scene) =>
              Effect.gen(function* () {
                yield* scene.initialize()
                for (const toggle of toggles) {
                  const next = yield* (toggle ? scene.onEnter() : scene.onExit())
                  expect(next.kind).toBe('MainMenu')
                  expect(typeof next.isActive).toBe('boolean')
                }
                return undefined
              })
            )
          )
      )
    )
  )
})
