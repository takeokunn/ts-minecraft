/**
 * @fileoverview GenerationSessionBuilder - Session Builder Pattern
 *
 * GenerationSessionの段階的構築を提供するBuilderパターン実装です。
 * 複雑なセッション設定プロセスを直感的で型安全なAPIに抽象化します。
 *
 * ## 特徴
 * - Fluent API による宣言的セッション構築
 * - 型安全な段階的設定
 * - テンプレート適用とカスタマイズ
 * - 動的優先度調整
 * - リアルタイム検証
 */

import { Effect, Match, Duration } from "effect"
import { pipe } from "effect/Function"
import type * as GenerationSession from "../../aggregate/generation_session/generation-session.js"
import type * as WorldGenerator from "../../aggregate/world_generator/world-generator.js"
import * as Coordinates from "../../value_object/coordinates/index.js"
import { SessionFactoryError, type CreateSessionParams, type SessionTemplateType } from "./factory.js"

// ================================
// Builder State Management
// ================================

interface SessionBuilderState {
  readonly coordinates?: readonly Coordinates.ChunkCoordinate[]
  readonly configuration?: GenerationSession.SessionConfiguration
  readonly generatorId?: WorldGenerator.WorldGeneratorId
  readonly executionMode?: 'sync' | 'async' | 'streaming'
  readonly priority?: number
  readonly options?: GenerationSession.GenerationRequest['options']
  readonly enableProgressTracking?: boolean
  readonly enableDetailedLogging?: boolean
  readonly enableMetrics?: boolean
  readonly enableAutoRecovery?: boolean
  readonly checkpointInterval?: Duration.Duration
  readonly customOptions?: Record<string, unknown>
  readonly metadata?: Record<string, unknown>
}

interface SessionValidationState {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly estimatedDuration: Duration.Duration
  readonly estimatedResourceUsage: {
    memory: number
    cpu: number
    storage: number
  }
}

// ================================
// GenerationSessionBuilder Interface
// ================================

export interface GenerationSessionBuilder {
  // 基本設定
  readonly forCoordinates: (coordinates: readonly Coordinates.ChunkCoordinate[]) => GenerationSessionBuilder
  readonly addCoordinate: (coordinate: Coordinates.ChunkCoordinate) => GenerationSessionBuilder
  readonly addArea: (center: Coordinates.ChunkCoordinate, radius: number) => GenerationSessionBuilder
  readonly addGrid: (topLeft: Coordinates.ChunkCoordinate, bottomRight: Coordinates.ChunkCoordinate) => GenerationSessionBuilder

  // 実行設定
  readonly withExecutionMode: (mode: 'sync' | 'async' | 'streaming') => GenerationSessionBuilder
  readonly withPriority: (priority: number) => GenerationSessionBuilder
  readonly withGenerator: (generatorId: WorldGenerator.WorldGeneratorId) => GenerationSessionBuilder

  // セッション設定
  readonly withConfiguration: (config: GenerationSession.SessionConfiguration) => GenerationSessionBuilder
  readonly withMaxConcurrentChunks: (count: number) => GenerationSessionBuilder
  readonly withBatchSize: (size: number) => GenerationSessionBuilder
  readonly withTimeout: (chunkTimeoutMs: number, sessionTimeoutMs?: number) => GenerationSessionBuilder

  // 再試行設定
  readonly withRetryPolicy: (
    maxAttempts: number,
    strategy?: 'linear' | 'exponential' | 'constant',
    baseDelayMs?: number
  ) => GenerationSessionBuilder

  // 優先度設定
  readonly enablePriorityQueuing: (threshold?: number, weight?: number) => GenerationSessionBuilder
  readonly disablePriorityQueuing: () => GenerationSessionBuilder

  // 生成オプション
  readonly withOptions: (options: GenerationSession.GenerationRequest['options']) => GenerationSessionBuilder
  readonly enableStructures: (enable?: boolean) => GenerationSessionBuilder
  readonly enableCaves: (enable?: boolean) => GenerationSessionBuilder
  readonly enableOres: (enable?: boolean) => GenerationSessionBuilder
  readonly enableVegetation: (enable?: boolean) => GenerationSessionBuilder
  readonly enablePostProcessing: (enable?: boolean) => GenerationSessionBuilder

