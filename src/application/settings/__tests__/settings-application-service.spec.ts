import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Ref } from 'effect'

import { GameApplication } from '@application/game-application'
import { mergeConfig } from '@application/config'
import { SettingsApplicationService, SettingsApplicationServiceLive } from '@application/settings'
import { createInitialState, DEFAULT_GAME_APPLICATION_CONFIG, type GameApplicationState } from '@application/types'

type TestGameApplicationState = GameApplicationState

const TestGameApplicationLayer = Layer.scoped(
  GameApplication,
  Effect.gen(function* () {
    const baseState = createInitialState(DEFAULT_GAME_APPLICATION_CONFIG)
    const stateRef = yield* Ref.make<TestGameApplicationState>(baseState)

    const modifyState = <A>(
      transform: (current: TestGameApplicationState) => Effect.Effect<readonly [A, TestGameApplicationState]>
    ) => Ref.modifyEffect(stateRef, transform)

    const getState = () => Ref.get(stateRef)

    const updateConfig = (patch: Parameters<GameApplication['updateConfig']>[0]) =>
      modifyState((current) =>
        mergeConfig(current.config, Option.some(patch)).pipe(
          Effect.map((nextConfig) => [undefined, { ...current, config: nextConfig } as TestGameApplicationState])
        )
      )

    const replaceState = (next: TestGameApplicationState) => Ref.set(stateRef, next)

    return GameApplication.of({
      initialize: () => Effect.void,
      start: () => Effect.void,
      pause: () => Effect.void,
      resume: () => Effect.void,
      stop: () => Effect.void,
      getState,
      getLifecycleState: () => getState().pipe(Effect.map((state) => state.lifecycle)),
      tick: () => Effect.void,
      updateConfig,
      healthCheck: () => getState().pipe(
        Effect.map(() => ({
          gameLoop: { status: 'healthy' as const },
          renderer: { status: 'healthy' as const },
          scene: { status: 'healthy' as const },
          input: { status: 'healthy' as const },
          ecs: { status: 'healthy' as const },
        }))
      ),
      reset: () => replaceState(createInitialState(DEFAULT_GAME_APPLICATION_CONFIG)),
    })
  })
)

const SettingsTestLayer = SettingsApplicationServiceLive.pipe(Layer.provide(TestGameApplicationLayer))

const withSettingsLayer = <A>(effect: Effect.Effect<A>) => effect.pipe(Effect.provideLayer(SettingsTestLayer))

describe('SettingsApplicationService', () => {
  it.effect('デフォルト設定のメニュースナップショットを提供する', () =>
    withSettingsLayer(
      Effect.gen(function* () {
        const service = yield* SettingsApplicationService
        const model = yield* service.menuModel()
        expect(model.length).toBe(5)
        const rendering = model.find((category) => category.id === 'rendering')
        expect(rendering?.options.find((option) => option.id === 'rendering.targetFps')?.value).toBe(60)
        const debug = model.find((category) => category.id === 'debug')
        expect(debug?.options.find((option) => option.id === 'debug.enableLogging')?.value).toBe(true)
        return undefined
      })
    )
  )

  it.effect('設定更新をGameApplicationへ適用し最新状態を返す', () =>
    withSettingsLayer(
      Effect.gen(function* () {
        const service = yield* SettingsApplicationService
        const model = yield* service.update({ type: 'toggle', id: 'rendering.enableVSync', value: false })
        expect(
          model
            .find((category) => category.id === 'rendering')
            ?.options.find((option) => option.id === 'rendering.enableVSync')?.value
        ).toBe(false)

        const refreshed = yield* service.menuModel()
        expect(
          refreshed
            .find((category) => category.id === 'rendering')
            ?.options.find((option) => option.id === 'rendering.enableVSync')?.value
        ).toBe(false)
        return undefined
      })
    )
  )

  it.effect('リセットでデフォルト値に戻す', () =>
    withSettingsLayer(
      Effect.gen(function* () {
        const service = yield* SettingsApplicationService
        yield* service.update({ type: 'slider', id: 'input.mouseSensitivity', value: 5 })
        const resetModel = yield* service.reset()
        expect(
          resetModel
            .find((category) => category.id === 'input')
            ?.options.find((option) => option.id === 'input.mouseSensitivity')?.value
        ).toBe(1)
        return undefined
      })
    )
  )
})
