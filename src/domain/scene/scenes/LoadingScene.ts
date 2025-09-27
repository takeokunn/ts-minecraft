import { Effect, Layer, Match, pipe, Ref } from 'effect'
import { Scene, SceneCleanupError, SceneData, SceneInitializationError } from '../Scene'

// ローディング状態の定義
interface LoadingState {
  readonly progress: number // 0-100
  readonly currentTask: string
  readonly totalTasks: number
  readonly completedTasks: number
  readonly estimatedTimeRemaining: number // ms
  readonly startTime: number
}

// LoadingScene実装
export const LoadingScene = Layer.effect(
  Scene,
  Effect.gen(function* () {
    // シーンデータ
    const sceneData: SceneData = {
      id: 'loading-scene-001',
      type: 'Loading',
      isActive: false,
      metadata: {
        loadingType: 'WorldGeneration',
        showTips: true,
        animationType: 'spinner',
      },
    }

    // ローディング状態管理
    const loadingStateRef = yield* Ref.make<LoadingState>({
      progress: 0,
      currentTask: '初期化中...',
      totalTasks: 0,
      completedTasks: 0,
      estimatedTimeRemaining: 0,
      startTime: Date.now(),
    })

    // 内部状態をRefで管理
    const isInitializedRef = yield* Ref.make(false)
    const loadingTipsRef = yield* Ref.make<readonly string[]>([])

    return Scene.of({
      data: sceneData,

      initialize: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          return yield* isInitialized
            ? Effect.fail(
                SceneInitializationError({
                  message: 'LoadingScene is already initialized',
                  sceneType: 'Loading',
                })
              )
            : Effect.gen(function* () {
                yield* Effect.logInfo('LoadingSceneを初期化中...')

                // ローディング画面用のリソース読み込み
                yield* Ref.set(loadingTipsRef, [
                  'ヒント: ブロックを破壊するには左クリックしましょう',
                  'ヒント: ブロックを設置するには右クリックしましょう',
                  'ヒント: インベントリを開くにはEキーを押しましょう',
                  'ヒント: クリエイティブモードでは無限にブロックを使用できます',
                  'ヒント: スペースキーでジャンプできます',
                ])

                // 初期ローディング状態
                yield* Ref.update(loadingStateRef, (state) => ({
                  ...state,
                  currentTask: 'リソースを読み込み中...',
                  startTime: Date.now(),
                }))

                yield* Ref.set(isInitializedRef, true)
                yield* Effect.logInfo('LoadingScene初期化完了')
              })
        }),

      update: (deltaTime) =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          yield* pipe(
            Match.value(isInitialized),
            Match.when(false, () => Effect.succeed(undefined)),
            Match.orElse(() =>
              Effect.gen(function* () {
                const loadingState = yield* Ref.get(loadingStateRef)

                // ローディング進行の更新
                yield* Effect.logDebug(`LoadingScene update: progress=${loadingState.progress}%`)

                // 擬似的なローディング進行の更新
                yield* pipe(
                  Match.value(loadingState.progress < 100),
                  Match.when(true, () =>
                    Effect.gen(function* () {
                      const progressIncrement = Math.min(deltaTime / 50, 100 - loadingState.progress)

                      yield* Ref.update(loadingStateRef, (state) => {
                        const newProgress = Math.min(state.progress + progressIncrement, 100)
                        const elapsed = Date.now() - state.startTime
                        const estimatedTotal = elapsed / (newProgress / 100)
                        const estimatedRemaining = Math.max(0, estimatedTotal - elapsed)

                        // タスクの更新
                        const currentTask = pipe(
                          Match.value(newProgress),
                          Match.when(
                            (p) => p <= 25,
                            () => state.currentTask
                          ),
                          Match.when(
                            (p) => p <= 50,
                            () => 'ワールドを生成中...'
                          ),
                          Match.when(
                            (p) => p <= 75,
                            () => 'テクスチャを読み込み中...'
                          ),
                          Match.when(
                            (p) => p <= 90,
                            () => 'チャンクを生成中...'
                          ),
                          Match.orElse(() => '最終処理中...')
                        )

                        return {
                          ...state,
                          progress: newProgress,
                          currentTask,
                          estimatedTimeRemaining: estimatedRemaining,
                        }
                      })
                    })
                  ),
                  Match.orElse(() => Effect.succeed(undefined))
                )

                // ローディング完了時の処理
                yield* pipe(
                  Match.value(loadingState.progress >= 100),
                  Match.when(true, () => Effect.logInfo('ローディング完了')),
                  Match.orElse(() => Effect.succeed(undefined))
                )
              })
            )
          )
        }),

      render: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          yield* pipe(
            Match.value(isInitialized),
            Match.when(false, () => Effect.succeed(undefined)),
            Match.orElse(() =>
              Effect.gen(function* () {
                const loadingState = yield* Ref.get(loadingStateRef)

                yield* Effect.logDebug(
                  `LoadingSceneレンダリング中... (progress: ${Math.round(loadingState.progress)}%, task: ${
                    loadingState.currentTask
                  })`
                )
              })
            )
          )
        }),

      cleanup: () =>
        Effect.gen(function* () {
          const isInitialized = yield* Ref.get(isInitializedRef)

          return yield* isInitialized
            ? Effect.gen(function* () {
                yield* Effect.logInfo('LoadingSceneクリーンアップ中...')

                // ローディング状態のリセット
                yield* Ref.update(loadingStateRef, () => ({
                  progress: 0,
                  currentTask: '初期化中...',
                  totalTasks: 0,
                  completedTasks: 0,
                  estimatedTimeRemaining: 0,
                  startTime: Date.now(),
                }))

                // リソースのクリーンアップ
                yield* Ref.set(loadingTipsRef, [])

                yield* Ref.set(isInitializedRef, false)

                yield* Effect.logInfo('LoadingSceneクリーンアップ完了')
              })
            : Effect.fail(
                SceneCleanupError({
                  message: 'LoadingScene is not initialized, cannot cleanup',
                  sceneType: 'Loading',
                })
              )
        }),

      onEnter: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('LoadingSceneに入場しました')

          yield* Ref.update(loadingStateRef, (state) => ({
            ...state,
            progress: 0,
            startTime: Date.now(),
            currentTask: 'ローディング開始...',
          }))
        }),

      onExit: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('LoadingSceneから退場しました')
        }),
    })
  })
)
