import { Effect, Layer } from 'effect'
import { createArchetype } from '@domain'
import { ApplicationLayer } from '@application/application-layer'
import { UnifiedAppLive } from '@infrastructure/layers/unified.layer'
import { GameController, GameControllerLive } from '@presentation/controllers/game.controller'
import { UIController, UIControllerLive } from '@presentation/controllers/ui.controller'

/**
 * Web Browser Main Entry Point
 * ウェブブラウザ向けのメインエントリーポイント
 *
 * DDD構造に従い、以下のレイヤーを統合:
 * - Presentation Layer (Controllers + View Models)
 * - Application Layer
 * - Infrastructure Layer
 */

// Presentation層のサービス統合
const PresentationLayerLive = Layer.mergeAll(GameControllerLive, UIControllerLive)

// 全レイヤーの統合
const WebAppLayerLive = Layer.mergeAll(UnifiedAppLive, ApplicationLayer, PresentationLayerLive)

/**
 * メインゲームループの初期化と実行
 */
const initialize = Effect.gen(function* () {
  // Presentation層コントローラーの取得
  const gameController = yield* GameController
  const uiController = yield* UIController

  // UI初期化
  yield* uiController.showHUD(true)
  yield* uiController.showCrosshair(true)
  yield* uiController.showNotification('Welcome to TypeScript Minecraft!', 5000)

  // ワールド初期化
  yield* gameController.initializeWorld()

  yield* Effect.log('Web application initialized successfully')
})

/**
 * ウェブアプリケーションの実行エントリーポイント
 */
const WebApp = initialize.pipe(
  Effect.provide(WebAppLayerLive),
  Effect.catchAllCause((cause) =>
    Effect.gen(function* () {
      yield* Effect.logError('Failed to initialize web application', cause)
      return yield* Effect.die(cause)
    }),
  ),
)

/**
 * 開発モード用のホットリロード対応
 */
export const startWebApplication = () => {
  return Effect.runFork(WebApp)
}

// 本番環境では自動実行
/* v8 ignore next 3 */
if (import.meta.env.PROD) {
  startWebApplication()
}
