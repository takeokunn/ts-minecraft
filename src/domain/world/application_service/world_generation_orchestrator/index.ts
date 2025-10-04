/**
 * World Generation Orchestrator Application Service
 *
 * ワールド生成プロセス全体を統括するメインオーケストレータです。
 * 複数のドメインサービスと集約を協調させて、完全なワールド生成を実現します。
 */

// === Core Orchestrator ===
export {
  CancelGenerationCommand,
  ChunkGenerationResult,
  GenerateChunkCommand,
  GenerateWorldCommand,
  GenerationProgress,
  GenerationStage,
  GetProgressQuery,
  PipelineContext,
  UpdateSettingsCommand,
  WorldGenerationOrchestrator,
  WorldGenerationOrchestratorError,
  WorldGenerationOrchestratorHelpers,
  WorldGenerationResult,
} from './orchestrator.js'

export type {
  CancelGenerationCommandType,
  ChunkGenerationResultType,
  GenerateChunkCommandType,
  GenerateWorldCommandType,
  GenerationProgressType,
  GenerationStageType,
  GetProgressQueryType,
  PipelineContextType,
  UpdateSettingsCommandType,
  WorldGenerationOrchestratorErrorType,
  WorldGenerationResultType,
} from './orchestrator.js'

// === Generation Pipeline ===
export {
  DEFAULT_PIPELINE_CONFIG,
  GenerationPipelineError,
  GenerationPipelineService,
  GenerationPipelineServiceLive,
  PipelineConfiguration,
  PipelineStageConfig,
  PipelineState,
  StageExecutionResult,
} from './generation_pipeline.js'

export type {
  GenerationPipelineErrorType,
  PipelineConfigurationType,
  PipelineStateType,
  StageExecutionResultType,
} from './generation_pipeline.js'

// === Dependency Coordinator ===
export {
  CoordinationConfig,
  DEFAULT_COORDINATION_CONFIG,
  DependencyCoordinatorError,
  DependencyCoordinatorService,
  DependencyCoordinatorServiceLive,
  DependencyGraph,
  DependencyNode,
  ResourceAllocation,
  ResourcePool,
} from './dependency_coordinator.js'

export type {
  CoordinationConfigType,
  DependencyCoordinatorErrorType,
  DependencyGraphType,
  DependencyNodeType,
  ResourceAllocationType,
  ResourcePoolType,
} from './dependency_coordinator.js'

// === Error Recovery ===
export {
  CircuitBreaker,
  DEFAULT_RECOVERY_CONFIG,
  ErrorContext,
  ErrorRecoveryService,
  ErrorRecoveryServiceError,
  ErrorRecoveryServiceLive,
  RecoveryAction,
  RecoveryConfiguration,
  RecoveryStrategy,
} from './error_recovery.js'

export type {
  CircuitBreakerType,
  ErrorContextType,
  ErrorRecoveryServiceErrorType,
  RecoveryActionType,
  RecoveryConfigurationType,
  RecoveryStrategyType,
} from './error_recovery.js'

// === Live Implementation ===

import { Effect, Layer } from 'effect'
import { DependencyCoordinatorService, DependencyCoordinatorServiceLive } from './dependency_coordinator.js'
import { ErrorRecoveryService, ErrorRecoveryServiceLive } from './error_recovery.js'
import { GenerationPipelineService, GenerationPipelineServiceLive } from './generation_pipeline.js'
import {
  WorldGenerationOrchestrator,
  type CancelGenerationCommand,
  type ChunkGenerationResult,
  type GenerateChunkCommand,
  type GenerateWorldCommand,
  type GenerationProgress,
  type GetProgressQuery,
  type UpdateSettingsCommand,
  type WorldGenerationResult,
} from './orchestrator.js'

/**
 * World Generation Orchestrator Live Implementation
 *
 * 依存するサービスを統合してオーケストレータの実装を提供します。
 */
