/**
 * Vitest Test Setup
 * テスト環境の初期化設定
 */

// Vitest globals
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

// Effect-TS imports
import { Effect, ConfigProvider } from 'effect'

/**
 * テスト実行前の初期設定
 */
beforeAll(async () => {
  // テスト用環境変数の設定
  process.env['NODE_ENV'] = 'test'
  process.env['VITEST'] = 'true'

  // コンソールログレベルの設定
  if (!process.env['DEBUG']) {
    console.log = () => {} // テスト中のログ出力を抑制
  }
})

/**
 * 各テスト実行前の設定
 */
beforeEach(() => {
  // テスト用の追加設定（必要に応じて）
})

/**
 * 各テスト実行後のクリーンアップ
 */
afterEach(() => {
  // メモリリークを防ぐためのガベージコレクション強制実行
  if (global.gc) {
    global.gc()
  }
})

/**
 * 全テスト終了後のクリーンアップ
 */
afterAll(() => {
  // プロセス終了処理
  process.removeAllListeners()
})

/**
 * テスト用のEffect-TS設定
 */
export const TestConfig = {
  timeout: 10000,
  maxRetries: 3,
  logLevel: 'error' as const
}

/**
 * テストユーティリティ
 */
export const TestUtils = {
  /**
   * Effect実行用のヘルパー
   */
  runEffect: <E, A>(effect: Effect.Effect<A, E>) =>
    Effect.runPromise(effect),

  /**
   * タイムアウト付きEffect実行
   */
  runEffectWithTimeout: <E, A>(
    effect: Effect.Effect<A, E>,
    timeoutMs: number = TestConfig.timeout
  ) =>
    Effect.runPromise(
      Effect.timeout(effect, `${timeoutMs} millis`)
    ),

  /**
   * テスト用のConfigProvider
   */
  createTestConfigProvider: (config: Record<string, string>) =>
    ConfigProvider.fromMap(new Map(Object.entries(config)))
}

// グローバルエラーハンドラー
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})