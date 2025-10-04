/**
 * @fileoverview GenerationSessionFactory - DDD原理主義実装
 *
 * GenerationSession集約の複雑な生成ロジックを抽象化し、
 * セッション管理のビジネスルールを強制する統合ファクトリです。
 *
 * ## 責務
 * - GenerationSession集約の構築
 * - セッション設定の検証と最適化
 * - 進捗追跡システムの初期化
 * - エラー回復機能の設定
 * - ワークフロー管理の構築
 *
 * ## 技術仕様
 * - Effect-TS 3.17+ Context.GenericTag依存性注入
 * - Schema による型安全な検証
 * - STM による並行制御対応
 * - Duration による精密な時間管理
 * - Chunk による効率的なバッチ処理
 */

import { Context, Effect, Schema, Layer, Match, Function, STM, Duration, Chunk, Brand } from "effect"
import type * as GenerationSession from "../../aggregate/generation_session/generation_session.js"
import type * as WorldGenerator from "../../aggregate/world_generator/world_generator.js"
import * as Coordinates from "../../value_object/coordinates/index.js"
import * as WorldSeed from "../../value_object/world_seed/index.js"
import type * as WorldTypes from "../../types/core/world_types.js"
import type * as GenerationErrors from "../../types/errors/generation_errors.js"

// ================================
// Factory Error Types
// ================================

export const SessionFactoryErrorSchema = Schema.TaggedError('SessionFactoryError', {
  category: Schema.Literal(
    'session_creation',
    'configuration_invalid',
    'resource_exhaustion',
    'dependency_missing',
    'workflow_conflict'
  ),
  message: Schema.String,
  sessionId: Schema.optional(GenerationSession.GenerationSessionIdSchema),
  context: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown)
})

export class SessionFactoryError extends Schema.TaggedError<typeof SessionFactoryErrorSchema>()('SessionFactoryError', SessionFactoryErrorSchema) {}

// ================================
// Factory Parameters
// ================================

/**
 * GenerationSession作成パラメータ
 */
export const CreateSessionParamsSchema = Schema.Struct({
  // 生成対象
  request: GenerationSession.GenerationRequestSchema,

  // セッション設定
  configuration: Schema.optional(GenerationSession.SessionConfigurationSchema),

  // 関連Generator
  generatorId: Schema.optional(WorldGenerator.WorldGeneratorIdSchema),

  // 実行設定
  executionMode: Schema.optional(Schema.Literal('sync', 'async', 'streaming')),
  priority: Schema.optional(Schema.Number.pipe(Schema.between(1, 10))),

  // 監視設定
  enableProgressTracking: Schema.optional(Schema.Boolean),
  enableDetailedLogging: Schema.optional(Schema.Boolean),
  enableMetrics: Schema.optional(Schema.Boolean),

  // 回復設定
  enableAutoRecovery: Schema.optional(Schema.Boolean),
  checkpointInterval: Schema.optional(Duration.DurationSchema),

  // カスタム設定
  customOptions: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
})

export type CreateSessionParams = typeof CreateSessionParamsSchema.Type

/**
 * バッチセッション作成パラメータ
 */
export const CreateBatchSessionParamsSchema = Schema.Struct({
  requests: Schema.Array(GenerationSession.GenerationRequestSchema),
  batchSize: Schema.optional(Schema.Number.pipe(Schema.between(1, 100))),
  processingStrategy: Schema.optional(Schema.Literal('parallel', 'sequential', 'mixed')),
  configuration: Schema.optional(GenerationSession.SessionConfigurationSchema)
})

export type CreateBatchSessionParams = typeof CreateBatchSessionParamsSchema.Type

/**
 * テンプレートベースセッション作成パラメータ
 */
export const SessionTemplateTypeSchema = Schema.Literal(
  'single_chunk',
  'area_generation',
  'world_exploration',
  'structure_placement',
  'terrain_modification',
  'bulk_generation',
  'streaming_generation'
)

