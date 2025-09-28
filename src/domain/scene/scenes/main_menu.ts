import { Effect, Layer, Match, Ref, pipe } from 'effect'
import { Scene, SceneCleanupError, SceneData, SceneInitializationError } from './base'

// MainMenuScene実装
export const MainMenuScene = Layer.effect(
  Scene,
  Effect.gen(function* () {
    // シーンデータ
    const sceneData: SceneData = {
      id: 'main-menu-001',
      type: 'MainMenu',
      isActive: false,
      metadata: {
        title: 'TypeScript Minecraft Clone',
        version: '1.0.0',
        menuItems: ['新しいゲーム', '設定', '終了'],
      },
    }

    // 内部状態をRefで管理
    const isInitializedRef = yield* Ref.make(false)
    const selectedMenuItemRef = yield* Ref.make(0)

    return Scene.of({
      data: sceneData,

      initialize: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          yield* pipe(
            isInitialized,
            Match.value,
            Match.when(true, () =>
              Effect.fail(
                SceneInitializationError({
                  message: 'MainMenuScene is already initialized',
                  sceneType: 'MainMenu',
                })
              )
            ),
            Match.when(false, () =>
              Effect.gen(function* () {
                yield* Effect.logInfo('MainMenuSceneを初期化中...')

                // メニューUIの初期化
                yield* Ref.set(selectedMenuItemRef, 0)
                yield* Ref.set(isInitializedRef, true)

                yield* Effect.logInfo('MainMenuScene初期化完了')
              })
            ),
            Match.exhaustive
          )
        }),

      update: (deltaTime) =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          yield* pipe(
            isInitialized,
            Match.value,
            Match.when(false, () => Effect.void),
            Match.when(true, () => Effect.logDebug(`MainMenuScene update: deltaTime=${deltaTime}ms`)),
            Match.exhaustive
          )
        }),

      render: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          yield* pipe(
            isInitialized,
            Match.value,
            Match.when(false, () => Effect.void),
            Match.when(true, () => Effect.logDebug('MainMenuSceneレンダリング中...')),
            Match.exhaustive
          )
        }),

      cleanup: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          yield* pipe(
            isInitialized,
            Match.value,
            Match.when(true, () =>
              Effect.gen(function* () {
                yield* Effect.logInfo('MainMenuSceneクリーンアップ中...')

                yield* Ref.set(isInitializedRef, false)
                yield* Ref.set(selectedMenuItemRef, 0)

                yield* Effect.logInfo('MainMenuSceneクリーンアップ完了')
              })
            ),
            Match.when(false, () =>
              Effect.fail(
                SceneCleanupError({
                  message: 'MainMenuScene is not initialized, cannot cleanup',
                  sceneType: 'MainMenu',
                })
              )
            ),
            Match.exhaustive
          )
        }),

      onEnter: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('MainMenuSceneに入場しました')
        }),

      onExit: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('MainMenuSceneから退場しました')
        }),
    })
  })
)
