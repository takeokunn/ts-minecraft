/**
 * @fileoverview GenerationSessionBuilder Pure Functions
 *
 * GenerationSessionBuilderの機能をpure functionsとして実装します。
 * すべての関数は不変性を保証し、新しい状態オブジェクトを返します。
 */

import type * as GenerationSession from '@domain/world/aggregate/generation_session'
import type * as WorldGenerator from '@domain/world/aggregate/world_generator'
import * as Coordinates from '@domain/world/value_object/coordinates/index'
import type { JsonValue } from '@shared/schema/json'
import { Duration, Effect, Function, Match, Option, ReadonlyArray } from 'effect'
import type { CreateSessionParams, SessionFactoryError, SessionTemplateType } from './factory'
import { GenerationSessionFactoryTag, SessionFactoryError as SessionFactoryErrorFactory } from './factory'
import type { GenerationSessionBuilderState, SessionValidationState } from './session_builder_state'

// ================================
// Default Configurations
// ================================

/**
 * デフォルトのセッション設定を取得
 */
const getDefaultConfiguration = (): GenerationSession.SessionConfiguration => ({
  maxConcurrentChunks: 4,
  chunkBatchSize: 8,
  retryPolicy: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
  timeoutPolicy: {
    chunkTimeoutMs: 30000,
    sessionTimeoutMs: 600000,
    gracefulShutdownMs: 5000,
  },
  priorityPolicy: {
    enablePriorityQueuing: false,
    priorityThreshold: 5,
    highPriorityWeight: 2.0,
  },
})

/**
 * デフォルトの生成オプションを取得
 */
const getDefaultOptions = (): GenerationSession.GenerationRequest['options'] => ({
  includeStructures: true,
  includeCaves: true,
  includeOres: true,
  generateVegetation: true,
  applyPostProcessing: true,
})

// ================================
// Coordinate Management Functions
// ================================

/**
 * 座標リストを設定
 */
export const forCoordinates = (
  state: GenerationSessionBuilderState,
  coordinates: readonly Coordinates.ChunkCoordinate[]
): GenerationSessionBuilderState => ({
  ...state,
  coordinates: [...coordinates],
})

/**
 * 座標を追加
 */
export const addCoordinate = (
  state: GenerationSessionBuilderState,
  coordinate: Coordinates.ChunkCoordinate
): GenerationSessionBuilderState => ({
  ...state,
  coordinates: [...(state.coordinates ?? []), coordinate],
})

/**
 * エリアの座標を追加
 */
export const addArea = (
  state: GenerationSessionBuilderState,
  center: Coordinates.ChunkCoordinate,
  radius: number
): GenerationSessionBuilderState => {
  const areaCoordinates = generateAreaCoordinates(center, radius)
  return {
    ...state,
    coordinates: [...(state.coordinates ?? []), ...areaCoordinates],
  }
}

/**
 * グリッドの座標を追加
 */
export const addGrid = (
  state: GenerationSessionBuilderState,
  topLeft: Coordinates.ChunkCoordinate,
  bottomRight: Coordinates.ChunkCoordinate
): GenerationSessionBuilderState => {
  const gridCoordinates = generateGridCoordinates(topLeft, bottomRight)
  return {
    ...state,
    coordinates: [...(state.coordinates ?? []), ...gridCoordinates],
  }
}

// ================================
// Execution Configuration Functions
// ================================

/**
 * 実行モードを設定
 */
export const withExecutionMode = (
  state: GenerationSessionBuilderState,
  mode: 'sync' | 'async' | 'streaming'
): GenerationSessionBuilderState => ({
  ...state,
  executionMode: mode,
})

/**
 * 優先度を設定
 */
export const withPriority = (
  state: GenerationSessionBuilderState,
  priority: number
): GenerationSessionBuilderState => ({
  ...state,
  priority: Math.max(1, Math.min(10, priority)),
})

/**
 * ジェネレーターを設定
 */
export const withGenerator = (
  state: GenerationSessionBuilderState,
  generatorId: WorldGenerator.WorldGeneratorId
): GenerationSessionBuilderState => ({
  ...state,
  generatorId,
})

// ================================
// Session Configuration Functions
// ================================

/**
 * セッション設定を設定
 */
export const withConfiguration = (
  state: GenerationSessionBuilderState,
  config: GenerationSession.SessionConfiguration
): GenerationSessionBuilderState => ({
  ...state,
  configuration: config,
})

/**
 * 最大並行チャンク数を設定
 */
