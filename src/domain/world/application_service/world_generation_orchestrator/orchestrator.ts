import { Context, Effect, Layer, Match, Option, pipe, Schema } from 'effect'
import type {
  WorldSeed,
  BiomeProperties,
  GenerationParameters,
  NoiseConfiguration,
  WorldCoordinate,
  ChunkCoordinate,
} from '../../value_object/index.js'
import type {
  WorldGenerator,
  GenerationSession,
  BiomeSystem,
} from '../../aggregate/index.js'
import type {
  TerrainGeneratorService,
  CaveCarverService,
  StructureSpawnerService,
  OrePlacerService,
} from '../../domain_service/procedural_generation/index.js'
import type {
  GenerationValidatorService,
  ConsistencyCheckerService,
} from '../../domain_service/world_validation/index.js'
import type {
  WorldGeneratorRepository,
  GenerationSessionRepository,
  BiomeSystemRepository,
} from '../../repository/index.js'

/**
 * World Generation Orchestrator Application Service
 *
 * ワールド生成プロセス全体を統括するメインオーケストレータです。
 * 複数のドメインサービスと集約を協調させて、完全なワールド生成を実現します。
 */

// === エラー定義 ===

export const WorldGenerationOrchestratorError = Schema.TaggedError<WorldGenerationOrchestratorErrorType>()(
  'WorldGenerationOrchestratorError',
  {
    message: Schema.String,
    reason: Schema.String,
    generationId: Schema.optional(Schema.String),
    chunkPosition: Schema.optional(Schema.Unknown),
    cause: Schema.optional(Schema.Unknown),
    recovery: Schema.optional(Schema.String),
  }
)

export interface WorldGenerationOrchestratorErrorType
  extends Schema.Schema.Type<typeof WorldGenerationOrchestratorError> {}

// === コマンド・クエリ型 ===

export const GenerateWorldCommand = Schema.Struct({
  _tag: Schema.Literal('GenerateWorldCommand'),
  worldName: Schema.String.pipe(Schema.minLength(1)),
  seed: Schema.Unknown, // WorldSeed
  parameters: Schema.Unknown, // GenerationParameters
  bounds: Schema.optional(Schema.Struct({
    minX: Schema.Number,
    maxX: Schema.Number,
    minZ: Schema.Number,
    maxZ: Schema.Number,
  })),
  priority: Schema.optional(Schema.Union(
    Schema.Literal('low'),
    Schema.Literal('normal'),
    Schema.Literal('high'),
    Schema.Literal('critical')
  )),
})

export const GenerateChunkCommand = Schema.Struct({
  _tag: Schema.Literal('GenerateChunkCommand'),
  chunkPosition: Schema.Unknown, // ChunkCoordinate
  worldSeed: Schema.Unknown, // WorldSeed
  parameters: Schema.Unknown, // GenerationParameters
  biomeOverride: Schema.optional(Schema.Unknown), // BiomeProperties
  requestId: Schema.optional(Schema.String),
})

export const UpdateSettingsCommand = Schema.Struct({
  _tag: Schema.Literal('UpdateSettingsCommand'),
  generationId: Schema.String,
  newParameters: Schema.Unknown, // Partial<GenerationParameters>
  applyImmediately: Schema.Boolean,
})

export const GetProgressQuery = Schema.Struct({
  _tag: Schema.Literal('GetProgressQuery'),
  generationId: Schema.String,
  includeDetails: Schema.Boolean,
})

export const CancelGenerationCommand = Schema.Struct({
  _tag: Schema.Literal('CancelGenerationCommand'),
  generationId: Schema.String,
  graceful: Schema.Boolean,
  reason: Schema.optional(Schema.String),
})

// === 結果型 ===

export const WorldGenerationResult = Schema.Struct({
  _tag: Schema.Literal('WorldGenerationResult'),
  generationId: Schema.String,
  worldName: Schema.String,
  status: Schema.Union(
    Schema.Literal('completed'),
    Schema.Literal('partial'),
    Schema.Literal('failed')
  ),
  chunksGenerated: Schema.Number.pipe(Schema.nonNegativeInteger()),
  totalChunks: Schema.Number.pipe(Schema.nonNegativeInteger()),
  duration: Schema.Number.pipe(Schema.positive()),
  metrics: Schema.Record(Schema.String, Schema.Unknown),
  errors: Schema.Array(Schema.String),
})

