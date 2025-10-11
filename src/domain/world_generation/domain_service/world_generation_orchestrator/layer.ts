/**
 * World Generation Orchestrator Layers
 *
 * ワールド生成オーケストレータのLayer定義
 */

import { Clock, Effect, Layer, Schema } from 'effect'
import { DependencyCoordinatorService, DependencyCoordinatorServiceLive } from './dependency_coordinator'
import { ErrorRecoveryService, ErrorRecoveryServiceLive } from './error_recovery'
import { GenerationPipelineService, GenerationPipelineServiceLive } from './generation_pipeline'
import {
  CancelGenerationCommand,
  ChunkGenerationResult,
  GenerateChunkCommand,
  GenerateWorldCommand,
  GenerationProgress,
  GetProgressQuery,
  UpdateSettingsCommand,
  WorldGenerationOrchestrator,
  WorldGenerationResult,
} from './orchestrator'

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
  const activeSessions = new Set<string>()
  const sessionCounter = { value: 0 }

  const mapStage = (stage: string | undefined): Schema.Schema.Type<typeof GenerationProgress>['stage'] => {
    switch (stage) {
      case 'terrain_generation':
      case 'terrain':
        return 'terrain'
      case 'biome_assignment':
      case 'biomes':
        return 'biomes'
      case 'cave_carving':
      case 'caves':
        return 'caves'
      case 'ore_placement':
      case 'ores':
        return 'ores'
      case 'structure_spawning':
      case 'structures':
        return 'structures'
      case 'post_processing':
      case 'validation':
      case 'finalizing':
        return 'finalizing'
      case 'completed':
        return 'completed'
      case 'failed':
        return 'failed'
      default:
        return 'initializing'
    }
  }

  const generateWorld = (command: Schema.Schema.Type<typeof GenerateWorldCommand>) =>
    Effect.gen(function* () {
      const generationId = `world_gen_${++sessionCounter.value}`
      yield* Effect.logInfo(`ワールド生成開始: ${command.worldName} (${generationId})`)

      // パイプライン作成
      activeSessions.add(generationId)
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
        duration: yield* Clock.currentTimeMillis,
        metrics: pipelineResult.metrics,
        errors: pipelineResult.errors,
      }

      yield* Effect.logInfo(`ワールド生成完了: ${command.worldName}`)
      activeSessions.delete(generationId)
      return result
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          activeSessions.delete(generationId)
          yield* Effect.logError(`ワールド生成エラー: ${error}`)
          return yield* Effect.fail({
            _tag: 'WorldGenerationOrchestratorError' as const,
            message: `ワールド生成に失敗しました: ${error}`,
            reason: 'generation_failed',
            generationId: `world_gen_${sessionCounter.value}`,
            cause: error,
          })
        })
      )
    )

  const generateChunk = (command: Schema.Schema.Type<typeof GenerateChunkCommand>) =>
    Effect.gen(function* () {
      const requestId = command.requestId || `chunk_${++sessionCounter.value}`
      yield* Effect.logInfo(`チャンク生成開始: ${JSON.stringify(command.chunkPosition)} (${requestId})`)

      const startTime = yield* Clock.currentTimeMillis

      // チャンク生成実行（簡略化）
      yield* Effect.sleep('500 millis') // 生成処理のシミュレーション

      const result: Schema.Schema.Type<typeof ChunkGenerationResult> = {
        _tag: 'ChunkGenerationResult',
        chunkPosition: command.chunkPosition,
        status: 'success',
        generationTime: yield* Clock.currentTimeMillis,
        features: ['terrain', 'biomes'],
        biomes: ['plains', 'forest'],
        structures: [],
        errors: [],
      }

      yield* Effect.logInfo(`チャンク生成完了: ${requestId}`)
      return result
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`チャンク生成エラー: ${error}`)
          return yield* Effect.fail({
            _tag: 'WorldGenerationOrchestratorError' as const,
            message: `チャンク生成に失敗しました: ${error}`,
            reason: 'chunk_generation_failed',
            chunkPosition: command.chunkPosition,
            cause: error,
          })
        })
      )
    )

  const updateSettings = (command: Schema.Schema.Type<typeof UpdateSettingsCommand>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`設定更新: ${command.generationId}`)

      // パイプライン設定更新
      yield* pipelineService.updateConfiguration(
        command.generationId,
        {} // 実際の設定更新ロジック
      )

      yield* Effect.logInfo(`設定更新完了: ${command.generationId}`)
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `設定更新に失敗しました: ${error}`,
          reason: 'settings_update_failed',
          generationId: command.generationId,
          cause: error,
        })
      )
    )

  const getProgress = (query: Schema.Schema.Type<typeof GetProgressQuery>) =>
    Effect.gen(function* () {
      const pipelineState = yield* pipelineService.getPipelineState(query.generationId)

      const progress: Schema.Schema.Type<typeof GenerationProgress> = {
        _tag: 'GenerationProgress',
        generationId: query.generationId,
        stage: mapStage(pipelineState.currentStage ?? pipelineState.status),
        progress: pipelineState.progress,
        chunksProcessed: pipelineState.completedStages.length,
        totalChunks: 10, // プレースホルダー
        errors: pipelineState.errors,
        warnings: [],
      }

      return progress
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `進捗取得に失敗しました: ${error}`,
          reason: 'progress_query_failed',
          generationId: query.generationId,
          cause: error,
        })
      )
    )

  const cancelGeneration = (command: Schema.Schema.Type<typeof CancelGenerationCommand>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`生成キャンセル: ${command.generationId} (graceful: ${command.graceful})`)

      yield* pipelineService.cancelPipeline(command.generationId, command.graceful)
      activeSessions.delete(command.generationId)

      yield* Effect.logInfo(`生成キャンセル完了: ${command.generationId}`)
      return true
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`生成キャンセルエラー: ${error}`)
          return yield* Effect.fail({
            _tag: 'WorldGenerationOrchestratorError' as const,
            message: `生成キャンセルに失敗しました: ${error}`,
            reason: 'cancellation_failed',
            generationId: command.generationId,
            cause: error,
          })
        })
      )
    )

  const listActiveSessions = () => Effect.succeed(Array.from(activeSessions))

  const healthCheck = () =>
    Effect.gen(function* () {
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
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail({
          _tag: 'WorldGenerationOrchestratorError' as const,
          message: `ヘルスチェックに失敗しました: ${error}`,
          reason: 'health_check_failed',
          cause: error,
        })
      )
    )

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
