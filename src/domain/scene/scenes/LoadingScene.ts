import { Effect, Layer, Ref } from 'effect'
import { Scene, SceneData, SceneCleanupError, SceneInitializationError } from '../Scene.js'

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

    // 内部状態
    let isInitialized = false

    return Scene.of({
      data: sceneData,

      initialize: () =>
        Effect.gen(function* () {
          if (isInitialized) {
            return yield* Effect.fail(
              SceneInitializationError({
                message: 'LoadingScene is already initialized',
                sceneType: 'Loading',
              })
            )
          }

          yield* Effect.logInfo('LoadingSceneを初期化中...')

          // ローディング画面用のリソース読み込み
          // ヒントテキストの設定など

          // 初期ローディング状態
          yield* Ref.update(loadingStateRef, (state) => ({
            ...state,
            currentTask: 'リソースを読み込み中...',
            startTime: Date.now(),
          }))

          isInitialized = true
          yield* Effect.logInfo('LoadingScene初期化完了')
        }),

      update: (deltaTime) =>
        Effect.gen(function* () {
          if (!isInitialized) return

          const loadingState = yield* Ref.get(loadingStateRef)

          // ローディング進行の更新
          yield* Effect.logDebug(`LoadingScene update: progress=${loadingState.progress}%`)

          // 擬似的なローディング進行の更新
          if (loadingState.progress < 100) {
            const progressIncrement = Math.min(deltaTime / 50, 100 - loadingState.progress) // 5秒で完了する計算

            yield* Ref.update(loadingStateRef, (state) => {
              const newProgress = Math.min(state.progress + progressIncrement, 100)
              const elapsed = Date.now() - state.startTime
              const estimatedTotal = elapsed / (newProgress / 100)
              const estimatedRemaining = Math.max(0, estimatedTotal - elapsed)

              // タスクの更新
              let currentTask = state.currentTask
              if (newProgress > 25 && newProgress <= 50) {
                currentTask = 'ワールドを生成中...'
              } else if (newProgress > 50 && newProgress <= 75) {
                currentTask = 'テクスチャを読み込み中...'
              } else if (newProgress > 75 && newProgress <= 90) {
                currentTask = 'チャンクを生成中...'
              } else if (newProgress > 90) {
                currentTask = '最終処理中...'
              }

              return {
                ...state,
                progress: newProgress,
                currentTask,
                estimatedTimeRemaining: estimatedRemaining,
              }
            })
          }

          // ローディング完了時の処理
          if (loadingState.progress >= 100) {
            yield* Effect.logInfo('ローディング完了')
          }
        }),

      render: () =>
        Effect.gen(function* () {
          if (!isInitialized) return

          const loadingState = yield* Ref.get(loadingStateRef)

          yield* Effect.logDebug(
            `LoadingSceneレンダリング中... (progress: ${Math.round(loadingState.progress)}%, task: ${loadingState.currentTask})`
          )

          // ローディング画面のレンダリング処理
          // 実装例：
          // - プログレスバーの描画
          // - 現在のタスクテキストの表示
          // - ローディングアニメーション
          // - ランダムなヒントテキストの表示
          // - 背景画像/動画の表示
          // - 推定残り時間の表示
        }),

      cleanup: () =>
        Effect.gen(function* () {
          if (!isInitialized) {
            return yield* Effect.fail(
              SceneCleanupError({
                message: 'LoadingScene is not initialized, cannot cleanup',
                sceneType: 'Loading',
              })
            )
          }

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
          // 実装例：
          // - ローディング画面用テクスチャの解放
          // - アニメーションタイマーの停止
          // - メモリの解放

          isInitialized = false

          yield* Effect.logInfo('LoadingSceneクリーンアップ完了')
        }),

      onEnter: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('LoadingSceneに入場しました')

          // ローディング画面入場時の処理
          // 実装例：
          // - ローディング音楽の再生
          // - プログレスバーのアニメーション開始
          // - ヒントテキストのローテーション開始

          yield* Ref.update(loadingStateRef, (state) => ({
            ...state,
            startTime: Date.now(),
            progress: 0,
          }))
        }),

      onExit: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('LoadingSceneから退場しました')

          // ローディング画面退場時の処理
          // 実装例：
          // - ローディング音楽の停止
          // - アニメーションの停止
          // - 一時的なリソースの解放
        }),
    })
  })
)