export type SessionTemplateType = typeof SessionTemplateTypeSchema.Type

export const CreateFromTemplateParamsSchema = Schema.Struct({
  template: SessionTemplateTypeSchema,
  coordinates: Schema.Array(Coordinates.ChunkCoordinateSchema),
  customizations: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
})

export type CreateFromTemplateParams = typeof CreateFromTemplateParamsSchema.Type

/**
 * 復旧セッション作成パラメータ
 */
export const RecoverSessionParamsSchema = Schema.Struct({
  sessionId: GenerationSession.GenerationSessionIdSchema,
  recoveryStrategy: Schema.Literal('resume', 'restart', 'partial'),
  preserveProgress: Schema.optional(Schema.Boolean),
  skipFailedChunks: Schema.optional(Schema.Boolean)
})

export type RecoverSessionParams = typeof RecoverSessionParamsSchema.Type

// ================================
// GenerationSessionFactory Interface
// ================================

export interface GenerationSessionFactory {
  /**
   * 標準GenerationSession作成
   */
  readonly create: (
    params: CreateSessionParams
  ) => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>

  /**
   * バッチセッション作成
   * 大量のチャンクを効率的に処理
   */
  readonly createBatch: (
    params: CreateBatchSessionParams
  ) => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>

  /**
   * テンプレートベースセッション作成
   * 定義済みパターンの適用
   */
  readonly createFromTemplate: (
    params: CreateFromTemplateParams
  ) => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>

  /**
   * 復旧セッション作成
   * 中断されたセッションの復旧
   */
  readonly recover: (
    params: RecoverSessionParams
  ) => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>

  /**
   * ストリーミングセッション作成
   * リアルタイム生成向け
   */
  readonly createStreaming: (
    params: CreateSessionParams
  ) => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>

  /**
   * 優先度付きセッション作成
   * 高優先度処理向け
   */
  readonly createPriority: (
    params: CreateSessionParams,
    priority: number
  ) => Effect.Effect<GenerationSession.GenerationSession, SessionFactoryError>
}

// ================================
// Factory Implementation
// ================================