  // 監視設定
  readonly enableProgressTracking: (enable?: boolean) => GenerationSessionBuilder
  readonly enableDetailedLogging: (enable?: boolean) => GenerationSessionBuilder
  readonly enableMetrics: (enable?: boolean) => GenerationSessionBuilder

  // 回復設定
  readonly enableAutoRecovery: (enable?: boolean, checkpointInterval?: Duration.Duration) => GenerationSessionBuilder

  // テンプレート適用
  readonly applyTemplate: (template: SessionTemplateType) => GenerationSessionBuilder
  readonly applyCustomTemplate: (config: Partial<CreateSessionParams>) => GenerationSessionBuilder

  // 高レベル設定
  readonly optimizeForSpeed: () => GenerationSessionBuilder
  readonly optimizeForQuality: () => GenerationSessionBuilder
  readonly optimizeForMemory: () => GenerationSessionBuilder
  readonly optimizeForStability: () => GenerationSessionBuilder

  // カスタム設定
  readonly withMetadata: (metadata: Record<string, unknown>) => GenerationSessionBuilder
  readonly withCustomOption: (key: string, value: unknown) => GenerationSessionBuilder
  readonly withCustomOptions: (options: Record<string, unknown>) => GenerationSessionBuilder

  // 条件設定
  readonly when: (condition: boolean, configureFn: (builder: GenerationSessionBuilder) => GenerationSessionBuilder) => GenerationSessionBuilder
  readonly unless: (condition: boolean, configureFn: (builder: GenerationSessionBuilder) => GenerationSessionBuilder) => GenerationSessionBuilder

  // 検証
  readonly validate: () => Effect.Effect<SessionValidationState, SessionFactoryError>
  readonly isValid: () => Effect.Effect<boolean, SessionFactoryError>
  readonly estimateResources: () => Effect.Effect<SessionValidationState['estimatedResourceUsage'], SessionFactoryError>

  // 構築
  readonly build: () => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>
  readonly buildParams: () => Effect.Effect<CreateSessionParams, SessionFactoryError>
  readonly buildRequest: () => Effect.Effect<GenerationSession.GenerationRequest, SessionFactoryError>

  // 状態管理
  readonly getState: () => SessionBuilderState
  readonly clone: () => GenerationSessionBuilder
  readonly reset: () => GenerationSessionBuilder
}

