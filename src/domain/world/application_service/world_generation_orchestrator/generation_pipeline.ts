import { Context, Effect, Fiber, Layer, Match, Option, pipe, Schema, STM } from 'effect'
import type { GenerationStageType, PipelineContextType } from './index'

/**
 * Generation Pipeline Service
 *
 * ワールド生成の各段階を順次実行するパイプライン管理を担当します。
 * 各段階の依存関係を適切に管理し、並列実行可能な部分を最適化します。
 */

// === Pipeline Configuration ===

export const PipelineStageConfig = Schema.Struct({
  _tag: Schema.Literal('PipelineStageConfig'),
  stage: Schema.Union(
    Schema.Literal('terrain_generation'),
    Schema.Literal('biome_assignment'),
    Schema.Literal('cave_carving'),
    Schema.Literal('ore_placement'),
    Schema.Literal('structure_spawning'),
    Schema.Literal('post_processing'),
    Schema.Literal('validation')
  ),
  enabled: Schema.Boolean,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  timeout: Schema.Number.pipe(Schema.positive()),
  retryPolicy: Schema.Struct({
    maxRetries: Schema.Number.pipe(Schema.nonNegativeInteger()),
    backoffMs: Schema.Number.pipe(Schema.positive()),
    exponential: Schema.Boolean,
  }),
  parallelizable: Schema.Boolean,
  dependencies: Schema.Array(Schema.String),
  resourceRequirements: Schema.Struct({
    cpuIntensive: Schema.Boolean,
    memoryIntensive: Schema.Boolean,
    ioIntensive: Schema.Boolean,
  }),
})

export const PipelineConfiguration = Schema.Struct({
  _tag: Schema.Literal('PipelineConfiguration'),
  stages: Schema.Array(PipelineStageConfig),
  maxConcurrency: Schema.Number.pipe(Schema.positive(), Schema.int()),
  globalTimeout: Schema.Number.pipe(Schema.positive()),
  validateIntermediate: Schema.Boolean,
  enableCheckpoints: Schema.Boolean,
  errorStrategy: Schema.Union(
    Schema.Literal('fail_fast'),
    Schema.Literal('continue_on_error'),
    Schema.Literal('retry_failed')
  ),
})

// === Pipeline State ===

export const PipelineState = Schema.Struct({
  _tag: Schema.Literal('PipelineState'),
  pipelineId: Schema.String,
  currentStage: Schema.optional(Schema.String),
  completedStages: Schema.Array(Schema.String),
  failedStages: Schema.Array(Schema.String),
  startTime: Schema.Number,
  lastUpdateTime: Schema.Number,
  status: Schema.Union(
    Schema.Literal('initialized'),
    Schema.Literal('running'),
    Schema.Literal('paused'),
    Schema.Literal('completed'),
    Schema.Literal('failed'),
    Schema.Literal('cancelled')
  ),
  progress: Schema.Number.pipe(Schema.between(0, 100)),
  metrics: Schema.Record(Schema.String, Schema.Number),
  errors: Schema.Array(Schema.String),
  checkpoints: Schema.Record(Schema.String, Schema.Unknown),
})

// === Stage Execution Result ===

export const StageExecutionResult = Schema.Struct({
  _tag: Schema.Literal('StageExecutionResult'),
  stage: Schema.String,
  status: Schema.Union(Schema.Literal('success'), Schema.Literal('failed'), Schema.Literal('skipped')),
  duration: Schema.Number.pipe(Schema.positive()),
  output: Schema.Unknown,
  metrics: Schema.Record(Schema.String, Schema.Number),
  warnings: Schema.Array(Schema.String),
  errors: Schema.Array(Schema.String),
  checkpoint: Schema.optional(Schema.Unknown),
})

// === Pipeline Error ===

export const GenerationPipelineError = Schema.TaggedError<GenerationPipelineErrorType>()('GenerationPipelineError', {
  message: Schema.String,
  pipelineId: Schema.String,
  stage: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  recovery: Schema.optional(Schema.String),
})

export interface GenerationPipelineErrorType extends Schema.Schema.Type<typeof GenerationPipelineError> {}

// === Service Interface ===

export interface GenerationPipelineService {
  /**
   * パイプラインを作成・初期化します
   */
  readonly createPipeline: (
    pipelineId: string,
    config: Schema.Schema.Type<typeof PipelineConfiguration>,
    context: PipelineContextType
  ) => Effect.Effect<void, GenerationPipelineErrorType>

