import { Config } from '../schemas/Config'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'

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