// ================================
// Builder Implementation
// ================================

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const defaultConfiguration = (): GenerationSession.SessionConfiguration => ({
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

const defaultOptions = (): GenerationSession.GenerationRequest['options'] => ({
  includeStructures: true,
  includeCaves: true,
  includeOres: true,
  generateVegetation: true,
  applyPostProcessing: true,
})

const mergeConfigurationState = (
  current: SessionBuilderState,
  update: (config: GenerationSession.SessionConfiguration) => GenerationSession.SessionConfiguration
): SessionBuilderState => ({
  ...current,
  configuration: update({
    ...defaultConfiguration(),
    ...current.configuration,
  }),
})

const mergeOptionsState = (
  current: SessionBuilderState,
  update: (options: GenerationSession.GenerationRequest['options']) => GenerationSession.GenerationRequest['options']
): SessionBuilderState => ({
  ...current,
  options: update({
    ...defaultOptions(),
    ...current.options,
  }),
})

const makeBuilder = (state: SessionBuilderState = {}): GenerationSessionBuilder => {
  const withState = (next: SessionBuilderState) => makeBuilder(next)

  const builder: GenerationSessionBuilder = {
    forCoordinates: (coordinates) =>
      withState({
        ...state,
        coordinates: [...coordinates],
      }),
    addCoordinate: (coordinate) =>
      withState({
        ...state,
        coordinates: [...(state.coordinates ?? []), coordinate],
      }),
    addArea: (center, radius) =>
      withState({
        ...state,
        coordinates: [
          ...(state.coordinates ?? []),
          ...generateAreaCoordinates(center, radius),
        ],
      }),
    addGrid: (topLeft, bottomRight) =>
      withState({
        ...state,
        coordinates: [
          ...(state.coordinates ?? []),
          ...generateGridCoordinates(topLeft, bottomRight),
        ],
      }),
    withExecutionMode: (mode) =>
      withState({
        ...state,
        executionMode: mode,
      }),
    withPriority: (priority) =>
      withState({
        ...state,
        priority: clamp(priority, 1, 10),
      }),
    withGenerator: (generatorId) =>
      withState({
        ...state,
        generatorId,
      }),
    withConfiguration: (config) =>
      withState({
        ...state,
        configuration: config,
      }),
    withMaxConcurrentChunks: (count) =>
      withState(
        mergeConfigurationState(state, (config) => ({
          ...config,
          maxConcurrentChunks: clamp(count, 1, 16),
        }))
      ),
    withBatchSize: (size) =>
      withState(
        mergeConfigurationState(state, (config) => ({
          ...config,
          chunkBatchSize: clamp(size, 1, 64),
        }))
      ),
    withTimeout: (chunkTimeoutMs, sessionTimeoutMs) =>
      withState(
        mergeConfigurationState(state, (config) => ({
          ...config,
          timeoutPolicy: {
            chunkTimeoutMs: Math.max(1000, chunkTimeoutMs),
            sessionTimeoutMs:
              sessionTimeoutMs ?? Math.max(60000, chunkTimeoutMs * 10),
            gracefulShutdownMs: Math.min(5000, Math.floor(chunkTimeoutMs / 2)),
          },
        }))
      ),
    withRetryPolicy: (maxAttempts, strategy = 'exponential', baseDelayMs = 1000) =>
      withState(
        mergeConfigurationState(state, (config) => ({
          ...config,
          retryPolicy: {
            maxAttempts: clamp(maxAttempts, 1, 10),
            backoffStrategy: strategy,
            baseDelayMs: Math.max(100, baseDelayMs),
            maxDelayMs: Math.max(baseDelayMs * 2, 30000),
          },
        }))
      ),
    enablePriorityQueuing: (threshold = 5, weight = 2.0) =>
      withState(
        mergeConfigurationState(state, (config) => ({
          ...config,
          priorityPolicy: {
            enablePriorityQueuing: true,
            priorityThreshold: clamp(threshold, 1, 10),
            highPriorityWeight: clamp(weight, 1, 10),
          },
        }))
      ),
    disablePriorityQueuing: () =>
      withState(
        mergeConfigurationState(state, (config) => ({
          ...config,
          priorityPolicy: {
            enablePriorityQueuing: false,
            priorityThreshold: 5,
            highPriorityWeight: 1.0,
          },
        }))
      ),
    withOptions: (options) =>
      withState({
        ...state,
        options,
      }),
    enableStructures: (enable = true) =>
      withState(
        mergeOptionsState(state, (options) => ({
          ...options,
          includeStructures: enable,
        }))
      ),
    enableCaves: (enable = true) =>
      withState(
        mergeOptionsState(state, (options) => ({
          ...options,
          includeCaves: enable,
        }))
      ),
    enableOres: (enable = true) =>
      withState(
        mergeOptionsState(state, (options) => ({
          ...options,
          includeOres: enable,
        }))
      ),
    enableVegetation: (enable = true) =>
      withState(
        mergeOptionsState(state, (options) => ({
          ...options,
          generateVegetation: enable,
        }))
      ),
    enablePostProcessing: (enable = true) =>
      withState(
        mergeOptionsState(state, (options) => ({
          ...options,
          applyPostProcessing: enable,
        }))
      ),
    enableProgressTracking: (enable = true) =>
      withState({
        ...state,
        enableProgressTracking: enable,
      }),
    enableDetailedLogging: (enable = true) =>
      withState({
        ...state,
        enableDetailedLogging: enable,
      }),
    enableMetrics: (enable = true) =>
      withState({
        ...state,
        enableMetrics: enable,
      }),
    enableAutoRecovery: (enable = true, checkpointInterval = Duration.seconds(30)) =>
      withState({
        ...state,
        enableAutoRecovery: enable,
        checkpointInterval,
      }),
    applyTemplate: (template) =>
      pipe(
        template,
        Match.value,
        Match.when('single_chunk', () => applySingleChunkTemplate(builder)),
        Match.when('area_generation', () => applyAreaGenerationTemplate(builder)),
        Match.when('world_exploration', () => applyWorldExplorationTemplate(builder)),
        Match.when('structure_placement', () => applyStructurePlacementTemplate(builder)),
        Match.when('terrain_modification', () => applyTerrainModificationTemplate(builder)),
        Match.when('bulk_generation', () => applyBulkGenerationTemplate(builder)),
        Match.when('streaming_generation', () => applyStreamingGenerationTemplate(builder)),
        Match.orElse(() => builder)
      ),
    applyCustomTemplate: (config) =>
      withState({
        ...state,
        configuration: config.configuration ?? state.configuration,
        executionMode: config.executionMode ?? state.executionMode,
        priority: config.priority ?? state.priority,
        enableProgressTracking: config.enableProgressTracking ?? state.enableProgressTracking,
        enableDetailedLogging: config.enableDetailedLogging ?? state.enableDetailedLogging,
        enableMetrics: config.enableMetrics ?? state.enableMetrics,
        enableAutoRecovery: config.enableAutoRecovery ?? state.enableAutoRecovery,
        checkpointInterval: config.checkpointInterval ?? state.checkpointInterval,
        customOptions: {
          ...(state.customOptions ?? {}),
          ...(config.customOptions ?? {}),
        },
      }),
    optimizeForSpeed: () =>
      builder
        .withExecutionMode('async')
        .withMaxConcurrentChunks(8)
        .withBatchSize(16)
        .enableStructures(false)
        .enableCaves(false)
        .enableOres(false)
        .enableVegetation(false)
        .enablePostProcessing(false)
        .enableProgressTracking(false)
        .enableDetailedLogging(false),
    optimizeForQuality: () =>
      builder
        .withExecutionMode('sync')
        .withMaxConcurrentChunks(1)
        .withBatchSize(1)
        .enableStructures(true)
        .enableCaves(true)
        .enableOres(true)
        .enableVegetation(true)
        .enablePostProcessing(true)
        .enableProgressTracking(true)
        .enableDetailedLogging(true),
    optimizeForMemory: () =>
      builder
        .withMaxConcurrentChunks(2)
        .withBatchSize(4)
        .enableAutoRecovery(true, Duration.seconds(15)),
    optimizeForStability: () =>
      builder
        .withMaxConcurrentChunks(2)
        .withRetryPolicy(5, 'exponential', 2000)
        .enableAutoRecovery(true, Duration.seconds(10))
        .enableProgressTracking(true),
    withMetadata: (metadata) =>
      withState({
        ...state,
        metadata: {
          ...(state.metadata ?? {}),
          ...metadata,
        },
      }),
    withCustomOption: (key, value) =>
      withState({
        ...state,
        customOptions: {
          ...(state.customOptions ?? {}),
          [key]: value,
        },
      }),
    withCustomOptions: (options) =>
      withState({
        ...state,
        customOptions: {
          ...(state.customOptions ?? {}),
          ...options,
        },
      }),
    when: (condition, configureFn) => (condition ? configureFn(builder) : builder),
    unless: (condition, configureFn) => (!condition ? configureFn(builder) : builder),
    validate: () =>
      Effect.gen(function* () {
        const errors: string[] = []
        const warnings: string[] = []

        if (!state.coordinates || state.coordinates.length === 0) {
          errors.push('No coordinates specified for generation')
        }

        if (
          state.executionMode === 'sync' &&
          state.configuration?.maxConcurrentChunks !== undefined &&
          state.configuration.maxConcurrentChunks > 1
        ) {
          warnings.push('Sync execution mode with multiple concurrent chunks may not be optimal')
        }

        const estimatedResourceUsage = yield* builder.estimateResources()
        const estimatedDuration = calculateEstimatedDuration(state)

        if (estimatedResourceUsage.memory > 1024) {
          warnings.push('High memory usage estimated')
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          estimatedDuration,
          estimatedResourceUsage,
        }
      }),
    isValid: () => builder.validate().pipe(Effect.map((validation) => validation.isValid)),
    estimateResources: () => {
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
    },
    build: () =>
      Effect.gen(function* () {
        const validation = yield* builder.validate()
        if (!validation.isValid) {
          return yield* Effect.fail(
            new SessionFactoryError({
              category: 'configuration_invalid',
              message: `Session validation failed: ${validation.errors.join(', ')}`,
            })
          )
        }

        const params = yield* builder.buildParams()

        const factoryModule = yield* Effect.tryPromise({
          try: () => import('./factory.js'),
          catch: (error) =>
            new SessionFactoryError({
              category: 'dependency_missing',
              message: `Failed to load generation session factory: ${String(error)}`,
              cause: error,
            }),
        })

        const factory = yield* Effect.service(factoryModule.GenerationSessionFactoryTag)

        return yield* factory.create(params)
      }),
    buildParams: () =>
      Effect.gen(function* () {
        const request = yield* builder.buildRequest()

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
      }),
    buildRequest: () =>
      Effect.succeed({
        coordinates: state.coordinates ?? [],
        priority: state.priority ?? 5,
        options: state.options,
        metadata: state.metadata,
      }),
    getState: () => ({
      ...state,
      coordinates: state.coordinates ? [...state.coordinates] : undefined,
      configuration: state.configuration ? { ...state.configuration } : undefined,
      options: state.options ? { ...state.options } : undefined,
      metadata: state.metadata ? { ...state.metadata } : undefined,
      customOptions: state.customOptions ? { ...state.customOptions } : undefined,
    }),
    clone: () => makeBuilder(builder.getState()),
    reset: () => makeBuilder({}),
  }

  return builder
}

const applySingleChunkTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('sync')
    .withMaxConcurrentChunks(1)
    .withBatchSize(1)
    .enableProgressTracking(false)

const applyAreaGenerationTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('async')
    .withMaxConcurrentChunks(4)
    .withBatchSize(16)
    .enableProgressTracking(true)

const applyWorldExplorationTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('streaming')
    .withMaxConcurrentChunks(8)
    .withBatchSize(4)
    .enableStructures(true)
    .enableCaves(false)
    .enableOres(false)
    .enableVegetation(false)
    .enablePostProcessing(false)

const applyStructurePlacementTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('async')
    .withMaxConcurrentChunks(2)
    .withBatchSize(8)
    .enableStructures(true)
    .enableCaves(false)
    .enableOres(false)
    .enablePostProcessing(true)

const applyTerrainModificationTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('sync')
    .withMaxConcurrentChunks(1)
    .withBatchSize(1)
    .enableStructures(false)
    .enableCaves(true)
    .enableOres(true)
    .enableVegetation(true)

const applyBulkGenerationTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('async')
    .withMaxConcurrentChunks(16)
    .withBatchSize(32)
    .optimizeForSpeed()

const applyStreamingGenerationTemplate = (builder: GenerationSessionBuilder): GenerationSessionBuilder =>
  builder
    .withExecutionMode('streaming')
    .withMaxConcurrentChunks(2)
    .withBatchSize(1)
    .enableProgressTracking(true)
    .enablePostProcessing(false)

// ================================
// Helper Functions
// ================================

/**
 * エリア座標生成
 */
const generateAreaCoordinates = (
  center: Coordinates.ChunkCoordinate,
  radius: number
): Coordinates.ChunkCoordinate[] => {
  const coordinates: Coordinates.ChunkCoordinate[] = []

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      if (x * x + z * z <= radius * radius) {
        coordinates.push(
          Coordinates.createChunkCoordinate(center.x + x, center.z + z)
        )
      }
    }
  }

  return coordinates
}

