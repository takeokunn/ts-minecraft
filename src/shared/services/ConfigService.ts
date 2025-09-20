import { Context, Effect, Layer, Schema, Match } from 'effect'

// 設定スキーマ定義
export const GameConfig = Schema.Struct({
  fps: Schema.Number.pipe(Schema.between(30, 144)),
  tickRate: Schema.Number.pipe(Schema.between(10, 60)),
  renderDistance: Schema.Number.pipe(Schema.between(2, 32)),
  chunkSize: Schema.Number.pipe(Schema.positive()),
  gravity: Schema.Number,
  playerSpeed: Schema.Number.pipe(Schema.positive()),
  jumpHeight: Schema.Number.pipe(Schema.positive()),
})
export type GameConfig = Schema.Schema.Type<typeof GameConfig>

export const RenderConfig = Schema.Struct({
  resolution: Schema.Struct({
    width: Schema.Number.pipe(Schema.positive()),
    height: Schema.Number.pipe(Schema.positive()),
  }),
  quality: Schema.Literal('low', 'medium', 'high', 'ultra'),
  shadows: Schema.Boolean,
  antialiasing: Schema.Boolean,
  viewDistance: Schema.Number.pipe(Schema.between(2, 32)),
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  vsync: Schema.Boolean,
})
export type RenderConfig = Schema.Schema.Type<typeof RenderConfig>

export const DebugConfig = Schema.Struct({
  enabled: Schema.Boolean,
  showFps: Schema.Boolean,
  showChunkBorders: Schema.Boolean,
  showHitboxes: Schema.Boolean,
  showCoordinates: Schema.Boolean,
  wireframeMode: Schema.Boolean,
  logLevel: Schema.Literal('debug', 'info', 'warn', 'error'),
})
export type DebugConfig = Schema.Schema.Type<typeof DebugConfig>

// Service定義
export interface ConfigService {
  readonly gameConfig: GameConfig
  readonly renderConfig: RenderConfig
  readonly debugConfig: DebugConfig
  readonly getConfig: <K extends keyof Pick<ConfigService, 'gameConfig' | 'renderConfig' | 'debugConfig'>>(
    key: K
  ) => Effect.Effect<Pick<ConfigService, 'gameConfig' | 'renderConfig' | 'debugConfig'>[K]>
  readonly updateConfig: <K extends keyof Pick<ConfigService, 'gameConfig' | 'renderConfig' | 'debugConfig'>>(
    key: K,
    value: Pick<ConfigService, 'gameConfig' | 'renderConfig' | 'debugConfig'>[K]
  ) => Effect.Effect<void>
}

// Config Key タイプ定義
export type ConfigKey = keyof Pick<ConfigService, 'gameConfig' | 'renderConfig' | 'debugConfig'>

// Context定義
export const ConfigService = Context.GenericTag<ConfigService>('@app/services/ConfigService')

// デフォルト設定値
const defaultGameConfig: GameConfig = {
  fps: 60,
  tickRate: 20,
  renderDistance: 8,
  chunkSize: 16,
  gravity: -9.81,
  playerSpeed: 4.317,
  jumpHeight: 1.25,
}

const defaultRenderConfig: RenderConfig = {
  resolution: {
    width: 1920,
    height: 1080,
  },
  quality: 'high',
  shadows: true,
  antialiasing: true,
  viewDistance: 8,
  fov: 75,
  vsync: true,
}

const defaultDebugConfig: DebugConfig = {
  enabled: false,
  showFps: false,
  showChunkBorders: false,
  showHitboxes: false,
  showCoordinates: false,
  wireframeMode: false,
  logLevel: 'info',
}

// Service実装（Live Layer）
export const ConfigServiceLive = Layer.sync(ConfigService, () => {
  // 環境変数から設定を読み込む（実際のプロダクションでは環境変数やconfigファイルから読み込む）
  const loadFromEnv = <T>(envKey: string, defaultValue: T, schema: Schema.Schema<T>): T => {
    const envValue = process.env[envKey]
    if (!envValue) return defaultValue

    try {
      const parsed = JSON.parse(envValue)
      return Schema.decodeSync(schema)(parsed)
    } catch {
      return defaultValue
    }
  }

  // ミュータブルな設定ストア（実際のアプリケーションでは、RefやMutableRefを使用することを推奨）
  let currentGameConfig = loadFromEnv('GAME_CONFIG', defaultGameConfig, GameConfig)
  let currentRenderConfig = loadFromEnv('RENDER_CONFIG', defaultRenderConfig, RenderConfig)
  let currentDebugConfig = loadFromEnv('DEBUG_CONFIG', defaultDebugConfig, DebugConfig)

  return ConfigService.of({
    gameConfig: currentGameConfig,
    renderConfig: currentRenderConfig,
    debugConfig: currentDebugConfig,

    getConfig: (key) => {
      return Match.value(key as ConfigKey).pipe(
        Match.when('gameConfig' as const, () => Effect.succeed(currentGameConfig)),
        Match.when('renderConfig' as const, () => Effect.succeed(currentRenderConfig)),
        Match.when('debugConfig' as const, () => Effect.succeed(currentDebugConfig)),
        Match.exhaustive
      ) as any
    },

    updateConfig: (key, value) =>
      Effect.sync(() => {
        Match.value(key as ConfigKey).pipe(
          Match.when('gameConfig' as const, () => {
            currentGameConfig = value as GameConfig
          }),
          Match.when('renderConfig' as const, () => {
            currentRenderConfig = value as RenderConfig
          }),
          Match.when('debugConfig' as const, () => {
            currentDebugConfig = value as DebugConfig
          }),
          Match.exhaustive
        )
      }),
  })
})

// テスト用のMock Layer
export const ConfigServiceTest = Layer.succeed(
  ConfigService,
  ConfigService.of({
    gameConfig: defaultGameConfig,
    renderConfig: defaultRenderConfig,
    debugConfig: { ...defaultDebugConfig, enabled: true },
    getConfig: (key) => {
      const configs = {
        gameConfig: defaultGameConfig,
        renderConfig: defaultRenderConfig,
        debugConfig: { ...defaultDebugConfig, enabled: true },
      }
      return Effect.succeed(configs[key])
    },
    updateConfig: () => Effect.succeed(undefined),
  })
)
