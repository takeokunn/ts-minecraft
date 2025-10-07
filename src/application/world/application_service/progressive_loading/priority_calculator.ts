import { Clock, Context, Effect, Layer, Match, pipe, Ref, Schema } from 'effect'

/**
 * Priority Calculator Service
 *
 * プレイヤーの状況と環境に基づいて、チャンク読み込みの優先度を動的に計算します。
 * 複数の要因を考慮した高度な優先度計算アルゴリズムを提供します。
 */

// === Priority Factors ===

export const PriorityFactor = Schema.Struct({
  _tag: Schema.Literal('PriorityFactor'),
  name: Schema.String,
  weight: Schema.Number.pipe(Schema.between(0, 1)),
  value: Schema.Number.pipe(Schema.between(0, 1)),
  description: Schema.String,
})

export const PriorityContext = Schema.Struct({
  _tag: Schema.Literal('PriorityContext'),
  playerPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  chunkPosition: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  playerMovement: Schema.Struct({
    velocity: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
    direction: Schema.Number.pipe(Schema.between(0, 360)),
  }),
  viewDistance: Schema.Number.pipe(Schema.positive()),
  gameMode: Schema.Union(
    Schema.Literal('survival'),
    Schema.Literal('creative'),
    Schema.Literal('adventure'),
    Schema.Literal('spectator')
  ),
  timeOfDay: Schema.Number.pipe(Schema.between(0, 24000)), // Minecraft ticks
  weather: Schema.Union(Schema.Literal('clear'), Schema.Literal('rain'), Schema.Literal('storm')),
  performanceMetrics: Schema.Struct({
    fps: Schema.Number.pipe(Schema.positive()),
    memoryUsage: Schema.Number.pipe(Schema.between(0, 1)),
    renderDistance: Schema.Number.pipe(Schema.positive()),
  }),
  biomeInfo: Schema.optional(
    Schema.Struct({
      biomeType: Schema.String,
      complexity: Schema.Number.pipe(Schema.between(0, 1)),
      structureDensity: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ),
})

export const PriorityCalculationResult = Schema.Struct({
  _tag: Schema.Literal('PriorityCalculationResult'),
  finalPriority: Schema.Number.pipe(Schema.between(0, 100)),
  priorityLevel: Schema.Union(
    Schema.Literal('critical'),
    Schema.Literal('high'),
    Schema.Literal('normal'),
    Schema.Literal('low'),
    Schema.Literal('background')
  ),
  factors: Schema.Array(PriorityFactor),
  reasoning: Schema.String,
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  recommendedAction: Schema.Union(
    Schema.Literal('load_immediately'),
    Schema.Literal('load_soon'),
    Schema.Literal('load_when_available'),
    Schema.Literal('defer_loading'),
    Schema.Literal('skip_loading')
  ),
})

// === Calculation Strategies ===

export const CalculationStrategy = Schema.Union(
  Schema.Literal('distance_based'), // 距離ベース
  Schema.Literal('movement_prediction'), // 移動予測ベース
  Schema.Literal('performance_adaptive'), // パフォーマンス適応
  Schema.Literal('content_aware'), // コンテンツ認識
  Schema.Literal('machine_learning') // 機械学習ベース
)

export const PriorityConfiguration = Schema.Struct({
  _tag: Schema.Literal('PriorityConfiguration'),
  strategy: CalculationStrategy,
  baseFactors: Schema.Record(Schema.String, Schema.Number), // ファクター重み
  distanceWeighting: Schema.Struct({
    linearFactor: Schema.Number.pipe(Schema.between(0, 1)),
    exponentialDecay: Schema.Number.pipe(Schema.positive()),
    maxInfluenceDistance: Schema.Number.pipe(Schema.positive()),
  }),
  movementPrediction: Schema.Struct({
    enabled: Schema.Boolean,
    predictionWindow: Schema.Number.pipe(Schema.positive()), // 秒
    velocityWeight: Schema.Number.pipe(Schema.between(0, 1)),
    accelerationWeight: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  performanceAdaptation: Schema.Struct({
    enabled: Schema.Boolean,
    fpsThresholds: Schema.Struct({
      high: Schema.Number.pipe(Schema.positive()),
      medium: Schema.Number.pipe(Schema.positive()),
      low: Schema.Number.pipe(Schema.positive()),
    }),
    memoryThresholds: Schema.Struct({
      high: Schema.Number.pipe(Schema.between(0, 1)),
      medium: Schema.Number.pipe(Schema.between(0, 1)),
      low: Schema.Number.pipe(Schema.between(0, 1)),
    }),
  }),
  contentAnalysis: Schema.Struct({
    enabled: Schema.Boolean,
    structureWeight: Schema.Number.pipe(Schema.between(0, 1)),
    biomeComplexityWeight: Schema.Number.pipe(Schema.between(0, 1)),
    entityDensityWeight: Schema.Number.pipe(Schema.between(0, 1)),
  }),
})

// === Machine Learning Model ===

export const MLModelPrediction = Schema.Struct({
  _tag: Schema.Literal('MLModelPrediction'),
  priority: Schema.Number.pipe(Schema.between(0, 1)),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  features: Schema.Record(Schema.String, Schema.Number),
  modelVersion: Schema.String,
})

// === Calculator Error ===

export const PriorityCalculatorError = Schema.TaggedError<PriorityCalculatorErrorType>()('PriorityCalculatorError', {
  message: Schema.String,
  context: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
})

export interface PriorityCalculatorErrorType extends Schema.Schema.Type<typeof PriorityCalculatorError> {}

// === Service Interface ===

export interface PriorityCalculatorService {
  /**
   * チャンクの読み込み優先度を計算します
   */
  readonly calculatePriority: (
    context: Schema.Schema.Type<typeof PriorityContext>
  ) => Effect.Effect<Schema.Schema.Type<typeof PriorityCalculationResult>, PriorityCalculatorErrorType>

  /**
   * 複数チャンクの優先度を一括計算します
   */
  readonly calculateBatchPriorities: (
    contexts: Schema.Schema.Type<typeof PriorityContext>[]
  ) => Effect.Effect<Schema.Schema.Type<typeof PriorityCalculationResult>[], PriorityCalculatorErrorType>

  /**
   * 優先度計算設定を更新します
   */
  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof PriorityConfiguration>>
  ) => Effect.Effect<void, PriorityCalculatorErrorType>

  /**
   * 機械学習モデルで優先度を予測します
   */
  readonly predictWithML: (
    context: Schema.Schema.Type<typeof PriorityContext>
  ) => Effect.Effect<Schema.Schema.Type<typeof MLModelPrediction>, PriorityCalculatorErrorType>

  /**
   * 優先度計算の履歴統計を取得します
   */
  readonly getCalculationStatistics: () => Effect.Effect<Record<string, number>, PriorityCalculatorErrorType>

  /**
   * ファクター重みを動的調整します
   */
  readonly adaptFactorWeights: (
    performanceMetrics: Record<string, number>
  ) => Effect.Effect<void, PriorityCalculatorErrorType>

  /**
   * 優先度計算の詳細説明を取得します
   */
  readonly explainPriority: (
    result: Schema.Schema.Type<typeof PriorityCalculationResult>
  ) => Effect.Effect<string, PriorityCalculatorErrorType>
}

// === Live Implementation ===

const makePriorityCalculatorService = Effect.gen(function* () {
  // 内部状態管理
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof PriorityConfiguration>>(DEFAULT_PRIORITY_CONFIG)
  const calculationHistory = yield* Ref.make<
    Array<{
      context: Schema.Schema.Type<typeof PriorityContext>
      result: Schema.Schema.Type<typeof PriorityCalculationResult>
      timestamp: number
    }>
  >([])
  const performanceStats = yield* Ref.make<Record<string, number>>({})

  const calculatePriority = (context: Schema.Schema.Type<typeof PriorityContext>) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)

      yield* Effect.logDebug(`優先度計算開始: チャンク(${context.chunkPosition.x}, ${context.chunkPosition.z})`)

      // 各ファクターの計算
      const factors = yield* calculateAllFactors(context, config)

      // 最終優先度計算
      const finalPriority = yield* calculateFinalPriority(factors, config)

      // 優先度レベル判定
      const priorityLevel = determinePriorityLevel(finalPriority)

      // 推奨アクション決定
      const recommendedAction = determineRecommendedAction(finalPriority, context, config)

      // 信頼度計算
      const confidence = calculateConfidence(factors, context)

      // 理由説明生成
      const reasoning = generateReasoning(factors, finalPriority)

      const result: Schema.Schema.Type<typeof PriorityCalculationResult> = {
        _tag: 'PriorityCalculationResult',
        finalPriority,
        priorityLevel,
        factors,
        reasoning,
        confidence,
        recommendedAction,
      }

      // 履歴記録
      const timestamp = yield* Clock.currentTimeMillis
      yield* Ref.update(calculationHistory, (history) => [
        ...history.slice(-99), // 最新100件を保持
        { context, result, timestamp },
      ])

      yield* Effect.logDebug(`優先度計算完了: ${finalPriority} (${priorityLevel})`)
      return result
    })

  const calculateBatchPriorities = (contexts: Schema.Schema.Type<typeof PriorityContext>[]) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`一括優先度計算開始: ${contexts.length}チャンク`)

      const results = yield* Effect.forEach(contexts, (context) => calculatePriority(context), {
        concurrency: 'unbounded',
      })

      yield* Effect.logInfo(`一括優先度計算完了: ${results.length}件`)
      return results
    })

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof PriorityConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, (current) => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('優先度計算設定更新完了')
    })

  const predictWithML = (context: Schema.Schema.Type<typeof PriorityContext>) =>
    Effect.gen(function* () {
      // 機械学習モデル予測（簡略化実装）
      const features = extractMLFeatures(context)
      const prediction = simulateMLPrediction(features)

      yield* Effect.logDebug(`ML予測完了: 優先度=${prediction.priority}, 信頼度=${prediction.confidence}`)
      return prediction
    })

  const getCalculationStatistics = () =>
    Effect.gen(function* () {
      const history = yield* Ref.get(calculationHistory)
      const stats = yield* Ref.get(performanceStats)

      const calculationStats = {
        totalCalculations: history.length,
        averagePriority:
          history.length > 0 ? history.reduce((sum, h) => sum + h.result.finalPriority, 0) / history.length : 0,
        priorityDistribution: history.reduce(
          (dist, h) => {
            dist[h.result.priorityLevel] = (dist[h.result.priorityLevel] || 0) + 1
            return dist
          },
          {} as Record<string, number>
        ),
        averageConfidence:
          history.length > 0 ? history.reduce((sum, h) => sum + h.result.confidence, 0) / history.length : 0,
        ...stats,
      }

      return calculationStats
    })

  const adaptFactorWeights = (performanceMetrics: Record<string, number>) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)

      // パフォーマンスメトリクスに基づく重み調整
      const adjustedWeights = { ...config.baseFactors }

      // FPSが低い場合は距離重視を強化
      yield* Effect.when(performanceMetrics.fps < 30, () =>
        Effect.sync(() => {
          adjustedWeights.distance = Math.min(1.0, adjustedWeights.distance * 1.2)
          adjustedWeights.complexity = Math.max(0.1, adjustedWeights.complexity * 0.8)
        })
      )

      // メモリ使用量が高い場合は選択的読み込み
      yield* Effect.when(performanceMetrics.memoryUsage > 0.8, () =>
        Effect.sync(() => {
          adjustedWeights.distance = Math.min(1.0, adjustedWeights.distance * 1.5)
          adjustedWeights.prediction = Math.max(0.1, adjustedWeights.prediction * 0.6)
        })
      )

      yield* updateConfiguration({ baseFactors: adjustedWeights })
      yield* Effect.logInfo('ファクター重み動的調整完了')
    })

  const explainPriority = (result: Schema.Schema.Type<typeof PriorityCalculationResult>) =>
    Effect.gen(function* () {
      const explanation = `
優先度計算結果: ${result.finalPriority.toFixed(2)} (${result.priorityLevel})

主要要因:
${result.factors
  .sort((a, b) => b.weight * b.value - a.weight * a.value)
  .slice(0, 3)
  .map((f) => `- ${f.name}: ${(f.weight * f.value * 100).toFixed(1)}% (重み: ${f.weight}, 値: ${f.value})`)
  .join('\n')}

推奨アクション: ${result.recommendedAction}
信頼度: ${(result.confidence * 100).toFixed(1)}%

理由: ${result.reasoning}
      `.trim()

      return explanation
    })

  // === Helper Functions ===

  const calculateAllFactors = (
    context: Schema.Schema.Type<typeof PriorityContext>,
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ) =>
    Effect.gen(function* () {
      const factors: Schema.Schema.Type<typeof PriorityFactor>[] = []

      // 距離ファクター
      const distanceFactor = calculateDistanceFactor(context, config)
      factors.push(distanceFactor)

      // 移動予測ファクター
      yield* Effect.when(config.movementPrediction.enabled, () =>
        Effect.sync(() => {
          const movementFactor = calculateMovementFactor(context, config)
          factors.push(movementFactor)
        })
      )

      // パフォーマンスファクター
      yield* Effect.when(config.performanceAdaptation.enabled, () =>
        Effect.sync(() => {
          const performanceFactor = calculatePerformanceFactor(context, config)
          factors.push(performanceFactor)
        })
      )

      // コンテンツファクター
      yield* Effect.when(config.contentAnalysis.enabled && context.biomeInfo, () =>
        Effect.sync(() => {
          const contentFactor = calculateContentFactor(context, config)
          factors.push(contentFactor)
        })
      )

      // 視界ファクター
      const visibilityFactor = calculateVisibilityFactor(context)
      factors.push(visibilityFactor)

      // 時間・天候ファクター
      const environmentalFactor = calculateEnvironmentalFactor(context)
      factors.push(environmentalFactor)

      return factors
    })

  const calculateDistanceFactor = (
    context: Schema.Schema.Type<typeof PriorityContext>,
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ): Schema.Schema.Type<typeof PriorityFactor> => {
    const chunkSize = 16
    const dx = context.chunkPosition.x * chunkSize + 8 - context.playerPosition.x
    const dz = context.chunkPosition.z * chunkSize + 8 - context.playerPosition.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    const maxDistance = config.distanceWeighting.maxInfluenceDistance
    const normalizedDistance = Math.min(distance / maxDistance, 1.0)
    const distanceValue = Math.exp(-normalizedDistance * config.distanceWeighting.exponentialDecay)

    return {
      _tag: 'PriorityFactor',
      name: 'distance',
      weight: config.baseFactors.distance || 0.4,
      value: distanceValue,
      description: `プレイヤーからの距離: ${distance.toFixed(1)}m`,
    }
  }

  const calculateMovementFactor = (
    context: Schema.Schema.Type<typeof PriorityContext>,
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ): Schema.Schema.Type<typeof PriorityFactor> => {
    const chunkSize = 16
    const chunkCenterX = context.chunkPosition.x * chunkSize + 8
    const chunkCenterZ = context.chunkPosition.z * chunkSize + 8

    // プレイヤーの移動方向ベクトル
    const velMag = Math.sqrt(context.playerMovement.velocity.x ** 2 + context.playerMovement.velocity.z ** 2)

    if (velMag < 0.1) {
      return {
        _tag: 'PriorityFactor',
        name: 'movement',
        weight: config.baseFactors.prediction || 0.2,
        value: 0.5, // 静止中は中間値
        description: 'プレイヤーは静止中',
      }
    }

    // チャンクへの方向ベクトル
    const toChunkX = chunkCenterX - context.playerPosition.x
    const toChunkZ = chunkCenterZ - context.playerPosition.z
    const toChunkMag = Math.sqrt(toChunkX ** 2 + toChunkZ ** 2)

    // 内積による方向性計算
    const dotProduct =
      (context.playerMovement.velocity.x * toChunkX + context.playerMovement.velocity.z * toChunkZ) /
      (velMag * toChunkMag)

    const movementValue = Math.max(0, dotProduct) // 0-1に正規化

    return {
      _tag: 'PriorityFactor',
      name: 'movement',
      weight: config.baseFactors.prediction || 0.2,
      value: movementValue,
      description: `移動方向との一致度: ${(movementValue * 100).toFixed(1)}%`,
    }
  }

  const calculatePerformanceFactor = (
    context: Schema.Schema.Type<typeof PriorityContext>,
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ): Schema.Schema.Type<typeof PriorityFactor> => {
    const fps = context.performanceMetrics.fps
    const memory = context.performanceMetrics.memoryUsage

    // FPS影響（ルールベース）
    const fpsMultiplier = pipe(
      Match.value(fps),
      Match.when(
        (f) => f < config.performanceAdaptation.fpsThresholds.low,
        () => 0.3
      ),
      Match.when(
        (f) => f < config.performanceAdaptation.fpsThresholds.medium,
        () => 0.6
      ),
      Match.when(
        (f) => f < config.performanceAdaptation.fpsThresholds.high,
        () => 0.8
      ),
      Match.orElse(() => 1.0)
    )

    // メモリ影響（ルールベース）
    const memoryMultiplier = pipe(
      Match.value(memory),
      Match.when(
        (m) => m > config.performanceAdaptation.memoryThresholds.high,
        () => 0.4
      ),
      Match.when(
        (m) => m > config.performanceAdaptation.memoryThresholds.medium,
        () => 0.7
      ),
      Match.orElse(() => 1.0)
    )

    const performanceValue = fpsMultiplier * memoryMultiplier

    return {
      _tag: 'PriorityFactor',
      name: 'performance',
      weight: config.baseFactors.performance || 0.3,
      value: performanceValue,
      description: `パフォーマンス状況: FPS=${fps}, メモリ=${(memory * 100).toFixed(1)}%`,
    }
  }

  const calculateContentFactor = (
    context: Schema.Schema.Type<typeof PriorityContext>,
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ): Schema.Schema.Type<typeof PriorityFactor> => {
    const biome = context.biomeInfo!
    const complexity = biome.complexity * config.contentAnalysis.biomeComplexityWeight
    const structures = biome.structureDensity * config.contentAnalysis.structureWeight

    const contentValue = Math.min(1.0, complexity + structures)

    return {
      _tag: 'PriorityFactor',
      name: 'content',
      weight: config.baseFactors.content || 0.15,
      value: contentValue,
      description: `コンテンツ複雑度: ${biome.biomeType} (複雑度: ${biome.complexity})`,
    }
  }

  const calculateVisibilityFactor = (
    context: Schema.Schema.Type<typeof PriorityContext>
  ): Schema.Schema.Type<typeof PriorityFactor> => {
    const chunkSize = 16
    const dx = context.chunkPosition.x * chunkSize + 8 - context.playerPosition.x
    const dz = context.chunkPosition.z * chunkSize + 8 - context.playerPosition.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    const visibilityValue = distance <= context.viewDistance ? 1.0 : 0.2

    return {
      _tag: 'PriorityFactor',
      name: 'visibility',
      weight: 0.25,
      value: visibilityValue,
      description: `視界範囲内: ${distance <= context.viewDistance ? 'はい' : 'いいえ'}`,
    }
  }

  const calculateEnvironmentalFactor = (
    context: Schema.Schema.Type<typeof PriorityContext>
  ): Schema.Schema.Type<typeof PriorityFactor> => {
    // 夜間は可視性が下がるため優先度調整
    const dayTime = context.timeOfDay % 24000
    const timeMultiplier = dayTime > 13000 && dayTime < 23000 ? 0.8 : 1.0

    // 天候による影響（ルールベース）
    const weatherMultiplier = pipe(
      Match.value(context.weather),
      Match.when('rain', () => 0.9),
      Match.when('storm', () => 0.7),
      Match.orElse(() => 1.0)
    )

    const environmentalValue = timeMultiplier * weatherMultiplier

    return {
      _tag: 'PriorityFactor',
      name: 'environmental',
      weight: 0.1,
      value: environmentalValue,
      description: `環境条件: ${context.weather}, 時刻: ${Math.floor(dayTime / 1000)}`,
    }
  }

  const calculateFinalPriority = (
    factors: Schema.Schema.Type<typeof PriorityFactor>[],
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ) =>
    Effect.gen(function* () {
      const weightedSum = factors.reduce((sum, factor) => sum + factor.weight * factor.value, 0)
      const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0)

      const normalizedPriority = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0

      return Math.max(0, Math.min(100, normalizedPriority))
    })

  const determinePriorityLevel = (priority: number) =>
    pipe(
      Match.value(priority),
      Match.when(
        (p) => p >= 90,
        () => 'critical' as const
      ),
      Match.when(
        (p) => p >= 70,
        () => 'high' as const
      ),
      Match.when(
        (p) => p >= 40,
        () => 'normal' as const
      ),
      Match.when(
        (p) => p >= 20,
        () => 'low' as const
      ),
      Match.orElse(() => 'background' as const)
    )

  const determineRecommendedAction = (
    priority: number,
    context: Schema.Schema.Type<typeof PriorityContext>,
    config: Schema.Schema.Type<typeof PriorityConfiguration>
  ) =>
    pipe(
      Match.value(priority),
      Match.when(
        (p) => p >= 90,
        () => 'load_immediately' as const
      ),
      Match.when(
        (p) => p >= 70,
        () => 'load_soon' as const
      ),
      Match.when(
        (p) => p >= 40,
        () => 'load_when_available' as const
      ),
      Match.when(
        (p) => p >= 20,
        () => 'defer_loading' as const
      ),
      Match.orElse(() => 'skip_loading' as const)
    )

  const calculateConfidence = (
    factors: Schema.Schema.Type<typeof PriorityFactor>[],
    context: Schema.Schema.Type<typeof PriorityContext>
  ) => {
    // 利用可能な情報の完全性に基づく信頼度計算
    const baseConfidence = 0.5
    const factorBonus = factors.length * 0.1
    const biomeBonus = context.biomeInfo ? 0.2 : 0.0
    const fpsBonus = context.performanceMetrics.fps > 0 ? 0.1 : 0.0

    const confidence = baseConfidence + factorBonus + biomeBonus + fpsBonus

    return Math.min(1.0, confidence)
  }

  const generateReasoning = (factors: Schema.Schema.Type<typeof PriorityFactor>[], finalPriority: number) => {
    const topFactors = factors.sort((a, b) => b.weight * b.value - a.weight * a.value).slice(0, 2)

    return `主要要因: ${topFactors.map((f) => f.name).join(', ')}による優先度 ${finalPriority.toFixed(1)}`
  }

  const extractMLFeatures = (context: Schema.Schema.Type<typeof PriorityContext>) => {
    const chunkSize = 16
    const dx = context.chunkPosition.x * chunkSize + 8 - context.playerPosition.x
    const dz = context.chunkPosition.z * chunkSize + 8 - context.playerPosition.z

    return {
      distance: Math.sqrt(dx * dx + dz * dz),
      velocityMagnitude: Math.sqrt(context.playerMovement.velocity.x ** 2 + context.playerMovement.velocity.z ** 2),
      fps: context.performanceMetrics.fps,
      memoryUsage: context.performanceMetrics.memoryUsage,
      timeOfDay: context.timeOfDay,
      isNight: context.timeOfDay % 24000 > 13000 && context.timeOfDay % 24000 < 23000 ? 1 : 0,
      isRaining: context.weather === 'rain' || context.weather === 'storm' ? 1 : 0,
    }
  }

  const simulateMLPrediction = (features: Record<string, number>): Schema.Schema.Type<typeof MLModelPrediction> => {
    // 簡略化されたML予測シミュレーション
    const distanceWeight = Math.exp(-features.distance / 100)
    const performanceWeight = features.fps / 60
    const timeWeight = features.isNight ? 0.8 : 1.0

    const priority = distanceWeight * 0.5 + performanceWeight * 0.3 + timeWeight * 0.2
    const confidence = 0.75 + Math.random() * 0.2 // 0.75-0.95の範囲

    return {
      _tag: 'MLModelPrediction',
      priority,
      confidence,
      features,
      modelVersion: 'v1.0.0-simulation',
    }
  }

  return PriorityCalculatorService.of({
    calculatePriority,
    calculateBatchPriorities,
    updateConfiguration,
    predictWithML,
    getCalculationStatistics,
    adaptFactorWeights,
    explainPriority,
  })
})