export const withMaxConcurrentChunks = (
  state: GenerationSessionBuilderState,
  count: number
): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    maxConcurrentChunks: Math.max(1, Math.min(16, count)),
  },
})

/**
 * バッチサイズを設定
 */
export const withBatchSize = (state: GenerationSessionBuilderState, size: number): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    chunkBatchSize: Math.max(1, Math.min(64, size)),
  },
})

/**
 * タイムアウトを設定
 */
export const withTimeout = (
  state: GenerationSessionBuilderState,
  chunkTimeoutMs: number,
  sessionTimeoutMs?: number
): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    timeoutPolicy: {
      chunkTimeoutMs: Math.max(1000, chunkTimeoutMs),
      sessionTimeoutMs: sessionTimeoutMs ?? Math.max(60000, chunkTimeoutMs * 10),
      gracefulShutdownMs: Math.min(5000, chunkTimeoutMs / 2),
    },
  },
})

// ================================
// Retry Policy Functions
// ================================

/**
 * 再試行ポリシーを設定
 */
export const withRetryPolicy = (
  state: GenerationSessionBuilderState,
  maxAttempts: number,
  strategy: 'linear' | 'exponential' | 'constant' = 'exponential',
  baseDelayMs: number = 1000
): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    retryPolicy: {
      maxAttempts: Math.max(1, Math.min(10, maxAttempts)),
      backoffStrategy: strategy,
      baseDelayMs: Math.max(100, baseDelayMs),
      maxDelayMs: Math.max(baseDelayMs * 2, 30000),
    },
  },
})

// ================================
// Priority Policy Functions
// ================================

/**
 * 優先度キューイングを有効化
 */
export const enablePriorityQueuing = (
  state: GenerationSessionBuilderState,
  threshold: number = 5,
  weight: number = 2.0
): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    priorityPolicy: {
      enablePriorityQueuing: true,
      priorityThreshold: Math.max(1, Math.min(10, threshold)),
      highPriorityWeight: Math.max(1.0, Math.min(10.0, weight)),
    },
  },
})

/**
 * 優先度キューイングを無効化
 */
export const disablePriorityQueuing = (state: GenerationSessionBuilderState): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    priorityPolicy: {
      enablePriorityQueuing: false,
      priorityThreshold: 5,
      highPriorityWeight: 1.0,
    },
  },
})

// ================================
// Generation Options Functions
// ================================

/**
 * 生成オプションを設定
 */
export const withOptions = (
  state: GenerationSessionBuilderState,
  options: GenerationSession.GenerationRequest['options']
): GenerationSessionBuilderState => ({
  ...state,
  options,
})

/**
 * 構造物生成を有効化/無効化
 */
export const enableStructures = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  options: {
    ...getDefaultOptions(),
    ...state.options,
    includeStructures: enable,
  },
})

/**
 * 洞窟生成を有効化/無効化
 */
export const enableCaves = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  options: {
    ...getDefaultOptions(),
    ...state.options,
    includeCaves: enable,
  },
})

/**
 * 鉱石生成を有効化/無効化
 */
export const enableOres = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  options: {
    ...getDefaultOptions(),
    ...state.options,
    includeOres: enable,
  },
})

/**
 * 植生生成を有効化/無効化
 */
export const enableVegetation = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  options: {
    ...getDefaultOptions(),
    ...state.options,
    generateVegetation: enable,
  },
})

/**
 * ポストプロセッシングを有効化/無効化
 */
export const enablePostProcessing = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  options: {
    ...getDefaultOptions(),
    ...state.options,
    applyPostProcessing: enable,
  },
})

// ================================
// Monitoring Functions
// ================================

/**
 * 進捗トラッキングを有効化/無効化
 */
export const enableProgressTracking = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  enableProgressTracking: enable,
})

/**
 * 詳細ロギングを有効化/無効化
 */
export const enableDetailedLogging = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  enableDetailedLogging: enable,
})

/**
 * メトリクスを有効化/無効化
 */
export const enableMetrics = (
  state: GenerationSessionBuilderState,
  enable: boolean = true
): GenerationSessionBuilderState => ({
  ...state,
  enableMetrics: enable,
})

// ================================
// Recovery Functions
// ================================

/**
 * 自動復旧を有効化/無効化
 */
export const enableAutoRecovery = (
  state: GenerationSessionBuilderState,
  enable: boolean = true,
  checkpointInterval?: Duration.Duration
): GenerationSessionBuilderState => ({
  ...state,
  enableAutoRecovery: enable,
  checkpointInterval: checkpointInterval ?? Duration.seconds(30),
})

// ================================
// Template Functions
// ================================

