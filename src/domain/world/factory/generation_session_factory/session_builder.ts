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

import { Effect, Schema, Match, Function, Duration, Array as EffectArray, Chunk } from "effect"
import type * as GenerationSession from "../../aggregate/generation_session/generation_session.js"
import type * as WorldGenerator from "../../aggregate/world_generator/world_generator.js"
import * as Coordinates from "../../value_object/coordinates/index.js"
import type { CreateSessionParams, SessionTemplateType, SessionFactoryError } from "./factory.js"

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

class GenerationSessionBuilderImpl implements GenerationSessionBuilder {
  constructor(private readonly state: SessionBuilderState = {}) {}

  // 基本設定
  forCoordinates(coordinates: readonly Coordinates.ChunkCoordinate[]): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      coordinates: [...coordinates]
    })
  }

  addCoordinate(coordinate: Coordinates.ChunkCoordinate): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      coordinates: [...(this.state.coordinates ?? []), coordinate]
    })
  }

  addArea(center: Coordinates.ChunkCoordinate, radius: number): GenerationSessionBuilder {
    const areaCoordinates = generateAreaCoordinates(center, radius)
    return new GenerationSessionBuilderImpl({
      ...this.state,
      coordinates: [...(this.state.coordinates ?? []), ...areaCoordinates]
    })
  }

  addGrid(topLeft: Coordinates.ChunkCoordinate, bottomRight: Coordinates.ChunkCoordinate): GenerationSessionBuilder {
    const gridCoordinates = generateGridCoordinates(topLeft, bottomRight)
    return new GenerationSessionBuilderImpl({
      ...this.state,
      coordinates: [...(this.state.coordinates ?? []), ...gridCoordinates]
    })
  }

  // 実行設定
  withExecutionMode(mode: 'sync' | 'async' | 'streaming'): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      executionMode: mode
    })
  }

  withPriority(priority: number): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      priority: Math.max(1, Math.min(10, priority))
    })
  }

  withGenerator(generatorId: WorldGenerator.WorldGeneratorId): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      generatorId
    })
  }

  // セッション設定
  withConfiguration(config: GenerationSession.SessionConfiguration): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: config
    })
  }

  withMaxConcurrentChunks(count: number): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        maxConcurrentChunks: Math.max(1, Math.min(16, count))
      }
    })
  }

  withBatchSize(size: number): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        chunkBatchSize: Math.max(1, Math.min(64, size))
      }
    })
  }

  withTimeout(chunkTimeoutMs: number, sessionTimeoutMs?: number): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        timeoutPolicy: {
          chunkTimeoutMs: Math.max(1000, chunkTimeoutMs),
          sessionTimeoutMs: sessionTimeoutMs ?? Math.max(60000, chunkTimeoutMs * 10),
          gracefulShutdownMs: Math.min(5000, chunkTimeoutMs / 2)
        }
      }
    })
  }

  // 再試行設定
  withRetryPolicy(
    maxAttempts: number,
    strategy: 'linear' | 'exponential' | 'constant' = 'exponential',
    baseDelayMs: number = 1000
  ): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        retryPolicy: {
          maxAttempts: Math.max(1, Math.min(10, maxAttempts)),
          backoffStrategy: strategy,
          baseDelayMs: Math.max(100, baseDelayMs),
          maxDelayMs: Math.max(baseDelayMs * 2, 30000)
        }
      }
    })
  }

  // 優先度設定
  enablePriorityQueuing(threshold: number = 5, weight: number = 2.0): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        priorityPolicy: {
          enablePriorityQueuing: true,
          priorityThreshold: Math.max(1, Math.min(10, threshold)),
          highPriorityWeight: Math.max(1.0, Math.min(10.0, weight))
        }
      }
    })
  }

  disablePriorityQueuing(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        priorityPolicy: {
          enablePriorityQueuing: false,
          priorityThreshold: 5,
          highPriorityWeight: 1.0
        }
      }
    })
  }

  // 生成オプション
  withOptions(options: GenerationSession.GenerationRequest['options']): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      options
    })
  }

  enableStructures(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        includeStructures: enable
      }
    })
  }

  enableCaves(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        includeCaves: enable
      }
    })
  }

  enableOres(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        includeOres: enable
      }
    })
  }

  enableVegetation(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        generateVegetation: enable
      }
    })
  }

  enablePostProcessing(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        applyPostProcessing: enable
      }
    })
  }

  // 監視設定
  enableProgressTracking(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      enableProgressTracking: enable
    })
  }

  enableDetailedLogging(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      enableDetailedLogging: enable
    })
  }

  enableMetrics(enable: boolean = true): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      enableMetrics: enable
    })
  }

  // 回復設定
  enableAutoRecovery(enable: boolean = true, checkpointInterval?: Duration.Duration): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      enableAutoRecovery: enable,
      checkpointInterval: checkpointInterval ?? Duration.seconds(30)
    })
  }

  // テンプレート適用
  applyTemplate(template: SessionTemplateType): GenerationSessionBuilder {
    const templateConfig = Function.pipe(
      Match.value(template),
      Match.when('single_chunk', () => this.applySingleChunkTemplate()),
      Match.when('area_generation', () => this.applyAreaGenerationTemplate()),
      Match.when('world_exploration', () => this.applyWorldExplorationTemplate()),
      Match.when('structure_placement', () => this.applyStructurePlacementTemplate()),
      Match.when('terrain_modification', () => this.applyTerrainModificationTemplate()),
      Match.when('bulk_generation', () => this.applyBulkGenerationTemplate()),
      Match.when('streaming_generation', () => this.applyStreamingGenerationTemplate()),
      Match.orElse(() => this)
    )

    return templateConfig
  }

  applyCustomTemplate(config: Partial<CreateSessionParams>): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: config.configuration ?? this.state.configuration,
      executionMode: config.executionMode ?? this.state.executionMode,
      priority: config.priority ?? this.state.priority,
      enableProgressTracking: config.enableProgressTracking ?? this.state.enableProgressTracking,
      enableDetailedLogging: config.enableDetailedLogging ?? this.state.enableDetailedLogging,
      enableMetrics: config.enableMetrics ?? this.state.enableMetrics,
      enableAutoRecovery: config.enableAutoRecovery ?? this.state.enableAutoRecovery,
      checkpointInterval: config.checkpointInterval ?? this.state.checkpointInterval,
      customOptions: { ...this.state.customOptions, ...config.customOptions }
    })
  }

  // 高レベル設定
  optimizeForSpeed(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      executionMode: 'async',
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        maxConcurrentChunks: 8,
        chunkBatchSize: 16
      },
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        includeStructures: false,
        includeCaves: false,
        includeOres: false,
        generateVegetation: false,
        applyPostProcessing: false
      },
      enableProgressTracking: false,
      enableDetailedLogging: false
    })
  }

  optimizeForQuality(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      executionMode: 'sync',
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        maxConcurrentChunks: 1,
        chunkBatchSize: 1
      },
      options: {
        ...this.getDefaultOptions(),
        ...this.state.options,
        includeStructures: true,
        includeCaves: true,
        includeOres: true,
        generateVegetation: true,
        applyPostProcessing: true
      },
      enableProgressTracking: true,
      enableDetailedLogging: true
    })
  }

  optimizeForMemory(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        maxConcurrentChunks: 2,
        chunkBatchSize: 4
      },
      enableAutoRecovery: true,
      checkpointInterval: Duration.seconds(15)
    })
  }

  optimizeForStability(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      configuration: {
        ...this.getDefaultConfiguration(),
        ...this.state.configuration,
        maxConcurrentChunks: 2,
        retryPolicy: {
          maxAttempts: 5,
          backoffStrategy: 'exponential',
          baseDelayMs: 2000,
          maxDelayMs: 30000
        }
      },
      enableAutoRecovery: true,
      enableProgressTracking: true,
      checkpointInterval: Duration.seconds(10)
    })
  }

  // カスタム設定
  withMetadata(metadata: Record<string, unknown>): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      metadata: { ...this.state.metadata, ...metadata }
    })
  }

  withCustomOption(key: string, value: unknown): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      customOptions: { ...this.state.customOptions, [key]: value }
    })
  }

  withCustomOptions(options: Record<string, unknown>): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({
      ...this.state,
      customOptions: { ...this.state.customOptions, ...options }
    })
  }

  // 条件設定
  when(condition: boolean, configureFn: (builder: GenerationSessionBuilder) => GenerationSessionBuilder): GenerationSessionBuilder {
    return condition ? configureFn(this) : this
  }

  unless(condition: boolean, configureFn: (builder: GenerationSessionBuilder) => GenerationSessionBuilder): GenerationSessionBuilder {
    return !condition ? configureFn(this) : this
  }

  // 検証
  validate(): Effect.Effect<SessionValidationState, SessionFactoryError> {
    return Effect.gen(function* () {
      const errors: string[] = []
      const warnings: string[] = []

      // 座標チェック
      if (!this.state.coordinates || this.state.coordinates.length === 0) {
        errors.push('No coordinates specified for generation')
      }

      // 設定一貫性チェック
      if (this.state.executionMode === 'sync' &&
          this.state.configuration?.maxConcurrentChunks &&
          this.state.configuration.maxConcurrentChunks > 1) {
        warnings.push('Sync execution mode with multiple concurrent chunks may not be optimal')
      }

      // リソース推定
      const estimatedResourceUsage = yield* this.estimateResources()
      const estimatedDuration = calculateEstimatedDuration(this.state)

      if (estimatedResourceUsage.memory > 1024) {
        warnings.push('High memory usage estimated')
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        estimatedDuration,
        estimatedResourceUsage
      }
    }.bind(this))
  }

  isValid(): Effect.Effect<boolean, SessionFactoryError> {
    return Effect.map(this.validate(), (state) => state.isValid)
  }

  estimateResources(): Effect.Effect<SessionValidationState['estimatedResourceUsage'], SessionFactoryError> {
    const chunkCount = this.state.coordinates?.length ?? 0
    const concurrentChunks = this.state.configuration?.maxConcurrentChunks ?? 4
    const batchSize = this.state.configuration?.chunkBatchSize ?? 8

    // 簡易リソース推定
    const baseMemory = 50 // MB
    const memoryPerChunk = 2 // MB
    const memoryConcurrency = concurrentChunks * 10 // MB

    const baseCpu = 20 // %
    const cpuPerChunk = chunkCount * 0.5 // %
    const cpuConcurrency = concurrentChunks * 5 // %

    const storagePerChunk = 1 // MB

    return Effect.succeed({
      memory: baseMemory + (memoryPerChunk * Math.min(chunkCount, batchSize)) + memoryConcurrency,
      cpu: Math.min(100, baseCpu + cpuPerChunk + cpuConcurrency),
      storage: chunkCount * storagePerChunk
    })
  }

  // 構築
  build(): Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError> {
    return Effect.gen(function* () {
      const validation = yield* this.validate()
      if (!validation.isValid) {
        return yield* Effect.fail(new SessionFactoryError({
          category: 'configuration_invalid',
          message: `Session validation failed: ${validation.errors.join(', ')}`
        }))
      }

      const params = yield* this.buildParams()

      const { GenerationSessionFactoryTag } = await import('./factory.js')
      const factory = yield* Effect.service(GenerationSessionFactoryTag)

      return yield* factory.create(params)
    }.bind(this))
  }

  buildParams(): Effect.Effect<CreateSessionParams, SessionFactoryError> {
    return Effect.gen(function* () {
      const request = yield* this.buildRequest()

      return {
        request,
        configuration: this.state.configuration,
        generatorId: this.state.generatorId,
        executionMode: this.state.executionMode,
        priority: this.state.priority,
        enableProgressTracking: this.state.enableProgressTracking,
        enableDetailedLogging: this.state.enableDetailedLogging,
        enableMetrics: this.state.enableMetrics,
        enableAutoRecovery: this.state.enableAutoRecovery,
        checkpointInterval: this.state.checkpointInterval,
        customOptions: this.state.customOptions
      }
    }.bind(this))
  }

  buildRequest(): Effect.Effect<GenerationSession.GenerationRequest, SessionFactoryError> {
    return Effect.succeed({
      coordinates: this.state.coordinates ?? [],
      priority: this.state.priority ?? 5,
      options: this.state.options,
      metadata: this.state.metadata
    })
  }

  // 状態管理
  getState(): SessionBuilderState {
    return { ...this.state }
  }

  clone(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({ ...this.state })
  }

  reset(): GenerationSessionBuilder {
    return new GenerationSessionBuilderImpl({})
  }

  // プライベートヘルパー
  private getDefaultConfiguration(): GenerationSession.SessionConfiguration {
    return {
      maxConcurrentChunks: 4,
      chunkBatchSize: 8,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 10000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 600000,
        gracefulShutdownMs: 5000
      },
      priorityPolicy: {
        enablePriorityQueuing: false,
        priorityThreshold: 5,
        highPriorityWeight: 2.0
      }
    }
  }

  private getDefaultOptions(): GenerationSession.GenerationRequest['options'] {
    return {
      includeStructures: true,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: true
    }
  }

  // テンプレート適用メソッド
  private applySingleChunkTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('sync')
      .withMaxConcurrentChunks(1)
      .withBatchSize(1)
      .enableProgressTracking(false)
  }

  private applyAreaGenerationTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('async')
      .withMaxConcurrentChunks(4)
      .withBatchSize(16)
      .enableProgressTracking(true)
  }

  private applyWorldExplorationTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('streaming')
      .withMaxConcurrentChunks(8)
      .withBatchSize(4)
      .enableStructures(true)
      .enableCaves(false)
      .enableOres(false)
      .enableVegetation(false)
      .enablePostProcessing(false)
  }

  private applyStructurePlacementTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('async')
      .withMaxConcurrentChunks(2)
      .withBatchSize(8)
      .enableStructures(true)
      .enableCaves(false)
      .enableOres(false)
      .enablePostProcessing(true)
  }

  private applyTerrainModificationTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('sync')
      .withMaxConcurrentChunks(1)
      .withBatchSize(1)
      .enableStructures(false)
      .enableCaves(true)
      .enableOres(true)
      .enableVegetation(true)
  }

  private applyBulkGenerationTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('async')
      .withMaxConcurrentChunks(16)
      .withBatchSize(32)
      .optimizeForSpeed()
  }

  private applyStreamingGenerationTemplate(): GenerationSessionBuilder {
    return this
      .withExecutionMode('streaming')
      .withMaxConcurrentChunks(2)
      .withBatchSize(1)
      .enableProgressTracking(true)
      .enablePostProcessing(false)
  }
}

