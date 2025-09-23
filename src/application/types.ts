import { Schema } from 'effect'

/**
 * Application Layer Types - ゲームアプリケーション統合の型定義
 *
 * Issue #176: Application Layer Integration
 * Effect-TS Schema.Structによる型安全性とバリデーション
 */

// ===== アプリケーションライフサイクル =====

/**
 * アプリケーションライフサイクル状態
 *
 * アプリケーションの現在の実行段階を表す
 */
export const ApplicationLifecycleState = Schema.Literal(
  'Uninitialized', // 未初期化
  'Initializing', // 初期化中
  'Initialized', // 初期化完了
  'Starting', // 開始中
  'Running', // 実行中
  'Pausing', // 一時停止中
  'Paused', // 一時停止
  'Resuming', // 再開中
  'Stopping', // 停止中
  'Stopped', // 停止
  'Error' // エラー状態
)
export type ApplicationLifecycleState = Schema.Schema.Type<typeof ApplicationLifecycleState>

// ===== アプリケーション設定 =====

/**
 * ゲームアプリケーション設定
 *
 * 統合システム全体の動作を制御する設定
 */
export const GameApplicationConfig = Schema.Struct({
  // レンダリング設定
  rendering: Schema.Struct({
    targetFps: Schema.Number.pipe(Schema.int(), Schema.between(30, 144)),
    enableVSync: Schema.Boolean,
    antialiasing: Schema.Boolean,
    shadowMapping: Schema.Boolean,
    webgl2: Schema.Boolean,
  }),

  // ゲームループ設定
  gameLoop: Schema.Struct({
    updateInterval: Schema.Number.pipe(Schema.positive()),
    maxDeltaTime: Schema.Number.pipe(Schema.positive()),
    enableFixedTimeStep: Schema.Boolean,
    fixedTimeStep: Schema.Number.pipe(Schema.positive()),
  }),

  // 入力設定
  input: Schema.Struct({
    mouseSensitivity: Schema.Number.pipe(Schema.between(0.1, 10.0)),
    keyRepeatDelay: Schema.Number.pipe(Schema.nonNegative()),
    enableGamepad: Schema.Boolean,
  }),

  // パフォーマンス設定
  performance: Schema.Struct({
    enableMetrics: Schema.Boolean,
    memoryLimit: Schema.Number.pipe(Schema.int(), Schema.positive()),
    gcThreshold: Schema.Number.pipe(Schema.between(0.1, 1.0)),
  }),

  // デバッグ設定
  debug: Schema.Struct({
    enableLogging: Schema.Boolean,
    logLevel: Schema.Literal('debug', 'info', 'warn', 'error'),
    showPerformanceStats: Schema.Boolean,
    enableHotReload: Schema.Boolean,
  }),
})
export type GameApplicationConfig = Schema.Schema.Type<typeof GameApplicationConfig>

// ===== システム状態 =====

/**
 * 個別システムの状態
 *
 * 各統合システムの現在状態を表す
 */
export const SystemStatus = Schema.Literal('idle', 'initializing', 'running', 'paused', 'error')
export type SystemStatus = Schema.Schema.Type<typeof SystemStatus>

/**
 * ゲームループ状態の概要
 */
export const GameLoopState = Schema.Struct({
  status: SystemStatus,
  currentFps: Schema.Number.pipe(Schema.nonNegative()),
  targetFps: Schema.Number.pipe(Schema.int(), Schema.positive()),
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalTime: Schema.Number.pipe(Schema.nonNegative()),
})
export type GameLoopState = Schema.Schema.Type<typeof GameLoopState>

/**
 * レンダラー状態の概要
 */
export const RendererState = Schema.Struct({
  status: SystemStatus,
  memoryUsage: Schema.Struct({
    geometries: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    textures: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    total: Schema.Number.pipe(Schema.nonNegative()),
  }),
  renderStats: Schema.Struct({
    drawCalls: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    triangles: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    frameTime: Schema.Number.pipe(Schema.nonNegative()),
  }),
})
export type RendererState = Schema.Schema.Type<typeof RendererState>

/**
 * シーン管理状態の概要
 */
export const SceneState = Schema.Struct({
  status: SystemStatus,
  currentScene: Schema.optional(Schema.String),
  sceneStack: Schema.Array(Schema.String),
  isTransitioning: Schema.Boolean,
  transitionProgress: Schema.Number.pipe(Schema.between(0, 1)),
})
export type SceneState = Schema.Schema.Type<typeof SceneState>

