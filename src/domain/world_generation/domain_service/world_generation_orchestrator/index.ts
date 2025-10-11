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
} from './orchestrator'

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
} from './orchestrator'

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
} from './generation_pipeline'

export type {
  GenerationPipelineErrorType,
  PipelineConfigurationType,
  PipelineStateType,
  StageExecutionResultType,
} from './generation_pipeline'

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
} from './dependency_coordinator'

export type {
  CoordinationConfigType,
  DependencyCoordinatorErrorType,
  DependencyGraphType,
  DependencyNodeType,
  ResourceAllocationType,
  ResourcePoolType,
} from './dependency_coordinator'

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
} from './error_recovery'

export type {
  CircuitBreakerType,
  ErrorContextType,
  ErrorRecoveryServiceErrorType,
  RecoveryActionType,
  RecoveryConfigurationType,
  RecoveryStrategyType,
} from './error_recovery'

// === Layers ===

export { WorldGenerationOrchestratorLive, WorldGenerationOrchestratorServicesLayer } from './layer'

// === Helper Functions ===

import { Effect, Schema } from 'effect'
import { GenerateChunkCommand, GenerationProgress, WorldGenerationOrchestrator } from './orchestrator'

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
        concurrency: 4,
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
          return progress.stage !== 'completed' && progress.stage !== 'failed'
        }),
        { schedule: Effect.Schedule.spaced('2 seconds') }
      )
    }),
}
