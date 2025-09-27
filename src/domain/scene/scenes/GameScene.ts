import { Effect, Layer, Match, Ref, pipe } from 'effect'
import { Scene, SceneCleanupError, SceneData, SceneInitializationError } from '../Scene'

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

      initialize: () =>
        Effect.gen(function* () {
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

          // 初期化済み確認とゲーム状態の取得を関数型で処理
          return yield* pipe(
            isInitialized,
            Match.value,
            Match.when(false, () => Effect.void), // 初期化されていない場合は早期終了
            Match.when(true, () =>
              Effect.gen(function* () {
                const gameState = yield* Ref.get(gameStateRef)

                // ゲームが一時停止されている場合はスキップ
                return yield* pipe(
                  gameState.isPaused,
                  Match.value,
                  Match.when(true, () => Effect.void), // 一時停止中は早期終了
                  Match.when(false, () =>
                    Effect.gen(function* () {
                      // ゲーム状態の更新
                      yield* Ref.update(gameStateRef, (state) => ({
                        ...state,
                        worldTime: state.worldTime + deltaTime,
                        tickCount: state.tickCount + 1,
                      }))

                      yield* Effect.logDebug(`GameScene update: deltaTime=${deltaTime}ms, tick=${gameState.tickCount}`)
                    })
                  ),
                  Match.exhaustive
                )
              })
            ),
            Match.exhaustive
          )
        }),

      render: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          // 初期化済み確認（render処理）を関数型で処理
          return yield* pipe(
            isInitialized,
            Match.value,
            Match.when(false, () => Effect.void), // 初期化されていない場合は早期終了
            Match.when(true, () =>
              Effect.gen(function* () {
                const gameState = yield* Ref.get(gameStateRef)

                yield* Effect.logDebug(
                  `GameSceneレンダリング中... (position: ${gameState.playerPosition.x}, ${gameState.playerPosition.y}, ${gameState.playerPosition.z})`
                )
              })
            ),
            Match.exhaustive
          )
        }),

      cleanup: () =>
        Effect.gen(function* () {
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

      onEnter: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('GameSceneに入場しました')

          yield* Ref.update(gameStateRef, (state) => ({
            ...state,
            isPlaying: true,
          }))
        }),

      onExit: () =>
        Effect.gen(function* () {
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