/**
 * グリッド座標生成
 */
const generateGridCoordinates = (
  topLeft: Coordinates.ChunkCoordinate,
  bottomRight: Coordinates.ChunkCoordinate
): Coordinates.ChunkCoordinate[] => {
  const coordinates: Coordinates.ChunkCoordinate[] = []

  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let z = topLeft.z; z <= bottomRight.z; z++) {
      coordinates.push(Coordinates.createChunkCoordinate(x, z))
    }
  }

  return coordinates
}

/**
 * 推定所要時間計算
 */
const calculateEstimatedDuration = (state: SessionBuilderState): Duration.Duration => {
  const chunkCount = state.coordinates?.length ?? 0
  const concurrentChunks = state.configuration?.maxConcurrentChunks ?? 4

  const baseTimePerChunk = 2000
  const totalTime = (chunkCount / concurrentChunks) * baseTimePerChunk

  return Duration.millis(totalTime)
}

// ================================
// Factory Functions
// ================================

export const createSessionBuilder = (): GenerationSessionBuilder =>
  makeBuilder()

export const createSessionBuilderForCoordinates = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): GenerationSessionBuilder =>
  makeBuilder().forCoordinates(coordinates)

export const createSessionBuilderForArea = (
  center: Coordinates.ChunkCoordinate,
  radius: number
): GenerationSessionBuilder =>
  makeBuilder().addArea(center, radius)

export const createSessionBuilderFromTemplate = (
  template: SessionTemplateType
): GenerationSessionBuilder =>
  makeBuilder().applyTemplate(template)

// ================================
// Exports
// ================================

export {
  type GenerationSessionBuilder,
  type SessionBuilderState,
  type SessionValidationState,
}
