import { Schema } from 'effect'

// ===== ブランド定義 =====

export const FramesPerSecond = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('FramesPerSecond'))
export type FramesPerSecond = Schema.Schema.Type<typeof FramesPerSecond>

export const TargetFramesPerSecond = Schema.Number.pipe(
  Schema.int(),
  Schema.between(30, 240),
  Schema.brand('TargetFramesPerSecond')
)
export type TargetFramesPerSecond = Schema.Schema.Type<typeof TargetFramesPerSecond>

export const FrameCount = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('FrameCount'))
export type FrameCount = Schema.Schema.Type<typeof FrameCount>

// Re-export from units
export { MillisecondsSchema as Milliseconds, type Milliseconds } from '../domain/shared/value_object/units'

export const MemoryBytes = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('MemoryBytes'))
export type MemoryBytes = Schema.Schema.Type<typeof MemoryBytes>

export const CpuPercentage = Schema.Number.pipe(Schema.between(0, 100), Schema.brand('CpuPercentage'))
export type CpuPercentage = Schema.Schema.Type<typeof CpuPercentage>

export const ResourcePercentage = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('ResourcePercentage'))
export type ResourcePercentage = Schema.Schema.Type<typeof ResourcePercentage>

// Re-export from units
export { TimestampSchema as Timestamp, type Timestamp } from '../domain/shared/value_object/units'

export const SlotCount = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('SlotCount'))
export type SlotCount = Schema.Schema.Type<typeof SlotCount>

// ===== アプリケーションライフサイクル =====

export const ApplicationLifecycleState = Schema.Literal(
  'Uninitialized',
  'Initializing',
  'Initialized',
  'Starting',
  'Running',
  'Pausing',
  'Paused',
  'Resuming',
  'Stopping',
  'Stopped',
  'Error'
)
export type ApplicationLifecycleState = Schema.Schema.Type<typeof ApplicationLifecycleState>

// ===== アプリケーション設定 =====

export const RenderingConfigSchema = Schema.Struct({
  targetFps: TargetFramesPerSecond,
  enableVSync: Schema.Boolean,
  antialiasing: Schema.Boolean,
  shadowMapping: Schema.Boolean,
  webgl2: Schema.Boolean,
})
export type RenderingConfig = Schema.Schema.Type<typeof RenderingConfigSchema>

export const GameLoopConfigSchema = Schema.Struct({
  updateInterval: Milliseconds,
  maxDeltaTime: Milliseconds,
  enableFixedTimeStep: Schema.Boolean,
  fixedTimeStep: Milliseconds,
})
export type GameLoopConfig = Schema.Schema.Type<typeof GameLoopConfigSchema>

export const InputConfigSchema = Schema.Struct({
  mouseSensitivity: Schema.Number.pipe(Schema.between(0.1, 10)),
  keyRepeatDelay: Milliseconds,
  enableGamepad: Schema.Boolean,
})
export type InputConfig = Schema.Schema.Type<typeof InputConfigSchema>

export const PerformanceConfigSchema = Schema.Struct({
  enableMetrics: Schema.Boolean,
  memoryLimit: MemoryBytes,
  gcThreshold: ResourcePercentage,
})
export type PerformanceConfig = Schema.Schema.Type<typeof PerformanceConfigSchema>

export const DebugConfigSchema = Schema.Struct({
  enableLogging: Schema.Boolean,
  logLevel: Schema.Literal('debug', 'info', 'warn', 'error'),
  showPerformanceStats: Schema.Boolean,
  enableHotReload: Schema.Boolean,
})
export type DebugConfig = Schema.Schema.Type<typeof DebugConfigSchema>

export const GameApplicationConfig = Schema.Struct({
  rendering: RenderingConfigSchema,
  gameLoop: GameLoopConfigSchema,
  input: InputConfigSchema,
  performance: PerformanceConfigSchema,
  debug: DebugConfigSchema,
})
export type GameApplicationConfig = Schema.Schema.Type<typeof GameApplicationConfig>
export type GameApplicationConfigInput = Schema.Schema.Input<typeof GameApplicationConfig>

// ===== システム状態 =====

export const SystemStatus = Schema.Literal('idle', 'initializing', 'running', 'paused', 'error')
export type SystemStatus = Schema.Schema.Type<typeof SystemStatus>

export const SystemStatusValues: {
  readonly Idle: SystemStatus
  readonly Initializing: SystemStatus
  readonly Running: SystemStatus
  readonly Paused: SystemStatus
  readonly Error: SystemStatus
} = {
  Idle: 'idle',
  Initializing: 'initializing',
  Running: 'running',
  Paused: 'paused',
  Error: 'error',
}

