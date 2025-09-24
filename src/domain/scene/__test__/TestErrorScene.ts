import { Effect, Layer, Ref, pipe } from 'effect'
import { Scene, SceneData, SceneCleanupError, SceneInitializationError } from '../Scene'

/**
 * テスト専用のエラー発生シーン
 * 初期化エラー、クリーンアップエラーを意図的に発生させる
 */
export const TestErrorScene = Layer.effect(
  Scene,
  Effect.gen(function* () {
    const sceneData: SceneData = {
      id: 'test-error-scene',
      type: 'Game', // Gameタイプとして実装して、createSceneでテスト可能にする
      isActive: false,
      metadata: {
        testMode: 'error',
        forceInitError: false,
        forceCleanupError: false,
      },
    }

    const errorFlagsRef = yield* Ref.make({
      forceInitError: false,
      forceCleanupError: false,
      isInitialized: false,
    })

    return Scene.of({
      data: sceneData,

      initialize: () =>
        Effect.gen(function* () {
          const flags = yield* Ref.get(errorFlagsRef)

          // Use simple if statement instead of Match pattern
          if (flags.forceInitError) {
            yield* Effect.fail(
              SceneInitializationError({
                message: 'Forced initialization error for testing',
                sceneType: 'Game',
              })
            )
          } else {
            yield* Ref.update(errorFlagsRef, (f) => ({ ...f, isInitialized: true }))
            yield* Effect.logInfo('TestErrorScene initialized successfully')
          }
        }),

      update: (deltaTime) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`TestErrorScene update: ${deltaTime}ms`)
        }),

      render: () =>
        Effect.gen(function* () {
          yield* Effect.logDebug('TestErrorScene rendering')
        }),

      cleanup: () =>
        Effect.gen(function* () {
          const flags = yield* Ref.get(errorFlagsRef)

          // Use simple if statement instead of Match pattern
          if (flags.forceCleanupError) {
            yield* Effect.fail(
              SceneCleanupError({
                message: 'Forced cleanup error for testing',
                sceneType: 'Game',
              })
            )
          } else {
            yield* Ref.update(errorFlagsRef, (f) => ({
              ...f,
              isInitialized: false,
              forceInitError: false,
              forceCleanupError: false,
            }))
            yield* Effect.logInfo('TestErrorScene cleanup completed')
          }
        }),

      onEnter: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('Entering TestErrorScene')
        }),

      onExit: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('Exiting TestErrorScene')
        }),
    })
  })
)

// エラーフラグを設定するためのヘルパー
export const TestErrorSceneWithInitError = Layer.effect(
  Scene,
  Effect.gen(function* () {
    const baseScene = yield* Scene.pipe(Effect.provide(TestErrorScene))

    // 初期化エラーを強制的に発生させる
    return Scene.of({
      ...baseScene,
      initialize: () =>
        Effect.fail(
          SceneInitializationError({
            message: 'Forced initialization error for testing onEnter path',
            sceneType: 'Game',
          })
        ),
    })
  })
)

export const TestErrorSceneWithCleanupError = Layer.effect(
  Scene,
  Effect.gen(function* () {
    const baseScene = yield* Scene.pipe(Effect.provide(TestErrorScene))

    // クリーンアップエラーを強制的に発生させる
    return Scene.of({
      ...baseScene,
      cleanup: () =>
        Effect.fail(
          SceneCleanupError({
            message: 'Forced cleanup error for testing error handling',
            sceneType: 'Game',
          })
        ),
    })
  })
)