/**
 * テンプレート設定を取得
 */
const getTemplateConfig = (template: SessionTemplateType): Partial<GenerationSessionBuilderState> =>
  Function.pipe(
    Match.value(template),
    Match.when('single_chunk', () => ({
      executionMode: 'sync' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 1,
        chunkBatchSize: 1,
      },
      enableProgressTracking: false,
    })),
    Match.when('area_generation', () => ({
      executionMode: 'async' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 4,
        chunkBatchSize: 16,
      },
      enableProgressTracking: true,
    })),
    Match.when('world_exploration', () => ({
      executionMode: 'streaming' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 8,
        chunkBatchSize: 4,
      },
      options: {
        ...getDefaultOptions(),
        includeStructures: true,
        includeCaves: false,
        includeOres: false,
        generateVegetation: false,
        applyPostProcessing: false,
      },
    })),
    Match.when('structure_placement', () => ({
      executionMode: 'async' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 2,
        chunkBatchSize: 8,
      },
      options: {
        ...getDefaultOptions(),
        includeStructures: true,
        includeCaves: false,
        includeOres: false,
        applyPostProcessing: true,
      },
    })),
    Match.when('terrain_modification', () => ({
      executionMode: 'sync' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 1,
        chunkBatchSize: 1,
      },
      options: {
        ...getDefaultOptions(),
        includeStructures: false,
        includeCaves: true,
        includeOres: true,
        generateVegetation: true,
      },
    })),
    Match.when('bulk_generation', () => ({
      executionMode: 'async' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 16,
        chunkBatchSize: 32,
      },
      options: {
        ...getDefaultOptions(),
        includeStructures: false,
        includeCaves: false,
        includeOres: false,
        generateVegetation: false,
        applyPostProcessing: false,
      },
      enableProgressTracking: false,
      enableDetailedLogging: false,
    })),
    Match.when('streaming_generation', () => ({
      executionMode: 'streaming' as const,
      configuration: {
        ...getDefaultConfiguration(),
        maxConcurrentChunks: 2,
        chunkBatchSize: 1,
      },
      enableProgressTracking: true,
      options: {
        ...getDefaultOptions(),
        applyPostProcessing: false,
      },
    })),
    Match.exhaustive
  )

/**
 * テンプレートを適用
 */
export const applyTemplate = (
  state: GenerationSessionBuilderState,
  template: SessionTemplateType
): GenerationSessionBuilderState => ({
  ...state,
  ...getTemplateConfig(template),
})

/**
 * カスタムテンプレートを適用
 */
export const applyCustomTemplate = (
  state: GenerationSessionBuilderState,
  config: Partial<CreateSessionParams>
): GenerationSessionBuilderState => ({
  ...state,
  configuration: config.configuration ?? state.configuration,
  executionMode: config.executionMode ?? state.executionMode,
  priority: config.priority ?? state.priority,
  enableProgressTracking: config.enableProgressTracking ?? state.enableProgressTracking,
  enableDetailedLogging: config.enableDetailedLogging ?? state.enableDetailedLogging,
  enableMetrics: config.enableMetrics ?? state.enableMetrics,
  enableAutoRecovery: config.enableAutoRecovery ?? state.enableAutoRecovery,
  checkpointInterval: config.checkpointInterval ?? state.checkpointInterval,
  customOptions: { ...state.customOptions, ...config.customOptions },
})

// ================================
// Optimization Functions
// ================================

/**
 * 速度最適化
 */
export const optimizeForSpeed = (state: GenerationSessionBuilderState): GenerationSessionBuilderState => ({
  ...state,
  executionMode: 'async',
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    maxConcurrentChunks: 8,
    chunkBatchSize: 16,
  },
  options: {
    ...getDefaultOptions(),
    ...state.options,
    includeStructures: false,
    includeCaves: false,
    includeOres: false,
    generateVegetation: false,
    applyPostProcessing: false,
  },
  enableProgressTracking: false,
  enableDetailedLogging: false,
})

/**
 * 品質最適化
 */
export const optimizeForQuality = (state: GenerationSessionBuilderState): GenerationSessionBuilderState => ({
  ...state,
  executionMode: 'sync',
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    maxConcurrentChunks: 1,
    chunkBatchSize: 1,
  },
  options: {
    ...getDefaultOptions(),
    ...state.options,
    includeStructures: true,
    includeCaves: true,
    includeOres: true,
    generateVegetation: true,
    applyPostProcessing: true,
  },
  enableProgressTracking: true,
  enableDetailedLogging: true,
})

/**
 * メモリ最適化
 */