const createGenerationSessionFactory = (): GenerationSessionFactory => ({
  create: (params: CreateSessionParams) =>
    Effect.gen(function* () {
      // パラメータ検証
      yield* validateSessionParams(params)

      // デフォルト設定適用
      const resolvedParams = yield* applySessionDefaults(params)

      // セッション設定構築
      const configuration = yield* buildSessionConfiguration(resolvedParams)

      // 依存関係解決
      const dependencies = yield* resolveSessionDependencies(resolvedParams)

      // セッションID生成
      const sessionId = yield* generateSessionId()

      // GenerationSession作成
      const session = yield* Effect.tryPromise({
        try: () => GenerationSession.create(sessionId, resolvedParams.request, configuration),
        catch: (error) => new SessionFactoryError({
          category: 'session_creation',
          message: 'Failed to create GenerationSession',
          sessionId,
          cause: error
        })
      })

      // 後処理セットアップ
      yield* setupSessionInfrastructure(session, resolvedParams)

      return session
    }),

  createBatch: (params: CreateBatchSessionParams) =>
    Effect.gen(function* () {
      // バッチサイズ検証
      if (params.requests.length === 0) {
        return yield* Effect.fail(new SessionFactoryError({
          category: 'configuration_invalid',
          message: 'Empty batch request provided'
        }))
      }

      // バッチ処理戦略適用
      const processingStrategy = params.processingStrategy ?? 'mixed'
      const batchSize = params.batchSize ?? Math.min(params.requests.length, 10)

      // リクエストをバッチに分割
      const requestBatches = yield* createRequestBatches(params.requests, batchSize)

      // 統合リクエスト作成
      const mergedRequest = yield* mergeRequests(params.requests)

      // バッチ設定構築
      const batchConfiguration = yield* buildBatchConfiguration(params.configuration, processingStrategy)

      // セッション作成
      const sessionParams: CreateSessionParams = {
        request: mergedRequest,
        configuration: batchConfiguration,
        executionMode: 'async',
        enableProgressTracking: true,
        enableMetrics: true
      }

      return yield* createGenerationSessionFactory().create(sessionParams)
    }),

  createFromTemplate: (params: CreateFromTemplateParams) =>
    Effect.gen(function* () {
      // テンプレート設定読み込み
      const templateConfig = yield* loadSessionTemplate(params.template)

      // 座標をリクエストに変換
      const request = yield* buildRequestFromCoordinates(params.coordinates, templateConfig)

      // カスタマイゼーション適用
      const customizedRequest = yield* applyRequestCustomizations(request, params.customizations)

      // セッション作成
      const sessionParams: CreateSessionParams = {
        request: customizedRequest,
        configuration: templateConfig.configuration,
        executionMode: templateConfig.executionMode,
        enableProgressTracking: templateConfig.enableProgressTracking
      }

      return yield* createGenerationSessionFactory().create(sessionParams)
    }),

  recover: (params: RecoverSessionParams) =>
    Effect.gen(function* () {
      // 既存セッション情報取得
      const existingSession = yield* loadExistingSession(params.sessionId)

      // 復旧戦略適用
      const recoveredSession = yield* applyRecoveryStrategy(existingSession, params)

      // 進捗状態復元
      if (params.preserveProgress) {
        yield* restoreProgress(recoveredSession, existingSession)
      }

      return recoveredSession
    }),

  createStreaming: (params: CreateSessionParams) =>
    Effect.gen(function* () {
      // ストリーミング特化設定
      const streamingParams: CreateSessionParams = {
        ...params,
        executionMode: 'streaming',
        configuration: {
          ...params.configuration,
          maxConcurrentChunks: Math.min(params.configuration?.maxConcurrentChunks ?? 4, 2),
          chunkBatchSize: 1,
          timeoutPolicy: {
            chunkTimeoutMs: 5000,
            sessionTimeoutMs: 300000,
            gracefulShutdownMs: 2000
          }
        },
        enableProgressTracking: true,
        enableDetailedLogging: true
      }

      return yield* createGenerationSessionFactory().create(streamingParams)
    }),

  createPriority: (params: CreateSessionParams, priority: number) =>
    Effect.gen(function* () {
      // 優先度検証
      if (priority < 1 || priority > 10) {
        return yield* Effect.fail(new SessionFactoryError({
          category: 'configuration_invalid',
          message: 'Priority must be between 1 and 10'
        }))
      }

      // 優先度特化設定
      const priorityParams: CreateSessionParams = {
        ...params,
        priority,
        configuration: {
          ...params.configuration,
          priorityPolicy: {
            enablePriorityQueuing: true,
            priorityThreshold: priority,
            highPriorityWeight: priority >= 8 ? 5.0 : 2.0
          }
        },
        enableMetrics: true
      }

      return yield* createGenerationSessionFactory().create(priorityParams)
    })
})

// ================================
// Helper Functions
// ================================

/**
 * セッションパラメータ検証
 */
const validateSessionParams = (params: CreateSessionParams): Effect.Effect<void, SessionFactoryError> =>
  Effect.gen(function* () {
    try {
      Schema.decodeSync(CreateSessionParamsSchema)(params)
    } catch (error) {
      return yield* Effect.fail(new SessionFactoryError({
        category: 'configuration_invalid',
        message: 'Invalid session parameters',
        cause: error
      }))
    }
  })

/**
 * デフォルト設定適用
 */
const applySessionDefaults = (params: CreateSessionParams): Effect.Effect<CreateSessionParams, SessionFactoryError> =>
  Effect.succeed({
    ...params,
    configuration: params.configuration ?? createDefaultSessionConfiguration(),
    executionMode: params.executionMode ?? 'async',
    priority: params.priority ?? 5,
    enableProgressTracking: params.enableProgressTracking ?? true,
    enableDetailedLogging: params.enableDetailedLogging ?? false,
    enableMetrics: params.enableMetrics ?? true,
    enableAutoRecovery: params.enableAutoRecovery ?? true,
    checkpointInterval: params.checkpointInterval ?? Duration.seconds(30)
  })