// ================================
// Helper Functions
// ================================

/**
 * エリア座標生成
 */
function generateAreaCoordinates(center: Coordinates.ChunkCoordinate, radius: number): Coordinates.ChunkCoordinate[] {
  const coordinates: Coordinates.ChunkCoordinate[] = []

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      if (x * x + z * z <= radius * radius) {
        coordinates.push(
          Coordinates.createChunkCoordinate(
            center.x + x,
            center.z + z
          )
        )
      }
    }
  }

  return coordinates
}

/**
 * グリッド座標生成
 */
function generateGridCoordinates(
  topLeft: Coordinates.ChunkCoordinate,
  bottomRight: Coordinates.ChunkCoordinate
): Coordinates.ChunkCoordinate[] {
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
function calculateEstimatedDuration(state: SessionBuilderState): Duration.Duration {
  const chunkCount = state.coordinates?.length ?? 0
  const concurrentChunks = state.configuration?.maxConcurrentChunks ?? 4

  // 1チャンクあたり2秒と仮定
  const baseTimePerChunk = 2000 // ms
  const totalTime = (chunkCount / concurrentChunks) * baseTimePerChunk

  return Duration.millis(totalTime)
}

// ================================
// Factory Functions
// ================================

export const createSessionBuilder = (): GenerationSessionBuilder =>
  new GenerationSessionBuilderImpl()

export const createSessionBuilderForCoordinates = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): GenerationSessionBuilder =>
  new GenerationSessionBuilderImpl().forCoordinates(coordinates)

export const createSessionBuilderForArea = (
  center: Coordinates.ChunkCoordinate,
  radius: number
): GenerationSessionBuilder =>
  new GenerationSessionBuilderImpl().addArea(center, radius)

export const createSessionBuilderFromTemplate = (
  template: SessionTemplateType
): GenerationSessionBuilder =>
  new GenerationSessionBuilderImpl().applyTemplate(template)

// ================================
// Exports
// ================================

export {
  type GenerationSessionBuilder,
  type SessionBuilderState,
  type SessionValidationState,
}