export const ChunkGenerationResult = Schema.Struct({
  _tag: Schema.Literal('ChunkGenerationResult'),
  chunkPosition: Schema.Unknown, // ChunkCoordinate
  status: Schema.Union(
    Schema.Literal('success'),
    Schema.Literal('partial'),
    Schema.Literal('failed')
  ),
  generationTime: Schema.Number.pipe(Schema.positive()),
  features: Schema.Array(Schema.String),
  biomes: Schema.Array(Schema.Unknown), // BiomeId[]
  structures: Schema.Array(Schema.String),
  errors: Schema.Array(Schema.String),
})

export const GenerationProgress = Schema.Struct({
  _tag: Schema.Literal('GenerationProgress'),
  generationId: Schema.String,
  stage: Schema.Union(
    Schema.Literal('initializing'),
    Schema.Literal('terrain'),
    Schema.Literal('biomes'),
    Schema.Literal('caves'),
    Schema.Literal('ores'),
    Schema.Literal('structures'),
    Schema.Literal('finalizing'),
    Schema.Literal('completed'),
    Schema.Literal('failed')
  ),
  progress: Schema.Number.pipe(Schema.between(0, 100)),
  chunksProcessed: Schema.Number.pipe(Schema.nonNegativeInteger()),
  totalChunks: Schema.Number.pipe(Schema.nonNegativeInteger()),
  estimatedTimeRemaining: Schema.optional(Schema.Number.pipe(Schema.positive())),
  currentChunk: Schema.optional(Schema.Unknown), // ChunkCoordinate
  errors: Schema.Array(Schema.String),
  warnings: Schema.Array(Schema.String),
})

// === Generation Pipeline Stage ===

export const GenerationStage = Schema.Union(
  Schema.Literal('terrain_generation'),
  Schema.Literal('biome_assignment'),
  Schema.Literal('cave_carving'),
  Schema.Literal('ore_placement'),
  Schema.Literal('structure_spawning'),
  Schema.Literal('post_processing'),
  Schema.Literal('validation'),
)

export interface GenerationStageType extends Schema.Schema.Type<typeof GenerationStage> {}

export const PipelineContext = Schema.Struct({
  _tag: Schema.Literal('PipelineContext'),
  generationId: Schema.String,
  currentStage: GenerationStage,
  chunkPosition: Schema.Unknown, // ChunkCoordinate
  worldSeed: Schema.Unknown, // WorldSeed
  parameters: Schema.Unknown, // GenerationParameters
  intermediateResults: Schema.Record(Schema.String, Schema.Unknown),
  metrics: Schema.Record(Schema.String, Schema.Number),
})

// === Application Service Interface ===

export interface WorldGenerationOrchestrator {
  /**
   * 新しいワールドを生成します
   */
  readonly generateWorld: (
    command: Schema.Schema.Type<typeof GenerateWorldCommand>
  ) => Effect.Effect<Schema.Schema.Type<typeof WorldGenerationResult>, WorldGenerationOrchestratorErrorType>

  /**
   * 単一チャンクを生成します
   */
  readonly generateChunk: (
    command: Schema.Schema.Type<typeof GenerateChunkCommand>
  ) => Effect.Effect<Schema.Schema.Type<typeof ChunkGenerationResult>, WorldGenerationOrchestratorErrorType>

  /**
   * 生成設定を更新します
   */
  readonly updateSettings: (
    command: Schema.Schema.Type<typeof UpdateSettingsCommand>
  ) => Effect.Effect<void, WorldGenerationOrchestratorErrorType>

  /**
   * 生成進捗を取得します
   */
  readonly getProgress: (
    query: Schema.Schema.Type<typeof GetProgressQuery>
  ) => Effect.Effect<Schema.Schema.Type<typeof GenerationProgress>, WorldGenerationOrchestratorErrorType>

  /**
   * 生成プロセスをキャンセルします
   */
  readonly cancelGeneration: (
    command: Schema.Schema.Type<typeof CancelGenerationCommand>
  ) => Effect.Effect<boolean, WorldGenerationOrchestratorErrorType>

  /**
   * アクティブな生成セッション一覧を取得します
   */
  readonly listActiveSessions: () => Effect.Effect<string[], WorldGenerationOrchestratorErrorType>

  /**
   * 生成パイプラインの健全性チェックを実行します
   */
  readonly healthCheck: () => Effect.Effect<Record<string, boolean>, WorldGenerationOrchestratorErrorType>
}