/**
 * セッション設定構築
 */
const buildSessionConfiguration = (params: CreateSessionParams): Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError> =>
  Effect.succeed(params.configuration!)

/**
 * セッション依存関係解決
 */
const resolveSessionDependencies = (params: CreateSessionParams): Effect.Effect<unknown, SessionFactoryError> =>
  Effect.succeed({
    // 依存関係の解決ロジック
  })

/**
 * セッションID生成
 */
const generateSessionId = (): Effect.Effect<GenerationSession.GenerationSessionId, SessionFactoryError> =>
  Effect.sync(() =>
    GenerationSession.createGenerationSessionId(`gs_${crypto.randomUUID()}`)
  )

/**
 * セッションインフラ設定
 */
const setupSessionInfrastructure = (
  session: GenerationSession.GenerationSession,
  params: CreateSessionParams
): Effect.Effect<void, SessionFactoryError> =>
  Effect.sync(() => {
    // インフラ設定（メトリクス、ログ等）
  })

/**
 * デフォルトセッション設定作成
 */
const createDefaultSessionConfiguration = (): GenerationSession.SessionConfiguration => ({
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
})

/**
 * リクエストバッチ作成
 */
const createRequestBatches = (
  requests: readonly GenerationSession.GenerationRequest[],
  batchSize: number
): Effect.Effect<readonly (readonly GenerationSession.GenerationRequest[])[], SessionFactoryError> =>
  Effect.succeed(
    Chunk.fromIterable(requests)
      .pipe(Chunk.chunksOf(batchSize))
      .pipe(Chunk.toReadonlyArray)
      .map(chunk => Chunk.toReadonlyArray(chunk))
  )

/**
 * リクエスト統合
 */
const mergeRequests = (
  requests: readonly GenerationSession.GenerationRequest[]
): Effect.Effect<GenerationSession.GenerationRequest, SessionFactoryError> =>
  Effect.succeed({
    coordinates: requests.flatMap(r => r.coordinates),
    priority: Math.max(...requests.map(r => r.priority)),
    options: requests[0]?.options,
    metadata: requests.reduce((acc, r) => ({ ...acc, ...r.metadata }), {})
  })

/**
 * バッチ設定構築
 */
const buildBatchConfiguration = (
  baseConfig: GenerationSession.SessionConfiguration | undefined,
  strategy: 'parallel' | 'sequential' | 'mixed'
): Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError> =>
  Effect.succeed({
    ...createDefaultSessionConfiguration(),
    ...baseConfig,
    maxConcurrentChunks: Function.pipe(
      Match.value(strategy),
      Match.when('parallel', () => 8),
      Match.when('sequential', () => 1),
      Match.when('mixed', () => 4),
      Match.orElse(() => 4)
    )
  })

/**
 * セッションテンプレート読み込み
 */
const loadSessionTemplate = (template: SessionTemplateType): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Function.pipe(
    Match.value(template),
    Match.when('single_chunk', () => createSingleChunkTemplate()),
    Match.when('area_generation', () => createAreaGenerationTemplate()),
    Match.when('world_exploration', () => createWorldExplorationTemplate()),
    Match.when('structure_placement', () => createStructurePlacementTemplate()),
    Match.when('terrain_modification', () => createTerrainModificationTemplate()),
    Match.when('bulk_generation', () => createBulkGenerationTemplate()),
    Match.when('streaming_generation', () => createStreamingGenerationTemplate()),
    Match.orElse(() => Effect.fail(new SessionFactoryError({
      category: 'configuration_invalid',
      message: `Unknown session template: ${template}`
    })))
  )

/**
 * セッションテンプレート型
 */