const makeWorldGenerationOrchestrator = Effect.gen(function* () {
  const pipelineService = yield* GenerationPipelineService
  const coordinatorService = yield* DependencyCoordinatorService
  const recoveryService = yield* ErrorRecoveryService

  // 内部状態管理
  const activeSessions = new Map<string, any>()
  const sessionCounter = { value: 0 }

  const generateWorld = (command: Schema.Schema.Type<typeof GenerateWorldCommand>) =>
    Effect.gen(function* () {
      const generationId = `world_gen_${++sessionCounter.value}`
      yield* Effect.logInfo(`ワールド生成開始: ${command.worldName} (${generationId})`)

      try {
        // パイプライン作成
        yield* pipelineService.createPipeline(
          generationId,
          {
            _tag: 'PipelineConfiguration',
            stages: [
              {
                _tag: 'PipelineStageConfig',
                stage: 'terrain_generation',
                enabled: true,
                priority: 1,
                timeout: 30000,
                retryPolicy: { maxRetries: 3, backoffMs: 1000, exponential: true },
                parallelizable: false,
                dependencies: [],
                resourceRequirements: { cpuIntensive: true, memoryIntensive: true, ioIntensive: false },
              },
            ],
            maxConcurrency: 4,
            globalTimeout: 300000,
            validateIntermediate: true,
            enableCheckpoints: true,
            errorStrategy: 'retry_failed',
          },
          {
            _tag: 'PipelineContext',
            generationId,
            currentStage: 'terrain_generation',
            chunkPosition: { x: 0, z: 0 }, // プレースホルダー
            worldSeed: command.seed,
            parameters: command.parameters,
            intermediateResults: {},
            metrics: {},
          }
        )

        // パイプライン実行
        const pipelineResult = yield* pipelineService.executePipeline(generationId)

        const result: Schema.Schema.Type<typeof WorldGenerationResult> = {
          _tag: 'WorldGenerationResult',
          generationId,
          worldName: command.worldName,
          status: pipelineResult.status === 'completed' ? 'completed' : 'failed',
          chunksGenerated: pipelineResult.completedStages.length,
          totalChunks: 10, // プレースホルダー
          duration: Date.now() - pipelineResult.startTime,
          metrics: pipelineResult.metrics,
          errors: pipelineResult.errors,
        }

        yield* Effect.logInfo(`ワールド生成完了: ${command.worldName}`)
        return result
      } catch (error) {
        yield* Effect.logError(`ワールド生成エラー: ${error}`)
        return yield* Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `ワールド生成に失敗しました: ${error}`,
          reason: 'generation_failed',
          generationId,
          cause: error,
        })
      }
    })

  const generateChunk = (command: Schema.Schema.Type<typeof GenerateChunkCommand>) =>
    Effect.gen(function* () {
      const requestId = command.requestId || `chunk_${++sessionCounter.value}`
      yield* Effect.logInfo(`チャンク生成開始: ${JSON.stringify(command.chunkPosition)} (${requestId})`)

      try {
        const startTime = Date.now()

        // チャンク生成実行（簡略化）
        yield* Effect.sleep('500 millis') // 生成処理のシミュレーション

        const result: Schema.Schema.Type<typeof ChunkGenerationResult> = {
          _tag: 'ChunkGenerationResult',
          chunkPosition: command.chunkPosition,
          status: 'success',
          generationTime: Date.now() - startTime,
          features: ['terrain', 'biomes'],
          biomes: ['plains', 'forest'],
          structures: [],
          errors: [],
        }

        yield* Effect.logInfo(`チャンク生成完了: ${requestId}`)
        return result
      } catch (error) {
        yield* Effect.logError(`チャンク生成エラー: ${error}`)
        return yield* Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `チャンク生成に失敗しました: ${error}`,
          reason: 'chunk_generation_failed',
          chunkPosition: command.chunkPosition,
          cause: error,
        })
      }
    })

  const updateSettings = (command: Schema.Schema.Type<typeof UpdateSettingsCommand>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`設定更新: ${command.generationId}`)

      try {
        // パイプライン設定更新
        yield* pipelineService.updateConfiguration(
          command.generationId,
          {} // 実際の設定更新ロジック
        )

        yield* Effect.logInfo(`設定更新完了: ${command.generationId}`)
      } catch (error) {
        return yield* Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `設定更新に失敗しました: ${error}`,
          reason: 'settings_update_failed',
          generationId: command.generationId,
          cause: error,
        })
      }
    })

  const getProgress = (query: Schema.Schema.Type<typeof GetProgressQuery>) =>
    Effect.gen(function* () {
      try {
        const pipelineState = yield* pipelineService.getPipelineState(query.generationId)

        const progress: Schema.Schema.Type<typeof GenerationProgress> = {
          _tag: 'GenerationProgress',
          generationId: query.generationId,
          stage: pipelineState.currentStage ? (pipelineState.currentStage as any) : 'initializing',
          progress: pipelineState.progress,
          chunksProcessed: pipelineState.completedStages.length,
          totalChunks: 10, // プレースホルダー
          errors: pipelineState.errors,
          warnings: [],
        }

        return progress
      } catch (error) {
        return yield* Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `進捗取得に失敗しました: ${error}`,
          reason: 'progress_query_failed',
          generationId: query.generationId,
          cause: error,
        })
      }
    })

  const cancelGeneration = (command: Schema.Schema.Type<typeof CancelGenerationCommand>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`生成キャンセル: ${command.generationId} (graceful: ${command.graceful})`)

      try {
        yield* pipelineService.cancelPipeline(command.generationId, command.graceful)
        activeSessions.delete(command.generationId)

        yield* Effect.logInfo(`生成キャンセル完了: ${command.generationId}`)
        return true
      } catch (error) {
        yield* Effect.logError(`生成キャンセルエラー: ${error}`)
        return yield* Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `生成キャンセルに失敗しました: ${error}`,
          reason: 'cancellation_failed',
          generationId: command.generationId,
          cause: error,
        })
      }
    })

  const listActiveSessions = () =>
    Effect.gen(function* () {
      return Array.from(activeSessions.keys())
    })

  const healthCheck = () =>
    Effect.gen(function* () {
      try {
        // 各サービスの健全性チェック
        const pipelineHealth = true // 実際のヘルスチェックロジック
        const coordinatorHealth = true
        const recoveryHealth = true

        return {
          pipeline: pipelineHealth,
          coordinator: coordinatorHealth,
          recovery: recoveryHealth,
          overall: pipelineHealth && coordinatorHealth && recoveryHealth,
        }
      } catch (error) {
        return yield* Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `ヘルスチェックに失敗しました: ${error}`,
          reason: 'health_check_failed',
          cause: error,
        })
      }
    })

  return WorldGenerationOrchestrator.of({
    generateWorld,
    generateChunk,
    updateSettings,
    getProgress,
    cancelGeneration,
    listActiveSessions,
    healthCheck,
  })
})