  /**
   * パイプラインを実行します
   */
  readonly executePipeline: (
    pipelineId: string
  ) => Effect.Effect<Schema.Schema.Type<typeof PipelineState>, GenerationPipelineErrorType>

  /**
   * 単一ステージを実行します
   */
  readonly executeStage: (
    pipelineId: string,
    stage: GenerationStageType
  ) => Effect.Effect<Schema.Schema.Type<typeof StageExecutionResult>, GenerationPipelineErrorType>

  /**
   * パイプラインを一時停止します
   */
  readonly pausePipeline: (pipelineId: string) => Effect.Effect<void, GenerationPipelineErrorType>

  /**
   * パイプラインを再開します
   */
  readonly resumePipeline: (pipelineId: string) => Effect.Effect<void, GenerationPipelineErrorType>

  /**
   * パイプラインをキャンセルします
   */
  readonly cancelPipeline: (pipelineId: string, graceful: boolean) => Effect.Effect<void, GenerationPipelineErrorType>

  /**
   * パイプライン状態を取得します
   */
  readonly getPipelineState: (
    pipelineId: string
  ) => Effect.Effect<Schema.Schema.Type<typeof PipelineState>, GenerationPipelineErrorType>

  /**
   * チェックポイントからパイプラインを復元します
   */
  readonly restoreFromCheckpoint: (
    pipelineId: string,
    checkpointId: string
  ) => Effect.Effect<void, GenerationPipelineErrorType>

  /**
   * パイプライン設定を更新します
   */
  readonly updateConfiguration: (
    pipelineId: string,
    config: Partial<Schema.Schema.Type<typeof PipelineConfiguration>>
  ) => Effect.Effect<void, GenerationPipelineErrorType>
}

// === Live Implementation ===

