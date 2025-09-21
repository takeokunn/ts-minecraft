/**
 * Vitest テスト環境設定
 *
 * 最小限の設定で Effect-TS/vitest 統合を最適化
 */

import { beforeAll, afterEach } from 'vitest'

/**
 * テスト環境の基本設定
 */
beforeAll(() => {
  // テスト用環境変数の設定
  process.env['NODE_ENV'] = 'test'
  process.env['VITEST'] = 'true'

  // Effect-TS ログレベル設定（テスト中はエラーのみ）
  process.env['EFFECT_LOG_LEVEL'] = 'Error'

  // テスト中のコンソール出力制御
  if (!process.env['DEBUG']) {
    const originalConsole = console.log
    console.log = (...args: any[]) => {
      // DEBUGモードでない場合はログを抑制
      if (process.env['VITEST_DEBUG']) {
        originalConsole(...args)
      }
    }
  }
})

/**
 * テスト後のクリーンアップ
 */
afterEach(() => {
  // メモリリーク防止（Node.js --expose-gc が必要）
  if (global.gc) {
    global.gc()
  }

  // Effect-TS のグローバル状態をクリーンアップ
  // （必要に応じて追加の cleanup logic を実装）
})