// === Orchestrator Layer ===

export const WorldGenerationOrchestratorLive = Layer.effect(
  WorldGenerationOrchestrator,
  makeWorldGenerationOrchestrator
).pipe(
  Layer.provide(GenerationPipelineServiceLive),
  Layer.provide(DependencyCoordinatorServiceLive),
  Layer.provide(ErrorRecoveryServiceLive)
)

// === Complete Service Layer ===

export const WorldGenerationOrchestratorServicesLayer = Layer.mergeAll(
  GenerationPipelineServiceLive,
  DependencyCoordinatorServiceLive,
  ErrorRecoveryServiceLive,
  WorldGenerationOrchestratorLive
)

// === Helper Functions ===

export const WorldGenerationOrchestratorUtils = {
  /**
   * 基本的なワールド生成を実行する便利関数
   */
  generateBasicWorld: (worldName: string, seed?: any) =>
    Effect.gen(function* () {
      const orchestrator = yield* WorldGenerationOrchestrator

      return yield* orchestrator.generateWorld({
        _tag: 'GenerateWorldCommand',
        worldName,
        seed: seed || { value: Math.random() },
        parameters: {}, // デフォルトパラメータ
        priority: 'normal',
      })
    }),

  /**
   * 複数チャンクの並列生成
   */
  generateChunksInParallel: (commands: Schema.Schema.Type<typeof GenerateChunkCommand>[]) =>
    Effect.gen(function* () {
      const orchestrator = yield* WorldGenerationOrchestrator

      return yield* Effect.forEach(commands, (command) => orchestrator.generateChunk(command), {
        concurrency: 'unbounded',
      })
    }),

  /**
   * 生成進捗の継続監視
   */
  monitorGenerationProgress: (
    generationId: string,
    onProgress: (progress: Schema.Schema.Type<typeof GenerationProgress>) => Effect.Effect<void>
  ) =>
    Effect.gen(function* () {
      const orchestrator = yield* WorldGenerationOrchestrator

      yield* Effect.repeat(
        Effect.gen(function* () {
          const progress = yield* orchestrator.getProgress({
            _tag: 'GetProgressQuery',
            generationId,
            includeDetails: true,
          })

          yield* onProgress(progress)

          // 完了または失敗時は監視終了
          if (progress.stage === 'completed' || progress.stage === 'failed') {
            return false
          }

          return true
        }),
        { schedule: Effect.Schedule.spaced('2 seconds') }
      )
    }),
}