const makeGenerationPipelineService = Effect.gen(function* () {
  // 内部状態管理（STMを使用した並行安全な状態管理）
  const pipelines = yield* STM.ref<Map<string, Schema.Schema.Type<typeof PipelineState>>>(new Map())
  const configurations = yield* STM.ref<Map<string, Schema.Schema.Type<typeof PipelineConfiguration>>>(new Map())
  const executionFibers = yield* STM.ref<Map<string, Fiber.RuntimeFiber<any, any>>>(new Map())

  const createPipeline = (
    pipelineId: string,
    config: Schema.Schema.Type<typeof PipelineConfiguration>,
    context: PipelineContextType
  ) =>
    Effect.gen(function* () {
      const initialState: Schema.Schema.Type<typeof PipelineState> = {
        _tag: 'PipelineState',
        pipelineId,
        currentStage: Option.none(),
        completedStages: [],
        failedStages: [],
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        status: 'initialized',
        progress: 0,
        metrics: {},
        errors: [],
        checkpoints: {},
      }

      yield* STM.commit(
        STM.gen(function* () {
          yield* STM.modify(pipelines, (map) => map.set(pipelineId, initialState))
          yield* STM.modify(configurations, (map) => map.set(pipelineId, config))
        })
      )

      yield* Effect.logInfo(`パイプライン作成完了: ${pipelineId}`)
    })

  const executePipeline = (pipelineId: string) =>
    Effect.gen(function* () {
      const config = yield* Effect.flatMap(
        STM.commit(
          STM.flatMap(STM.get(configurations), (map) => STM.succeed(Option.fromNullable(map.get(pipelineId))))
        ),
        Option.match({
          onNone: () =>
            Effect.fail({
              _tag: 'GenerationPipelineError' as const,
              message: `パイプライン設定が見つかりません: ${pipelineId}`,
              pipelineId,
            }),
          onSome: Effect.succeed,
        })
      )

      // パイプライン実行開始
      yield* updatePipelineState(pipelineId, { status: 'running' })

      const sortedStages = config.stages.sort((a, b) => a.priority - b.priority).filter((stage) => stage.enabled)

      // 段階的実行
      let completedStages: string[] = []
      let failedStages: string[] = []

      for (const stageConfig of sortedStages) {
        // 依存関係チェック
        const dependenciesMet = stageConfig.dependencies.every((dep) => completedStages.includes(dep))

        if (!dependenciesMet) {
          yield* Effect.logWarning(`ステージ ${stageConfig.stage} の依存関係が満たされていません`)
          continue
        }

        try {
          yield* Effect.logInfo(`ステージ実行開始: ${stageConfig.stage}`)

          const result = yield* pipe(
            executeStageInternal(pipelineId, stageConfig.stage, stageConfig),
            Effect.timeout(`${stageConfig.timeout} millis`)
          )

          if (result.status === 'success') {
            completedStages.push(stageConfig.stage)
            yield* updatePipelineState(pipelineId, {
              completedStages,
              progress: (completedStages.length / sortedStages.length) * 100,
            })
          } else {
            failedStages.push(stageConfig.stage)
            yield* updatePipelineState(pipelineId, { failedStages })

            if (config.errorStrategy === 'fail_fast') {
              throw new Error(`ステージ失敗: ${stageConfig.stage}`)
            }
          }
        } catch (error) {
          failedStages.push(stageConfig.stage)
          yield* Effect.logError(`ステージ実行エラー: ${stageConfig.stage} - ${error}`)

          if (config.errorStrategy === 'fail_fast') {
            yield* updatePipelineState(pipelineId, { status: 'failed', failedStages })
            return yield* Effect.fail({
              _tag: 'GenerationPipelineError' as const,
              message: `パイプライン実行失敗: ${error}`,
              pipelineId,
              stage: stageConfig.stage,
              cause: error,
            })
          }
        }
      }

      // 完了状態更新
      const finalStatus = failedStages.length > 0 ? 'failed' : 'completed'
      yield* updatePipelineState(pipelineId, {
        status: finalStatus,
        progress: 100,
        completedStages,
        failedStages,
      })

      return yield* getCurrentState(pipelineId)
    })

  const executeStage = (pipelineId: string, stage: GenerationStageType) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`単一ステージ実行: ${stage}`)
      return yield* executeStageInternal(pipelineId, stage)
    })

  const pausePipeline = (pipelineId: string) =>
    Effect.gen(function* () {
      yield* updatePipelineState(pipelineId, { status: 'paused' })
      yield* Effect.logInfo(`パイプライン一時停止: ${pipelineId}`)
    })

  const resumePipeline = (pipelineId: string) =>
    Effect.gen(function* () {
      yield* updatePipelineState(pipelineId, { status: 'running' })
      yield* Effect.logInfo(`パイプライン再開: ${pipelineId}`)
    })

  const cancelPipeline = (pipelineId: string, graceful: boolean) =>
    Effect.gen(function* () {
      if (graceful) {
        yield* Effect.logInfo(`パイプライン安全停止開始: ${pipelineId}`)
        // チェックポイント保存等の処理
      }

      yield* updatePipelineState(pipelineId, { status: 'cancelled' })
      yield* Effect.logInfo(`パイプラインキャンセル: ${pipelineId}`)
    })

  const getPipelineState = (pipelineId: string) => getCurrentState(pipelineId)

  const restoreFromCheckpoint = (pipelineId: string, checkpointId: string) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`チェックポイントから復元: ${pipelineId}:${checkpointId}`)
      // チェックポイントデータの復元処理
    })

  const updateConfiguration = (
    pipelineId: string,
    configUpdate: Partial<Schema.Schema.Type<typeof PipelineConfiguration>>
  ) =>
    Effect.gen(function* () {
      yield* STM.commit(
        STM.modify(configurations, (map) => {
          const current = map.get(pipelineId)
          if (current) {
            map.set(pipelineId, { ...current, ...configUpdate })
          }
          return map
        })
      )
      yield* Effect.logInfo(`パイプライン設定更新: ${pipelineId}`)
    })

  // === Helper Functions ===

  const updatePipelineState = (pipelineId: string, update: Partial<Schema.Schema.Type<typeof PipelineState>>) =>
    STM.commit(
      STM.modify(pipelines, (map) => {
        const current = map.get(pipelineId)
        if (current) {
          map.set(pipelineId, {
            ...current,
            ...update,
            lastUpdateTime: Date.now(),
          })
        }
        return map
      })
    )

  const getCurrentState = (pipelineId: string) =>
    Effect.flatMap(
      STM.commit(STM.flatMap(STM.get(pipelines), (map) => STM.succeed(Option.fromNullable(map.get(pipelineId))))),
      Option.match({
        onNone: () =>
          Effect.fail({
            _tag: 'GenerationPipelineError' as const,
            message: `パイプライン状態が見つかりません: ${pipelineId}`,
            pipelineId,
          }),
        onSome: Effect.succeed,
      })
    )

  const executeStageInternal = (
    pipelineId: string,
    stage: string,
    config?: Schema.Schema.Type<typeof PipelineStageConfig>
  ) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      yield* updatePipelineState(pipelineId, { currentStage: stage })

      // ステージ固有の実行ロジック
      const output = yield* Match.value(stage).pipe(
        Match.when('terrain_generation', () => executeTerrainGeneration()),
        Match.when('biome_assignment', () => executeBiomeAssignment()),
        Match.when('cave_carving', () => executeCaveCarving()),
        Match.when('ore_placement', () => executeOrePlacement()),
        Match.when('structure_spawning', () => executeStructureSpawning()),
        Match.when('post_processing', () => executePostProcessing()),
        Match.when('validation', () => executeValidation()),
        Match.exhaustive
      )

      const duration = Date.now() - startTime

      const result: Schema.Schema.Type<typeof StageExecutionResult> = {
        _tag: 'StageExecutionResult',
        stage,
        status: 'success',
        duration,
        output,
        metrics: {
          executionTime: duration,
          memoryUsed: 0, // 実際のメモリ使用量を取得
        },
        warnings: [],
        errors: [],
      }

      return result
    })

  // === Stage Implementation Stubs ===

  const executeTerrainGeneration = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('地形生成実行中...')
      yield* Effect.sleep('500 millis') // シミュレーション
      return { terrain: 'generated' }
    })

  const executeBiomeAssignment = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('バイオーム割り当て実行中...')
      yield* Effect.sleep('300 millis')
      return { biomes: 'assigned' }
    })

  const executeCaveCarving = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('洞窟彫刻実行中...')
      yield* Effect.sleep('400 millis')
      return { caves: 'carved' }
    })

  const executeOrePlacement = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('鉱石配置実行中...')
      yield* Effect.sleep('200 millis')
      return { ores: 'placed' }
    })

  const executeStructureSpawning = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('構造物生成実行中...')
      yield* Effect.sleep('600 millis')
      return { structures: 'spawned' }
    })

  const executePostProcessing = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('後処理実行中...')
      yield* Effect.sleep('100 millis')
      return { postProcessing: 'completed' }
    })

  const executeValidation = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('検証実行中...')
      yield* Effect.sleep('150 millis')
      return { validation: 'passed' }
    })

  return GenerationPipelineService.of({
    createPipeline,
    executePipeline,
    executeStage,
    pausePipeline,
    resumePipeline,
    cancelPipeline,
    getPipelineState,
    restoreFromCheckpoint,
    updateConfiguration,
  })
})