export const GameLoopState = Schema.Struct({
  status: SystemStatus,
  currentFps: FramesPerSecond,
  targetFps: TargetFramesPerSecond,
  frameCount: FrameCount,
  totalTime: Milliseconds,
})
export type GameLoopState = Schema.Schema.Type<typeof GameLoopState>

export const RendererState = Schema.Struct({
  status: SystemStatus,
  memoryUsage: Schema.Struct({
    geometries: MemoryBytes,
    textures: MemoryBytes,
    total: MemoryBytes,
  }),
  renderStats: Schema.Struct({
    drawCalls: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    triangles: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    frameTime: Milliseconds,
  }),
})
export type RendererState = Schema.Schema.Type<typeof RendererState>

export const SceneState = Schema.Struct({
  status: SystemStatus,
  currentScene: Schema.optional(Schema.String),
  sceneStack: Schema.Array(Schema.String),
  isTransitioning: Schema.Boolean,
  transitionProgress: ResourcePercentage,
})
export type SceneState = Schema.Schema.Type<typeof SceneState>

export const InputState = Schema.Struct({
  status: SystemStatus,
  connectedDevices: Schema.Struct({
    keyboard: Schema.Boolean,
    mouse: Schema.Boolean,
    gamepad: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
  activeInputs: SlotCount,
})
export type InputState = Schema.Schema.Type<typeof InputState>

export const ECSState = Schema.Struct({
  status: SystemStatus,
  entityCount: SlotCount,
  componentCount: SlotCount,
  systemCount: SlotCount,
  activeQueries: SlotCount,
})
export type ECSState = Schema.Schema.Type<typeof ECSState>

export const HealthStatus = Schema.Literal('healthy', 'unhealthy')
export type HealthStatus = Schema.Schema.Type<typeof HealthStatus>

export const HealthStatusValues: {
  readonly Healthy: HealthStatus
  readonly Unhealthy: HealthStatus
} = {
  Healthy: 'healthy',
  Unhealthy: 'unhealthy',
}

export const SystemHealthCheck = Schema.Struct({
  gameLoop: Schema.Struct({
    status: HealthStatus,
    fps: Schema.optional(FramesPerSecond),
    message: Schema.optional(Schema.String),
  }),
  renderer: Schema.Struct({
    status: HealthStatus,
    memory: Schema.optional(MemoryBytes),
    message: Schema.optional(Schema.String),
  }),
  scene: Schema.Struct({
    status: HealthStatus,
    sceneCount: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
    message: Schema.optional(Schema.String),
  }),
  input: Schema.Struct({
    status: HealthStatus,
    message: Schema.optional(Schema.String),
  }),
  ecs: Schema.Struct({
    status: HealthStatus,
    entityCount: Schema.optional(SlotCount),
    message: Schema.optional(Schema.String),
  }),
})
export type SystemHealthCheck = Schema.Schema.Type<typeof SystemHealthCheck>

export const ErrorSeverity = Schema.Literal('low', 'medium', 'high', 'critical')
export type ErrorSeverity = Schema.Schema.Type<typeof ErrorSeverity>

export const RecordedError = Schema.Struct({
  timestamp: Timestamp,
  system: Schema.String,
  message: Schema.String,
  severity: ErrorSeverity,
})
export type RecordedError = Schema.Schema.Type<typeof RecordedError>

export const GameApplicationState = Schema.Struct({
  lifecycle: ApplicationLifecycleState,
  startTime: Schema.optional(Timestamp),
  uptime: Milliseconds,
  systems: Schema.Struct({
    gameLoop: GameLoopState,
    renderer: RendererState,
    scene: SceneState,
    input: InputState,
    ecs: ECSState,
  }),
  performance: Schema.Struct({
    overallFps: FramesPerSecond,
    memoryUsage: MemoryBytes,
    cpuUsage: CpuPercentage,
    isHealthy: Schema.Boolean,
  }),
  config: GameApplicationConfig,
  lastError: Schema.optional(RecordedError),
})
export type GameApplicationState = Schema.Schema.Type<typeof GameApplicationState>

// ===== デフォルト設定 =====

export const DEFAULT_GAME_APPLICATION_CONFIG: GameApplicationConfig = {
  rendering: {
    targetFps: 60,
    enableVSync: true,
    antialiasing: true,
    shadowMapping: true,
    webgl2: true,
  },
  gameLoop: {
    updateInterval: 16.67,
    maxDeltaTime: 50,
    enableFixedTimeStep: false,
    fixedTimeStep: 16.67,
  },
  input: {
    mouseSensitivity: 1,
    keyRepeatDelay: 500,
    enableGamepad: true,
  },
  performance: {
    enableMetrics: true,
    memoryLimit: 2_048,
    gcThreshold: 0.8,
  },
  debug: {
    enableLogging: true,
    logLevel: 'info',
    showPerformanceStats: false,
    enableHotReload: false,
  },
} as GameApplicationConfig