export const optimizeForMemory = (state: GenerationSessionBuilderState): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    maxConcurrentChunks: 2,
    chunkBatchSize: 4,
  },
  enableAutoRecovery: true,
  checkpointInterval: Duration.seconds(15),
})

/**
 * 安定性最適化
 */
export const optimizeForStability = (state: GenerationSessionBuilderState): GenerationSessionBuilderState => ({
  ...state,
  configuration: {
    ...getDefaultConfiguration(),
    ...state.configuration,
    maxConcurrentChunks: 2,
    retryPolicy: {
      maxAttempts: 5,
      backoffStrategy: 'exponential',
      baseDelayMs: 2000,
      maxDelayMs: 30000,
    },
  },
  enableAutoRecovery: true,
  enableProgressTracking: true,
  checkpointInterval: Duration.seconds(10),
})

// ================================
// Custom Options Functions
// ================================

/**
 * メタデータを設定
 */
export const withMetadata = (
  state: GenerationSessionBuilderState,
  metadata: Record<string, JsonValue>
): GenerationSessionBuilderState => ({
  ...state,
  metadata: { ...state.metadata, ...metadata },
})

/**
 * カスタムオプションを追加
 */
export const withCustomOption = (
  state: GenerationSessionBuilderState,
  key: string,
  value: JsonValue
): GenerationSessionBuilderState => ({
  ...state,
  customOptions: { ...state.customOptions, [key]: value },
})

/**
 * カスタムオプションを設定
 */
export const withCustomOptions = (
  state: GenerationSessionBuilderState,
  options: Record<string, JsonValue>
): GenerationSessionBuilderState => ({
  ...state,
  customOptions: { ...state.customOptions, ...options },
})

// ================================
// Conditional Functions
// ================================

/**
 * 条件付き設定（条件が真の場合に設定関数を適用）
 */
export const when = (
  state: GenerationSessionBuilderState,
  condition: boolean,
  configureFn: (state: GenerationSessionBuilderState) => GenerationSessionBuilderState
): GenerationSessionBuilderState => (condition ? configureFn(state) : state)

/**
 * 条件付き設定（条件が偽の場合に設定関数を適用）
 */
export const unless = (
  state: GenerationSessionBuilderState,
  condition: boolean,
  configureFn: (state: GenerationSessionBuilderState) => GenerationSessionBuilderState
): GenerationSessionBuilderState => (!condition ? configureFn(state) : state)

// ================================
// Validation Functions
// ================================

/**
 * リソース使用量を推定
 */
export const estimateResources = (
  state: GenerationSessionBuilderState
): Effect.Effect<SessionValidationState['estimatedResourceUsage'], SessionFactoryError> => {
  const chunkCount = state.coordinates?.length ?? 0
  const concurrentChunks = state.configuration?.maxConcurrentChunks ?? 4
  const batchSize = state.configuration?.chunkBatchSize ?? 8

  const baseMemory = 50
  const memoryPerChunk = 2
  const memoryConcurrency = concurrentChunks * 10

  const baseCpu = 20
  const cpuPerChunk = chunkCount * 0.5
  const cpuConcurrency = concurrentChunks * 5

  const storagePerChunk = 1

  return Effect.succeed({
    memory: baseMemory + memoryPerChunk * Math.min(chunkCount, batchSize) + memoryConcurrency,
    cpu: Math.min(100, baseCpu + cpuPerChunk + cpuConcurrency),
    storage: chunkCount * storagePerChunk,
  })
}

/**
 * 推定所要時間を計算
 */
const calculateEstimatedDuration = (state: GenerationSessionBuilderState): Duration.Duration => {
  const chunkCount = state.coordinates?.length ?? 0
  const concurrentChunks = state.configuration?.maxConcurrentChunks ?? 4

  const baseTimePerChunk = 2000
  const totalTime = (chunkCount / concurrentChunks) * baseTimePerChunk

  return Duration.millis(totalTime)
}

/**
 * セッションを検証
 */
