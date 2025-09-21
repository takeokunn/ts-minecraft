import { Config } from '../core/schemas/Config'
import { Effect } from 'effect'
import * as Schema from 'effect/Schema'

// デフォルト設定
export const defaultConfig: Config = {
  debug: false,
  fps: 60,
  memoryLimit: 2048,
}

// 設定のバリデーション
export const validateConfig = (input: unknown) => Schema.decodeUnknown(Config)(input)

// 設定の読み込み
export const loadConfig = Effect.gen(function* () {
  const config = yield* validateConfig(defaultConfig)
  return config
})