import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Ref } from 'effect'

import { mergeConfig } from '@application/config'
import { GameApplication } from '@application/game-application'
import { SettingsApplicationServiceLive } from '@application/settings'
import {
  createInitialState,
  DEFAULT_GAME_APPLICATION_CONFIG,
  type ApplicationLifecycleState,
  type GameApplicationState,
} from '@application/types'
import { MenuControllerLive, MenuControllerService, MenuStateStoreLive } from '@presentation/menu'

type TestGameApplicationState = GameApplicationState

const TestGameApplicationLayer = Layer.scoped(
  GameApplication,
  Effect.gen(function* () {
    const baseState = createInitialState(DEFAULT_GAME_APPLICATION_CONFIG)
    const runningState: TestGameApplicationState = {
      ...baseState,
      lifecycle: 'Running',
    }
    const stateRef = yield* Ref.make<TestGameApplicationState>(runningState)

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

    const setLifecycle = (lifecycle: ApplicationLifecycleState) =>
      Ref.update(stateRef, (state) => ({ ...state, lifecycle }))

    const replaceState = (next: TestGameApplicationState) => Ref.set(stateRef, next)

    return GameApplication.of({
      initialize: () => Effect.void,
      start: () => Effect.void,
      pause: () => setLifecycle('Paused'),
      resume: () => setLifecycle('Running'),
      stop: () => setLifecycle('Stopped'),
      getState,
      getLifecycleState: () => getState().pipe(Effect.map((state) => state.lifecycle)),
      tick: () => Effect.void,
      updateConfig,
      healthCheck: () =>
        getState().pipe(
          Effect.map(() => ({
            gameLoop: { status: 'healthy' as const },
            renderer: { status: 'healthy' as const },
            scene: { status: 'healthy' as const },
            input: { status: 'healthy' as const },
            ecs: { status: 'healthy' as const },
          }))
        ),
      reset: () => replaceState({ ...runningState }),
    })
  })
)

const MenuControllerTestLayer = Layer.mergeAll(
  TestGameApplicationLayer,
  SettingsApplicationServiceLive,
  MenuStateStoreLive,
  MenuControllerLive
)

const withMenuLayer = <A>(effect: Effect.Effect<A>) => effect.pipe(Effect.provideLayer(MenuControllerTestLayer))

describe('MenuController', () => {
  it.effect('ポーズメニューを開閉できる', () =>
    withMenuLayer(
      Effect.gen(function* () {
        const controller = yield* MenuControllerService
        const game = yield* GameApplication

        const pauseModel = yield* controller.openPause()
        expect(pauseModel.route).toBe('pause')

        const pausedState = yield* game.getState()
        expect(pausedState.lifecycle).toBe('Paused')

        const closed = yield* controller.close()
        expect(closed.route).toBe('none')
        const resumedState = yield* game.getState()
        expect(resumedState.lifecycle).toBe('Running')
        return undefined
      })
    )
  )

  it.effect('設定メニューから戻ると直前のルートに復帰する', () =>
    withMenuLayer(
      Effect.gen(function* () {
        const controller = yield* MenuControllerService
        const game = yield* GameApplication
        yield* controller.openMain()
        yield* controller.handleMainAction('main:settings')
        const pausedState = yield* game.getState()
        expect(pausedState.lifecycle).toBe('Running')
        const backTo = yield* controller.back()
        expect(backTo.route).toBe('main')
        return undefined
      })
    )
  )

  it.effect('設定変更を適用するとメニュースナップショットに反映される', () =>
    withMenuLayer(
      Effect.gen(function* () {
        const controller = yield* MenuControllerService
        const game = yield* GameApplication
        yield* controller.openMain()
        const settings = yield* controller.handleMainAction('main:settings')
        expect(settings.route).toBe('settings')

        const updated = yield* controller.updateSetting({
          type: 'toggle',
          id: 'debug.enableLogging',
          value: false,
        })

        const debug = updated.settings.find((category) => category.id === 'debug')
        expect(debug?.options.find((option) => option.id === 'debug.enableLogging')?.value).toBe(false)

        const runningState = yield* game.getState()
        expect(runningState.lifecycle).toBe('Running')
        return undefined
      })
    )
  )

  it.effect('タイトルに戻る操作でゲームを停止する', () =>
    withMenuLayer(
      Effect.gen(function* () {
        const controller = yield* MenuControllerService
        const game = yield* GameApplication
        yield* controller.openPause()
        const returned = yield* controller.handlePauseAction('pause:exit-to-title')
        expect(returned.route).toBe('main')
        const state = yield* game.getState()
        expect(state.lifecycle).toBe('Stopped')
        return undefined
      })
    )
  )
})