// === Context Tag ===

export const PriorityCalculatorService = Context.GenericTag<PriorityCalculatorService>(
  '@minecraft/domain/world/PriorityCalculatorService'
)

// === Layer ===

export const PriorityCalculatorServiceLive = Layer.effect(PriorityCalculatorService, makePriorityCalculatorService)

// === Default Configuration ===

export const DEFAULT_PRIORITY_CONFIG: Schema.Schema.Type<typeof PriorityConfiguration> = {
  _tag: 'PriorityConfiguration',
  strategy: 'performance_adaptive',
  baseFactors: {
    distance: 0.4,
    prediction: 0.2,
    performance: 0.3,
    content: 0.15,
    visibility: 0.25,
    environmental: 0.1,
  },
  distanceWeighting: {
    linearFactor: 0.3,
    exponentialDecay: 2.0,
    maxInfluenceDistance: 320, // 20チャンク
  },
  movementPrediction: {
    enabled: true,
    predictionWindow: 10.0,
    velocityWeight: 0.7,
    accelerationWeight: 0.3,
  },
  performanceAdaptation: {
    enabled: true,
    fpsThresholds: { high: 60, medium: 30, low: 15 },
    memoryThresholds: { high: 0.8, medium: 0.6, low: 0.4 },
  },
  contentAnalysis: {
    enabled: true,
    structureWeight: 0.3,
    biomeComplexityWeight: 0.4,
    entityDensityWeight: 0.3,
  },
}

export type {
  MLModelPrediction as MLModelPredictionType,
  PriorityCalculationResult as PriorityCalculationResultType,
  PriorityConfiguration as PriorityConfigurationType,
  PriorityContext as PriorityContextType,
  PriorityFactor as PriorityFactorType,
} from './priority_calculator'