/**
 * 入力システム状態の概要
 */
export const InputState = Schema.Struct({
  status: SystemStatus,
  connectedDevices: Schema.Struct({
    keyboard: Schema.Boolean,
    mouse: Schema.Boolean,
    gamepad: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
  activeInputs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type InputState = Schema.Schema.Type<typeof InputState>

/**
 * ECSシステム状態の概要
 */
export const ECSState = Schema.Struct({
  status: SystemStatus,
  entityCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  componentCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  systemCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  activeQueries: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type ECSState = Schema.Schema.Type<typeof ECSState>

// ===== 統合アプリケーション状態 =====

/**
 * ゲームアプリケーション全体の状態
 *
 * 全統合システムの現在状態を集約
 */
export const GameApplicationState = Schema.Struct({
  // ライフサイクル状態
  lifecycle: ApplicationLifecycleState,

  // 開始時刻とアップタイム
  startTime: Schema.optional(Schema.Number),
  uptime: Schema.Number.pipe(Schema.nonNegative()),

  // 個別システム状態
  systems: Schema.Struct({
    gameLoop: GameLoopState,
    renderer: RendererState,
    scene: SceneState,
    input: InputState,
    ecs: ECSState,
  }),

  // 全体パフォーマンス指標
  performance: Schema.Struct({
    overallFps: Schema.Number.pipe(Schema.nonNegative()),
    memoryUsage: Schema.Number.pipe(Schema.nonNegative()),
    cpuUsage: Schema.Number.pipe(Schema.between(0, 100)),
    isHealthy: Schema.Boolean,
  }),

  // 現在の設定
  config: GameApplicationConfig,

  // 最後のエラー（存在する場合）
  lastError: Schema.optional(
    Schema.Struct({
      timestamp: Schema.Number,
      system: Schema.String,
      message: Schema.String,
      severity: Schema.Literal('low', 'medium', 'high', 'critical'),
    })
  ),
})
export type GameApplicationState = Schema.Schema.Type<typeof GameApplicationState>

// ===== パフォーマンス指標 =====

/**
 * システムヘルスチェック結果
 */
export const SystemHealthCheck = Schema.Struct({
  gameLoop: Schema.Struct({
    status: Schema.Literal('healthy', 'unhealthy'),
    fps: Schema.optional(Schema.Number),
    message: Schema.optional(Schema.String),
  }),
  renderer: Schema.Struct({
    status: Schema.Literal('healthy', 'unhealthy'),
    memory: Schema.optional(Schema.Number),
    message: Schema.optional(Schema.String),
  }),
  scene: Schema.Struct({
    status: Schema.Literal('healthy', 'unhealthy'),
    sceneCount: Schema.optional(Schema.Number),
    message: Schema.optional(Schema.String),
  }),
  input: Schema.Struct({
    status: Schema.Literal('healthy', 'unhealthy'),
    message: Schema.optional(Schema.String),
  }),
  ecs: Schema.Struct({
    status: Schema.Literal('healthy', 'unhealthy'),
    entityCount: Schema.optional(Schema.Number),
    message: Schema.optional(Schema.String),
  }),
})
export type SystemHealthCheck = Schema.Schema.Type<typeof SystemHealthCheck>

// ===== デフォルト設定 =====

/**
 * デフォルトのゲームアプリケーション設定
 */
export const DEFAULT_GAME_APPLICATION_CONFIG: GameApplicationConfig = {
  rendering: {
    targetFps: 60,
    enableVSync: true,
    antialiasing: true,
    shadowMapping: true,
    webgl2: true,
  },
  gameLoop: {
    updateInterval: 16.67, // 60FPS
    maxDeltaTime: 50, // 50ms max
    enableFixedTimeStep: false,
    fixedTimeStep: 16.67,
  },
  input: {
    mouseSensitivity: 1.0,
    keyRepeatDelay: 500,
    enableGamepad: true,
  },
  performance: {
    enableMetrics: true,
    memoryLimit: 2048, // 2GB
    gcThreshold: 0.8, // 80%
  },
  debug: {
    enableLogging: true,
    logLevel: 'info',
    showPerformanceStats: false,
    enableHotReload: false,
  },
}
