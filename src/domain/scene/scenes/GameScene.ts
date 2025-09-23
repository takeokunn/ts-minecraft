import { Effect, Layer, Ref } from 'effect'
import { Scene, SceneData, SceneCleanupError, SceneInitializationError } from '../Scene'

// ゲーム状態の定義
interface GameState {
  readonly isPlaying: boolean
  readonly isPaused: boolean
  readonly playerPosition: { x: number; y: number; z: number }
  readonly worldTime: number
  readonly tickCount: number
}

// GameScene実装
export const GameScene = Layer.effect(
  Scene,
  Effect.gen(function* () {
    // シーンデータ
    const sceneData: SceneData = {
      id: 'game-scene-001',
      type: 'Game',
      isActive: false,
      metadata: {
        gameMode: 'Creative',
        worldName: 'New World',
        difficulty: 'Normal',
      },
    }

    // ゲーム状態管理
    const gameStateRef = yield* Ref.make<GameState>({
      isPlaying: false,
      isPaused: false,
      playerPosition: { x: 0, y: 64, z: 0 },
      worldTime: 0,
      tickCount: 0,
    })

    // 内部状態をRefで管理
    const isInitializedRef = yield* Ref.make(false)

    return Scene.of({
      data: sceneData,

      initialize: () => Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          return yield* isInitialized
            ? Effect.fail(
                SceneInitializationError({
                  message: 'GameScene is already initialized',
                  sceneType: 'Game',
                })
              )
            : Effect.gen(function* () {
                yield* Effect.logInfo('GameSceneを初期化中...')

                // ゲームワールドの初期化
                yield* Effect.logInfo('ワールドを生成中...')

                // 初期ゲーム状態の設定
                yield* Ref.update(gameStateRef, (state) => ({
                  ...state,
                  isPlaying: true,
                  isPaused: false,
                }))

                yield* Ref.set(isInitializedRef, true)
                yield* Effect.logInfo('GameScene初期化完了')
              })
        }),

      update: (deltaTime) =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          // 初期化済み確認（update処理） - Effect.if使用
          yield* Effect.if(!isInitialized, {
            onTrue: () => Effect.void, // 早期リターンの代わり
            onFalse: () => Effect.void,
          })

          if (!isInitialized) return

          const gameState = yield* Ref.get(gameStateRef)

          // ゲームが一時停止されている場合はスキップ
          if (gameState.isPaused) return

          // ゲーム状態の更新
          yield* Ref.update(gameStateRef, (state) => ({
            ...state,
            worldTime: state.worldTime + deltaTime,
            tickCount: state.tickCount + 1,
          }))

          yield* Effect.logDebug(`GameScene update: deltaTime=${deltaTime}ms, tick=${gameState.tickCount}`)
        }),

      render: () => Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          // 初期化済み確認（render処理） - Effect.if使用
          yield* Effect.if(!isInitialized, {
            onTrue: () => Effect.void, // 早期リターンの代わり
            onFalse: () => Effect.void,
          })

          if (!isInitialized) return

          const gameState = yield* Ref.get(gameStateRef)

          yield* Effect.logDebug(
            `GameSceneレンダリング中... (position: ${gameState.playerPosition.x}, ${gameState.playerPosition.y}, ${gameState.playerPosition.z})`
          )
        }),

      cleanup: () => Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          return yield* isInitialized
            ? Effect.gen(function* () {
                yield* Effect.logInfo('GameSceneクリーンアップ中...')

                // ゲーム状態の停止
                yield* Ref.update(gameStateRef, (state) => ({
                  ...state,
                  isPlaying: false,
                  isPaused: false,
                }))

                yield* Ref.set(isInitializedRef, false)

                yield* Effect.logInfo('GameSceneクリーンアップ完了')
              })
            : Effect.fail(
                SceneCleanupError({
                  message: 'GameScene is not initialized, cannot cleanup',
                  sceneType: 'Game',
                })
              )
        }),

      onEnter: () => Effect.gen(function* () {
          yield* Effect.logInfo('GameSceneに入場しました')

          yield* Ref.update(gameStateRef, (state) => ({
            ...state,
            isPlaying: true,
          }))
        }),

      onExit: () => Effect.gen(function* () {
          yield* Effect.logInfo('GameSceneから退場しました')

          yield* Ref.update(gameStateRef, (state) => ({
            ...state,
            isPlaying: false,
            isPaused: true,
          }))
        }),
    })
  })
)