// === Context Tag ===

export const GenerationPipelineService = Context.GenericTag<GenerationPipelineService>(
  '@minecraft/domain/world/GenerationPipelineService'
)

// === Layer ===

export const GenerationPipelineServiceLive = Layer.effect(GenerationPipelineService, makeGenerationPipelineService)

// === Default Configurations ===

export const DEFAULT_PIPELINE_CONFIG: Schema.Schema.Type<typeof PipelineConfiguration> = {
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
    {
      _tag: 'PipelineStageConfig',
      stage: 'biome_assignment',
      enabled: true,
      priority: 2,
      timeout: 15000,
      retryPolicy: { maxRetries: 2, backoffMs: 500, exponential: false },
      parallelizable: true,
      dependencies: ['terrain_generation'],
      resourceRequirements: { cpuIntensive: false, memoryIntensive: false, ioIntensive: false },
    },
    {
      _tag: 'PipelineStageConfig',
      stage: 'cave_carving',
      enabled: true,
      priority: 3,
      timeout: 20000,
      retryPolicy: { maxRetries: 2, backoffMs: 750, exponential: true },
      parallelizable: true,
      dependencies: ['terrain_generation', 'biome_assignment'],
      resourceRequirements: { cpuIntensive: true, memoryIntensive: false, ioIntensive: false },
    },
    // 他のステージも同様に定義...
  ],
  maxConcurrency: 4,
  globalTimeout: 300000, // 5分
  validateIntermediate: true,
  enableCheckpoints: true,
  errorStrategy: 'retry_failed',
}

export type {
  PipelineConfiguration as PipelineConfigurationType,
  PipelineState as PipelineStateType,
  StageExecutionResult as StageExecutionResultType,
} from './generation_pipeline'
