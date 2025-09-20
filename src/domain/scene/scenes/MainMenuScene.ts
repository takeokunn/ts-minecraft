import { Effect, Layer } from 'effect'
import { Scene, SceneData, SceneCleanupError, SceneInitializationError } from '../Scene.js'

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

    // 内部状態管理
    let isInitialized = false
    let selectedMenuItem = 0

    return Scene.of({
      data: sceneData,

      initialize: () =>
        Effect.gen(function* () {
          if (isInitialized) {
            return yield* Effect.fail(
              SceneInitializationError({
                message: 'MainMenuScene is already initialized',
                sceneType: 'MainMenu',
              })
            )
          }

          yield* Effect.logInfo('MainMenuSceneを初期化中...')

          // メニューUIの初期化
          selectedMenuItem = 0
          isInitialized = true

          yield* Effect.logInfo('MainMenuScene初期化完了')
        }),

      update: (deltaTime) =>
        Effect.gen(function* () {
          if (!isInitialized) return

          // キーボード入力処理（実際のゲームではInputServiceから取得）
          // 現在はデモ用の更新処理
          yield* Effect.logDebug(`MainMenuScene update: deltaTime=${deltaTime}ms`)

          // メニューアニメーション更新などの処理
          // 実装例：フェードイン/アウト、ボタンのハイライト効果など
        }),

      render: () =>
        Effect.gen(function* () {
          if (!isInitialized) return

          // レンダリング処理（実際のゲームではRenderServiceを使用）
          yield* Effect.logDebug('MainMenuSceneレンダリング中...')

          // メニュー要素のレンダリング
          // 実装例：
          // - ゲームタイトル表示
          // - メニューボタン表示
          // - 現在選択中のボタンのハイライト
          // - 背景画像/アニメーション
        }),

      cleanup: () =>
        Effect.gen(function* () {
          if (!isInitialized) {
            return yield* Effect.fail(
              SceneCleanupError({
                message: 'MainMenuScene is not initialized, cannot cleanup',
                sceneType: 'MainMenu',
              })
            )
          }

          yield* Effect.logInfo('MainMenuSceneクリーンアップ中...')

          // リソースのクリーンアップ
          // 実装例：
          // - テクスチャの解放
          // - オーディオの停止
          // - イベントリスナーの削除

          isInitialized = false
          selectedMenuItem = 0

          yield* Effect.logInfo('MainMenuSceneクリーンアップ完了')
        }),

      onEnter: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('MainMenuSceneに入場しました')

          // シーン入場時の処理
          // 実装例：
          // - 背景音楽の再生
          // - フェードインアニメーション開始
          // - セーブデータの読み込み状況確認

          // Note: SceneDataは不変なので、実際のゲームでは状態管理システムで管理される
        }),

      onExit: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('MainMenuSceneから退場しました')

          // シーン退場時の処理
          // 実装例：
          // - 背景音楽のフェードアウト
          // - フェードアウトアニメーション開始
          // - 設定の保存

          // Note: SceneDataは不変なので、実際のゲームでは状態管理システムで管理される
        }),
    })
  })
)