import * as Schema from '@effect/schema/Schema'

/**
 * SessionConfigurationBuilder状態スキーマ
 * 全フィールドはoptionalで初期状態は空オブジェクト
 */
export const SessionConfigurationBuilderStateSchema = Schema.Struct({
  maxConcurrentChunks: Schema.optional(Schema.Number),
  chunkBatchSize: Schema.optional(Schema.Number),
  retryPolicy: Schema.optional(
    Schema.Struct({
      maxAttempts: Schema.Number,
      backoffStrategy: Schema.Literal('linear', 'exponential', 'constant'),
      baseDelayMs: Schema.Number,
      maxDelayMs: Schema.Number,
    })
  ),
  timeoutPolicy: Schema.optional(
    Schema.Struct({
      chunkTimeoutMs: Schema.Number,
      sessionTimeoutMs: Schema.Number,
      gracefulShutdownMs: Schema.Number,
    })
  ),
  priorityPolicy: Schema.optional(
    Schema.Struct({
      enablePriorityQueuing: Schema.Boolean,
      priorityThreshold: Schema.Number,
      highPriorityWeight: Schema.Number,
    })
  ),
})

export type SessionConfigurationBuilderState = Schema.Schema.Type<typeof SessionConfigurationBuilderStateSchema>

export type ConfigurationProfile =
  | 'development'
  | 'testing'
  | 'staging'
  | 'production'
  | 'high_performance'
  | 'memory_constrained'
  | 'low_latency'
  | 'batch_processing'

export type HardwareSpec = {
  readonly cpuCores: number
  readonly memoryMB: number
  readonly storageSpeedMBps: number
}

export type LoadCondition = {
  readonly currentCpuUsage: number
  readonly currentMemoryUsage: number
  readonly networkLatencyMs: number
}

export type OptimizationParams = {
  readonly profile: ConfigurationProfile
  readonly hardwareSpec?: HardwareSpec
  readonly loadCondition?: LoadCondition
  readonly prioritizeFor?: 'speed' | 'memory' | 'stability' | 'quality'
  readonly constraints?: {
    readonly maxConcurrentOperations?: number
    readonly maxExecutionTimeMs?: number
    readonly maxMemoryMB?: number
  }
}

/**
 * 初期状態（空オブジェクト）
 */
export const initialSessionConfigurationBuilderState: SessionConfigurationBuilderState = {}