// === Context Tag ===

export const WorldGenerationOrchestrator = Context.GenericTag<WorldGenerationOrchestrator>(
  '@minecraft/domain/world/WorldGenerationOrchestrator'
)

// === Helper Functions ===

export const WorldGenerationOrchestratorHelpers = {
  /**
   * ワールド生成とチャンク生成の統合処理
   */
  generateWorldWithChunks: (worldCommand: Schema.Schema.Type<typeof GenerateWorldCommand>) =>
    Effect.gen(function* () {
      const orchestrator = yield* WorldGenerationOrchestrator

      // ワールド生成開始
      const worldResult = yield* orchestrator.generateWorld(worldCommand)

      // チャンク範囲計算
      const chunks = worldCommand.bounds ?
        calculateChunksInBounds(worldCommand.bounds) :
        []

      // 各チャンクを生成
      const chunkResults = yield* Effect.forEach(
        chunks,
        (chunkPos) => orchestrator.generateChunk({
          _tag: 'GenerateChunkCommand',
          chunkPosition: chunkPos,
          worldSeed: worldCommand.seed,
          parameters: worldCommand.parameters,
        }),
        { concurrency: 'unbounded' }
      )

      return {
        worldResult,
        chunkResults,
        totalChunks: chunks.length,
        successfulChunks: chunkResults.filter(r => r.status === 'success').length,
      }
    }),

  /**
   * 進捗監視付きワールド生成
   */
  generateWithProgressMonitoring: (
    worldCommand: Schema.Schema.Type<typeof GenerateWorldCommand>,
    onProgress: (progress: Schema.Schema.Type<typeof GenerationProgress>) => Effect.Effect<void>
  ) =>
    Effect.gen(function* () {
      const orchestrator = yield* WorldGenerationOrchestrator

      // 生成開始
      const generationFiber = yield* Effect.fork(
        orchestrator.generateWorld(worldCommand)
      )

      // 進捗監視
      const progressFiber = yield* Effect.fork(
        Effect.repeat(
          Effect.gen(function* () {
            const progress = yield* orchestrator.getProgress({
              _tag: 'GetProgressQuery',
              generationId: 'temp-id', // 実際には生成IDを使用
              includeDetails: true,
            })
            yield* onProgress(progress)
          }),
          { schedule: Effect.Schedule.spaced('1 seconds') }
        )
      )

      // 生成完了まで待機
      const result = yield* Effect.join(generationFiber)

      // 進捗監視停止
      yield* Effect.interrupt(progressFiber)

      return result
    }),

  /**
   * エラー回復付きチャンク生成
   */
  generateChunkWithRetry: (
    command: Schema.Schema.Type<typeof GenerateChunkCommand>,
    maxRetries: number = 3
  ) =>
    Effect.gen(function* () {
      const orchestrator = yield* WorldGenerationOrchestrator

      return yield* pipe(
        orchestrator.generateChunk(command),
        Effect.retry(Effect.Schedule.exponential('100 millis').pipe(
          Effect.Schedule.compose(Effect.Schedule.recurs(maxRetries))
        )),
        Effect.tapError((error) =>
          Effect.logError(`チャンク生成に失敗しました: ${error.message}`)
        )
      )
    }),
}

// === Utility Functions ===

function calculateChunksInBounds(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const chunks = []
  const chunkSize = 16 // Minecraftの標準チャンクサイズ

  for (let x = Math.floor(bounds.minX / chunkSize); x <= Math.floor(bounds.maxX / chunkSize); x++) {
    for (let z = Math.floor(bounds.minZ / chunkSize); z <= Math.floor(bounds.maxZ / chunkSize); z++) {
      chunks.push({ x, z }) // ChunkCoordinate相当
    }
  }

  return chunks
}

export type {
  GenerateWorldCommand as GenerateWorldCommandType,
  GenerateChunkCommand as GenerateChunkCommandType,
  UpdateSettingsCommand as UpdateSettingsCommandType,
  GetProgressQuery as GetProgressQueryType,
  CancelGenerationCommand as CancelGenerationCommandType,
  WorldGenerationResult as WorldGenerationResultType,
  ChunkGenerationResult as ChunkGenerationResultType,
  GenerationProgress as GenerationProgressType,
  PipelineContext as PipelineContextType,
} from './orchestrator.js'