export const validate = (
  state: GenerationSessionBuilderState
): Effect.Effect<SessionValidationState, SessionFactoryError> =>
  Effect.gen(function* () {
    const coordinateErrors = Function.pipe(
      Match.value(state.coordinates ?? []),
      Match.when(
        (coordinates) => coordinates.length === 0,
        () => ['No coordinates specified for generation']
      ),
      Match.orElse(() => [] as string[])
    )

    const configurationWarnings = Function.pipe(
      Match.value({
        executionMode: state.executionMode,
        maxConcurrentChunks: state.configuration?.maxConcurrentChunks,
      }),
      Match.when(
        ({ executionMode, maxConcurrentChunks }) =>
          executionMode === 'sync' && maxConcurrentChunks !== undefined && maxConcurrentChunks > 1,
        () => ['Sync execution mode with multiple concurrent chunks may not be optimal']
      ),
      Match.orElse(() => [] as string[])
    )

    // リソース推定
    const estimatedResourceUsage = yield* estimateResources(state)
    const estimatedDuration = calculateEstimatedDuration(state)

    const resourceWarnings = Function.pipe(
      Match.value(estimatedResourceUsage.memory),
      Match.when(
        (memory) => memory > 1024,
        () => ['High memory usage estimated']
      ),
      Match.orElse(() => [] as string[])
    )

    const errors = coordinateErrors
    const warnings = [...configurationWarnings, ...resourceWarnings]

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      estimatedDuration,
      estimatedResourceUsage,
    }
  })

/**
 * 状態が有効かチェック
 */
export const isValid = (state: GenerationSessionBuilderState): Effect.Effect<boolean, SessionFactoryError> =>
  Effect.map(validate(state), (validationState) => validationState.isValid)

// ================================
// Build Functions (Effect-returning)
// ================================

/**
 * GenerationRequestを構築
 */
export const buildRequest = (
  state: GenerationSessionBuilderState
): Effect.Effect<GenerationSession.GenerationRequest, SessionFactoryError> =>
  Effect.succeed({
    coordinates: state.coordinates ?? [],
    priority: state.priority ?? 5,
    options: state.options,
    metadata: state.metadata,
  })

/**
 * CreateSessionParamsを構築
 */
export const buildParams = (
  state: GenerationSessionBuilderState
): Effect.Effect<CreateSessionParams, SessionFactoryError> =>
  Effect.gen(function* () {
    const request = yield* buildRequest(state)

    return {
      request,
      configuration: state.configuration,
      generatorId: state.generatorId,
      executionMode: state.executionMode,
      priority: state.priority,
      enableProgressTracking: state.enableProgressTracking,
      enableDetailedLogging: state.enableDetailedLogging,
      enableMetrics: state.enableMetrics,
      enableAutoRecovery: state.enableAutoRecovery,
      checkpointInterval: state.checkpointInterval,
      customOptions: state.customOptions,
    }
  })

/**
 * GenerationSessionを構築
 */
export const build = (
  state: GenerationSessionBuilderState
): Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError> =>
  Effect.gen(function* () {
    const validationState = yield* validate(state)

    yield* Function.pipe(
      Match.value(validationState),
      Match.when(
        ({ isValid }) => !isValid,
        ({ errors }) =>
          Effect.fail(
            SessionFactoryErrorFactory.configurationInvalid(
              `Session validation failed: ${errors.join(', ')}`
            )
          )
      ),
      Match.orElse(() => Effect.void)
    )

    const params = yield* buildParams(state)

    const factory = yield* Effect.service(GenerationSessionFactoryTag)

    return yield* factory.create(params)
  })

// ================================
// Helper Functions
// ================================

/**
 * エリア座標を生成
 */
function generateAreaCoordinates(
  center: Coordinates.ChunkCoordinate,
  radius: number
): readonly Coordinates.ChunkCoordinate[] {
  return Function.pipe(
    ReadonlyArray.range(-radius, radius + 1),
    ReadonlyArray.flatMap((x) =>
      Function.pipe(
        ReadonlyArray.range(-radius, radius + 1),
        ReadonlyArray.filterMap((z) => {
          return Function.pipe(
            Match.value(x * x + z * z),
            Match.when(
              (distanceSquared) => distanceSquared > radius * radius,
              () => Option.none<Coordinates.ChunkCoordinate>()
            ),
            Match.orElse(() =>
              Option.some(Coordinates.createChunkCoordinate(center.x + x, center.z + z))
            )
          )
        })
      )
    )
  )
}

/**
 * グリッド座標を生成
 */
function generateGridCoordinates(
  topLeft: Coordinates.ChunkCoordinate,
  bottomRight: Coordinates.ChunkCoordinate
): readonly Coordinates.ChunkCoordinate[] {
  return Function.pipe(
    ReadonlyArray.range(topLeft.x, bottomRight.x + 1),
    ReadonlyArray.flatMap((x) =>
      Function.pipe(
        ReadonlyArray.range(topLeft.z, bottomRight.z + 1),
        ReadonlyArray.map((z) => Coordinates.createChunkCoordinate(x, z))
      )
    )
  )
}