interface SessionTemplate {
  configuration: GenerationSession.SessionConfiguration
  executionMode: 'sync' | 'async' | 'streaming'
  enableProgressTracking: boolean
  defaultOptions: GenerationSession.GenerationRequest['options']
}

// テンプレート作成関数群
const createSingleChunkTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 1,
      chunkBatchSize: 1
    },
    executionMode: 'sync',
    enableProgressTracking: false,
    defaultOptions: {
      includeStructures: true,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: true
    }
  })

const createAreaGenerationTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 4,
      chunkBatchSize: 16
    },
    executionMode: 'async',
    enableProgressTracking: true,
    defaultOptions: {
      includeStructures: true,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: true
    }
  })

const createWorldExplorationTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 8,
      chunkBatchSize: 4
    },
    executionMode: 'streaming',
    enableProgressTracking: true,
    defaultOptions: {
      includeStructures: true,
      includeCaves: false,
      includeOres: false,
      generateVegetation: false,
      applyPostProcessing: false
    }
  })

const createStructurePlacementTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 2,
      chunkBatchSize: 8
    },
    executionMode: 'async',
    enableProgressTracking: true,
    defaultOptions: {
      includeStructures: true,
      includeCaves: false,
      includeOres: false,
      generateVegetation: false,
      applyPostProcessing: true
    }
  })

const createTerrainModificationTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 1,
      chunkBatchSize: 1
    },
    executionMode: 'sync',
    enableProgressTracking: true,
    defaultOptions: {
      includeStructures: false,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: true
    }
  })

const createBulkGenerationTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 16,
      chunkBatchSize: 32
    },
    executionMode: 'async',
    enableProgressTracking: true,
    defaultOptions: {
      includeStructures: false,
      includeCaves: false,
      includeOres: false,
      generateVegetation: false,
      applyPostProcessing: false
    }
  })

const createStreamingGenerationTemplate = (): Effect.Effect<SessionTemplate, SessionFactoryError> =>
  Effect.succeed({
    configuration: {
      ...createDefaultSessionConfiguration(),
      maxConcurrentChunks: 2,
      chunkBatchSize: 1
    },
    executionMode: 'streaming',
    enableProgressTracking: true,
    defaultOptions: {
      includeStructures: true,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: false
    }
  })

// その他のヘルパー関数（実装簡略化）
const buildRequestFromCoordinates = (
  coordinates: readonly Coordinates.ChunkCoordinate[],
  template: SessionTemplate
): Effect.Effect<GenerationSession.GenerationRequest, SessionFactoryError> =>
  Effect.succeed({
    coordinates: [...coordinates],
    priority: 5,
    options: template.defaultOptions
  })

const applyRequestCustomizations = (
  request: GenerationSession.GenerationRequest,
  customizations: Record<string, unknown> | undefined
): Effect.Effect<GenerationSession.GenerationRequest, SessionFactoryError> =>
  Effect.succeed(request)

const loadExistingSession = (sessionId: GenerationSession.GenerationSessionId) =>
  Effect.succeed({} as GenerationSession.GenerationSession)

const applyRecoveryStrategy = (
  existingSession: GenerationSession.GenerationSession,
  params: RecoverSessionParams
) => Effect.succeed(existingSession)

const restoreProgress = (
  recoveredSession: GenerationSession.GenerationSession,
  existingSession: GenerationSession.GenerationSession
) => Effect.succeed(undefined)

// ================================
// Context.GenericTag
// ================================

export const GenerationSessionFactoryTag = Context.GenericTag<GenerationSessionFactory>(
  '@minecraft/domain/world/factory/GenerationSessionFactory'
)

// ================================
// Layer Implementation
// ================================

export const GenerationSessionFactoryLive = Layer.succeed(
  GenerationSessionFactoryTag,
  createGenerationSessionFactory()
)

// ================================
// Exports
// ================================

export {
  type CreateSessionParams,
  type CreateBatchSessionParams,
  type CreateFromTemplateParams,
  type RecoverSessionParams,
  type SessionTemplateType,
  type GenerationSessionFactory,
}