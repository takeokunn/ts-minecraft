import { Context, Effect, Layer, Match, Option, pipe, Schema, Ref } from 'effect'

/**
 * Adaptive Quality Service
 *
 * パフォーマンス状況に応じて動的に品質設定を調整し、
 * 最適なユーザー体験を維持しながらシステムリソースを効率的に活用します。
 */

// === Quality Levels ===

export const QualityLevel = Schema.Union(
  Schema.Literal('ultra'), // 最高品質
  Schema.Literal('high'), // 高品質
  Schema.Literal('medium'), // 中品質
  Schema.Literal('low'), // 低品質
  Schema.Literal('minimal'), // 最低品質
)

export const QualityProfile = Schema.Struct({
  _tag: Schema.Literal('QualityProfile'),
  profileName: Schema.String,
  overallLevel: QualityLevel,
  settings: Schema.Struct({
    renderDistance: Schema.Number.pipe(Schema.positive()),
    chunkLoadDistance: Schema.Number.pipe(Schema.positive()),
    textureResolution: Schema.Union(
      Schema.Literal('4k'),
      Schema.Literal('2k'),
      Schema.Literal('1k'),
      Schema.Literal('512'),
      Schema.Literal('256'),
    ),
    meshDetailLevel: Schema.Number.pipe(Schema.between(0, 1)),
    shadowQuality: QualityLevel,
    effectsQuality: QualityLevel,
    animationFrameRate: Schema.Number.pipe(Schema.positive(), Schema.int()),
    audioQuality: QualityLevel,
    compressionLevel: Schema.Number.pipe(Schema.between(0, 9)),
  }),
  targetMetrics: Schema.Struct({
    minFPS: Schema.Number.pipe(Schema.positive()),
    maxMemoryUsage: Schema.Number.pipe(Schema.positive()), // バイト
    maxCPUUsage: Schema.Number.pipe(Schema.between(0, 1)),
    maxGPUUsage: Schema.Number.pipe(Schema.between(0, 1)),
  }),
})

// === Performance Metrics ===

export const PerformanceSnapshot = Schema.Struct({
  _tag: Schema.Literal('PerformanceSnapshot'),
  timestamp: Schema.Number,
  fps: Schema.Number.pipe(Schema.positive()),
  frameTime: Schema.Number.pipe(Schema.positive()), // ミリ秒
  cpuUsage: Schema.Number.pipe(Schema.between(0, 1)),
  gpuUsage: Schema.Number.pipe(Schema.between(0, 1)),
  memoryUsage: Schema.Number.pipe(Schema.positive()), // バイト
  networkLatency: Schema.Number.pipe(Schema.positive()), // ミリ秒
  diskIOLoad: Schema.Number.pipe(Schema.between(0, 1)),
  thermalState: Schema.Union(
    Schema.Literal('normal'),
    Schema.Literal('warm'),
    Schema.Literal('hot'),
    Schema.Literal('critical'),
  ),
})

export const PerformanceTrend = Schema.Struct({
  _tag: Schema.Literal('PerformanceTrend'),
  metric: Schema.String,
  direction: Schema.Union(
    Schema.Literal('improving'),
    Schema.Literal('stable'),
    Schema.Literal('degrading'),
  ),
  rate: Schema.Number, // 変化率（毎秒）
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  samples: Schema.Array(Schema.Number),
})

// === Adaptation Strategy ===

export const AdaptationStrategy = Schema.Union(
  Schema.Literal('conservative'), // 保守的調整
  Schema.Literal('balanced'), // バランス重視
  Schema.Literal('aggressive'), // 積極的調整
  Schema.Literal('performance_first'), // パフォーマンス優先
  Schema.Literal('quality_first'), // 品質優先
)

export const AdaptationConfiguration = Schema.Struct({
  _tag: Schema.Literal('AdaptationConfiguration'),
  strategy: AdaptationStrategy,
  enabled: Schema.Boolean,
  adaptationInterval: Schema.Number.pipe(Schema.positive()), // ミリ秒
  stabilityThreshold: Schema.Number.pipe(Schema.positive()), // 変更前の安定期間
  performanceThresholds: Schema.Struct({
    fpsMin: Schema.Number.pipe(Schema.positive()),
    fpsTarget: Schema.Number.pipe(Schema.positive()),
    memoryMax: Schema.Number.pipe(Schema.between(0, 1)),
    cpuMax: Schema.Number.pipe(Schema.between(0, 1)),
    gpuMax: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  adaptationLimits: Schema.Struct({
    maxQualityDropPerCycle: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
    maxQualityIncreasePerCycle: Schema.Number.pipe(Schema.int(), Schema.between(1, 3)),
    minStableTime: Schema.Number.pipe(Schema.positive()), // ミリ秒
  }),
  userPreferences: Schema.Struct({
    prioritizeQuality: Schema.Boolean,
    allowDynamicResolution: Schema.Boolean,
    allowEffectsDisabling: Schema.Boolean,
    minAcceptableQuality: QualityLevel,
    maxAutomaticQuality: QualityLevel,
  }),
})

// === Quality Adjustment ===

export const QualityAdjustment = Schema.Struct({
  _tag: Schema.Literal('QualityAdjustment'),
  adjustmentId: Schema.String,
  timestamp: Schema.Number,
  fromProfile: Schema.String,
  toProfile: Schema.String,
  reason: Schema.String,
  changes: Schema.Array(Schema.Struct({
    setting: Schema.String,
    fromValue: Schema.Unknown,
    toValue: Schema.Unknown,
    impact: Schema.Union(
      Schema.Literal('major'),
      Schema.Literal('moderate'),
      Schema.Literal('minor'),
    ),
  })),
  expectedImprovement: Schema.Struct({
    fpsGain: Schema.Number,
    memoryReduction: Schema.Number,
    cpuReduction: Schema.Number,
  }),
  rollbackPossible: Schema.Boolean,
})

// === Adaptive Quality Error ===

export const AdaptiveQualityError = Schema.TaggedError<AdaptiveQualityErrorType>()(
  'AdaptiveQualityError',
  {
    message: Schema.String,
    adapterId: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
)

export interface AdaptiveQualityErrorType
  extends Schema.Schema.Type<typeof AdaptiveQualityError> {}

// === Service Interface ===

export interface AdaptiveQualityService {
  /**
   * 適応的品質調整を開始します
   */
  readonly startAdaptation: () => Effect.Effect<void, AdaptiveQualityErrorType>

  /**
   * 適応的品質調整を停止します
   */
  readonly stopAdaptation: () => Effect.Effect<void, AdaptiveQualityErrorType>

  /**
   * 現在の品質プロファイルを取得します
   */
  readonly getCurrentProfile: () => Effect.Effect<Schema.Schema.Type<typeof QualityProfile>, AdaptiveQualityErrorType>

  /**
   * パフォーマンススナップショットを記録します
   */
  readonly recordPerformance: (
    snapshot: Schema.Schema.Type<typeof PerformanceSnapshot>
  ) => Effect.Effect<void, AdaptiveQualityErrorType>

  /**
   * 品質を手動調整します
   */
  readonly adjustQuality: (
    targetLevel: QualityLevel,
    force?: boolean
  ) => Effect.Effect<Schema.Schema.Type<typeof QualityAdjustment>, AdaptiveQualityErrorType>

  /**
   * カスタム品質プロファイルを設定します
   */
  readonly setCustomProfile: (
    profile: Schema.Schema.Type<typeof QualityProfile>
  ) => Effect.Effect<void, AdaptiveQualityErrorType>

  /**
   * パフォーマンストレンドを取得します
   */
  readonly getPerformanceTrends: () => Effect.Effect<
    Schema.Schema.Type<typeof PerformanceTrend>[],
    AdaptiveQualityErrorType
  >

  /**
   * 品質調整履歴を取得します
   */
  readonly getAdjustmentHistory: (
    limit?: number
  ) => Effect.Effect<Schema.Schema.Type<typeof QualityAdjustment>[], AdaptiveQualityErrorType>

  /**
   * 最適な品質レベルを推奨します
   */
  readonly recommendQualityLevel: (
    currentMetrics: Schema.Schema.Type<typeof PerformanceSnapshot>
  ) => Effect.Effect<QualityLevel, AdaptiveQualityErrorType>

  /**
   * 品質調整設定を更新します
   */
  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof AdaptationConfiguration>>
  ) => Effect.Effect<void, AdaptiveQualityErrorType>

  /**
   * 品質調整を一時的に無効にします
   */
  readonly pauseAdaptation: (
    durationMs: number
  ) => Effect.Effect<void, AdaptiveQualityErrorType>

  /**
   * 最後の品質調整をロールバックします
   */
  readonly rollbackLastAdjustment: () => Effect.Effect<boolean, AdaptiveQualityErrorType>
}

// === Live Implementation ===

const makeAdaptiveQualityService = Effect.gen(function* () {
  // 内部状態管理
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof AdaptationConfiguration>>(DEFAULT_ADAPTATION_CONFIG)
  const currentProfile = yield* Ref.make<Schema.Schema.Type<typeof QualityProfile>>(DEFAULT_QUALITY_PROFILES.medium)
  const isAdapting = yield* Ref.make<boolean>(false)
  const performanceHistory = yield* Ref.make<Schema.Schema.Type<typeof PerformanceSnapshot>[]>([])
  const adjustmentHistory = yield* Ref.make<Schema.Schema.Type<typeof QualityAdjustment>[]>([])
  const pausedUntil = yield* Ref.make<Option.Option<number>>(Option.none())

  const startAdaptation = () =>
    Effect.gen(function* () {
      const isActive = yield* Ref.get(isAdapting)
      if (isActive) {
        yield* Effect.logWarning('適応的品質調整は既に開始されています')
        return
      }

      yield* Ref.set(isAdapting, true)

      // 適応ループを開始
      yield* Effect.fork(adaptationLoop())

      yield* Effect.logInfo('適応的品質調整開始')
    })

  const stopAdaptation = () =>
    Effect.gen(function* () {
      yield* Ref.set(isAdapting, false)
      yield* Effect.logInfo('適応的品質調整停止')
    })

  const getCurrentProfile = () => Ref.get(currentProfile)

  const recordPerformance = (snapshot: Schema.Schema.Type<typeof PerformanceSnapshot>) =>
    Effect.gen(function* () {
      yield* Ref.update(performanceHistory, history =>
        [...history.slice(-99), snapshot] // 最新100件を保持
      )

      yield* Effect.logDebug(`パフォーマンス記録: FPS=${snapshot.fps}, CPU=${(snapshot.cpuUsage * 100).toFixed(1)}%`)
    })

  const adjustQuality = (targetLevel: QualityLevel, force: boolean = false) =>
    Effect.gen(function* () {
      const current = yield* Ref.get(currentProfile)

      if (current.overallLevel === targetLevel && !force) {
        yield* Effect.logDebug(`品質レベルは既に ${targetLevel} です`)
        return createNoChangeAdjustment(current)
      }

      const targetProfile = DEFAULT_QUALITY_PROFILES[targetLevel]
      const adjustment = yield* createQualityAdjustment(current, targetProfile, `手動調整: ${targetLevel}`)

      yield* Ref.set(currentProfile, targetProfile)
      yield* Ref.update(adjustmentHistory, history => [...history.slice(-49), adjustment])

      yield* Effect.logInfo(`品質調整実行: ${current.overallLevel} → ${targetLevel}`)
      return adjustment
    })

  const setCustomProfile = (profile: Schema.Schema.Type<typeof QualityProfile>) =>
    Effect.gen(function* () {
      yield* Ref.set(currentProfile, profile)
      yield* Effect.logInfo(`カスタム品質プロファイル設定: ${profile.profileName}`)
    })

  const getPerformanceTrends = () =>
    Effect.gen(function* () {
      const history = yield* Ref.get(performanceHistory)

      if (history.length < 5) {
        return []
      }

      const trends: Schema.Schema.Type<typeof PerformanceTrend>[] = [
        calculateTrend(history, 'fps', (s) => s.fps),
        calculateTrend(history, 'cpuUsage', (s) => s.cpuUsage),
        calculateTrend(history, 'memoryUsage', (s) => s.memoryUsage),
        calculateTrend(history, 'frameTime', (s) => s.frameTime),
      ]

      return trends
    })

  const getAdjustmentHistory = (limit: number = 20) =>
    Effect.gen(function* () {
      const history = yield* Ref.get(adjustmentHistory)
      return history.slice(-limit)
    })

  const recommendQualityLevel = (currentMetrics: Schema.Schema.Type<typeof PerformanceSnapshot>) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      const current = yield* Ref.get(currentProfile)

      // パフォーマンス評価
      const fpsScore = currentMetrics.fps >= config.performanceThresholds.fpsTarget ? 1.0 :
        currentMetrics.fps / config.performanceThresholds.fpsTarget

      const memoryScore = currentMetrics.memoryUsage <= (8 * 1024 * 1024 * 1024 * config.performanceThresholds.memoryMax) ? 1.0 : 0.5
      const cpuScore = currentMetrics.cpuUsage <= config.performanceThresholds.cpuMax ? 1.0 : 0.5

      const overallScore = (fpsScore + memoryScore + cpuScore) / 3

      // 推奨レベル決定
      let recommendedLevel: QualityLevel

      if (overallScore >= 0.9) {
        recommendedLevel = 'ultra'
      } else if (overallScore >= 0.75) {
        recommendedLevel = 'high'
      } else if (overallScore >= 0.6) {
        recommendedLevel = 'medium'
      } else if (overallScore >= 0.4) {
        recommendedLevel = 'low'
      } else {
        recommendedLevel = 'minimal'
      }

      // ユーザー制限適用
      const qualityLevels: QualityLevel[] = ['minimal', 'low', 'medium', 'high', 'ultra']
      const minIndex = qualityLevels.indexOf(config.userPreferences.minAcceptableQuality)
      const maxIndex = qualityLevels.indexOf(config.userPreferences.maxAutomaticQuality)
      const recommendedIndex = qualityLevels.indexOf(recommendedLevel)

      const constrainedIndex = Math.max(minIndex, Math.min(maxIndex, recommendedIndex))
      const finalRecommendation = qualityLevels[constrainedIndex]

      yield* Effect.logDebug(`品質推奨: ${finalRecommendation} (スコア: ${overallScore.toFixed(2)})`)
      return finalRecommendation
    })

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof AdaptationConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, current => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('適応的品質設定更新完了')
    })

  const pauseAdaptation = (durationMs: number) =>
    Effect.gen(function* () {
      const resumeTime = Date.now() + durationMs
      yield* Ref.set(pausedUntil, Option.some(resumeTime))
      yield* Effect.logInfo(`適応調整を一時停止: ${durationMs}ms`)
    })

  const rollbackLastAdjustment = () =>
    Effect.gen(function* () {
      const history = yield* Ref.get(adjustmentHistory)
      const lastAdjustment = history[history.length - 1]

      if (!lastAdjustment || !lastAdjustment.rollbackPossible) {
        yield* Effect.logWarning('ロールバック可能な調整がありません')
        return false
      }

      // 前のプロファイルを探して復元
      const previousProfile = findProfileByName(lastAdjustment.fromProfile)
      if (previousProfile) {
        yield* Ref.set(currentProfile, previousProfile)
        yield* Effect.logInfo(`品質調整ロールバック: ${lastAdjustment.toProfile} → ${lastAdjustment.fromProfile}`)
        return true
      }

      return false
    })

  // === Helper Functions ===

  const adaptationLoop = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)

      yield* Effect.repeat(
        Effect.gen(function* () {
          const isActive = yield* Ref.get(isAdapting)
          if (!isActive) return false

          // 一時停止チェック
          const pauseTime = yield* Ref.get(pausedUntil)
          if (Option.isSome(pauseTime) && Date.now() < pauseTime.value) {
            return true
          }
          yield* Ref.set(pausedUntil, Option.none())

          const history = yield* Ref.get(performanceHistory)
          if (history.length < 3) return true

          const latestMetrics = history[history.length - 1]
          const recommendedLevel = yield* recommendQualityLevel(latestMetrics)
          const currentLevel = (yield* Ref.get(currentProfile)).overallLevel

          // 品質調整が必要かチェック
          if (recommendedLevel !== currentLevel) {
            const stabilityCheck = yield* checkStability(history, config.stabilityThreshold)
            if (stabilityCheck) {
              yield* adjustQuality(recommendedLevel)
            }
          }

          return true
        }),
        { schedule: Effect.Schedule.spaced(`${config.adaptationInterval} millis`) }
      )
    })

  const checkStability = (
    history: Schema.Schema.Type<typeof PerformanceSnapshot>[],
    thresholdMs: number
  ) =>
    Effect.gen(function* () {
      if (history.length < 2) return false

      const latest = history[history.length - 1]
      const previous = history[history.length - 2]

      // 最近の変動が安定していることを確認
      const timeDiff = latest.timestamp - previous.timestamp
      const fpsVariation = Math.abs(latest.fps - previous.fps) / previous.fps

      return timeDiff >= thresholdMs && fpsVariation < 0.1 // 10%以内の変動
    })

  const createQualityAdjustment = (
    fromProfile: Schema.Schema.Type<typeof QualityProfile>,
    toProfile: Schema.Schema.Type<typeof QualityProfile>,
    reason: string
  ) =>
    Effect.gen(function* () {
      const changes = []

      // 設定変更を記録
      if (fromProfile.settings.renderDistance !== toProfile.settings.renderDistance) {
        changes.push({
          setting: 'renderDistance',
          fromValue: fromProfile.settings.renderDistance,
          toValue: toProfile.settings.renderDistance,
          impact: 'major' as const,
        })
      }

      if (fromProfile.settings.textureResolution !== toProfile.settings.textureResolution) {
        changes.push({
          setting: 'textureResolution',
          fromValue: fromProfile.settings.textureResolution,
          toValue: toProfile.settings.textureResolution,
          impact: 'moderate' as const,
        })
      }

      const adjustment: Schema.Schema.Type<typeof QualityAdjustment> = {
        _tag: 'QualityAdjustment',
        adjustmentId: `adj_${Date.now()}`,
        timestamp: Date.now(),
        fromProfile: fromProfile.profileName,
        toProfile: toProfile.profileName,
        reason,
        changes,
        expectedImprovement: {
          fpsGain: estimateFPSGain(fromProfile, toProfile),
          memoryReduction: estimateMemoryReduction(fromProfile, toProfile),
          cpuReduction: estimateCPUReduction(fromProfile, toProfile),
        },
        rollbackPossible: true,
      }

      return adjustment
    })

  const createNoChangeAdjustment = (profile: Schema.Schema.Type<typeof QualityProfile>): Schema.Schema.Type<typeof QualityAdjustment> => ({
    _tag: 'QualityAdjustment',
    adjustmentId: `no_change_${Date.now()}`,
    timestamp: Date.now(),
    fromProfile: profile.profileName,
    toProfile: profile.profileName,
    reason: '変更不要',
    changes: [],
    expectedImprovement: { fpsGain: 0, memoryReduction: 0, cpuReduction: 0 },
    rollbackPossible: false,
  })

  const calculateTrend = (
    history: Schema.Schema.Type<typeof PerformanceSnapshot>[],
    metricName: string,
    extractor: (snapshot: Schema.Schema.Type<typeof PerformanceSnapshot>) => number
  ): Schema.Schema.Type<typeof PerformanceTrend> => {
    const values = history.slice(-10).map(extractor) // 最新10件
    const n = values.length

    if (n < 2) {
      return {
        _tag: 'PerformanceTrend',
        metric: metricName,
        direction: 'stable',
        rate: 0,
        confidence: 0,
        samples: values,
      }
    }

    // 線形回帰による傾向計算（簡略化）
    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / n
    const recent = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, n)

    const rate = (recent - mean) / mean
    let direction: 'improving' | 'stable' | 'degrading' = 'stable'

    if (rate > 0.05) direction = 'improving'
    else if (rate < -0.05) direction = 'degrading'

    return {
      _tag: 'PerformanceTrend',
      metric: metricName,
      direction,
      rate,
      confidence: Math.min(1.0, n / 10),
      samples: values,
    }
  }

  const estimateFPSGain = (from: Schema.Schema.Type<typeof QualityProfile>, to: Schema.Schema.Type<typeof QualityProfile>) => {
    const qualityImpact = getQualityImpact(to.overallLevel) - getQualityImpact(from.overallLevel)
    return qualityImpact * 15 // 推定FPS影響
  }

  const estimateMemoryReduction = (from: Schema.Schema.Type<typeof QualityProfile>, to: Schema.Schema.Type<typeof QualityProfile>) => {
    const renderDistanceRatio = to.settings.renderDistance / from.settings.renderDistance
    return (1 - renderDistanceRatio) * 512 * 1024 * 1024 // 推定メモリ削減（バイト）
  }

  const estimateCPUReduction = (from: Schema.Schema.Type<typeof QualityProfile>, to: Schema.Schema.Type<typeof QualityProfile>) => {
    const qualityImpact = getQualityImpact(from.overallLevel) - getQualityImpact(to.overallLevel)
    return qualityImpact * 0.1 // 推定CPU削減率
  }

  const getQualityImpact = (level: QualityLevel) => {
    switch (level) {
      case 'ultra': return 1.0
      case 'high': return 0.8
      case 'medium': return 0.6
      case 'low': return 0.4
      case 'minimal': return 0.2
    }
  }

  const findProfileByName = (name: string): Schema.Schema.Type<typeof QualityProfile> | null => {
    const profiles = Object.values(DEFAULT_QUALITY_PROFILES)
    return profiles.find(p => p.profileName === name) || null
  }

  return AdaptiveQualityService.of({
    startAdaptation,
    stopAdaptation,
    getCurrentProfile,
    recordPerformance,
    adjustQuality,
    setCustomProfile,
    getPerformanceTrends,
    getAdjustmentHistory,
    recommendQualityLevel,
    updateConfiguration,
    pauseAdaptation,
    rollbackLastAdjustment,
  })
})

// === Context Tag ===

export const AdaptiveQualityService = Context.GenericTag<AdaptiveQualityService>(
  '@minecraft/domain/world/AdaptiveQualityService'
)

// === Layer ===

export const AdaptiveQualityServiceLive = Layer.effect(
  AdaptiveQualityService,
  makeAdaptiveQualityService
)

// === Default Configurations ===

export const DEFAULT_ADAPTATION_CONFIG: Schema.Schema.Type<typeof AdaptationConfiguration> = {
  _tag: 'AdaptationConfiguration',
  strategy: 'balanced',
  enabled: true,
  adaptationInterval: 10000, // 10秒
  stabilityThreshold: 5000, // 5秒
  performanceThresholds: {
    fpsMin: 30,
    fpsTarget: 60,
    memoryMax: 0.8,
    cpuMax: 0.8,
    gpuMax: 0.9,
  },
  adaptationLimits: {
    maxQualityDropPerCycle: 2,
    maxQualityIncreasePerCycle: 1,
    minStableTime: 15000, // 15秒
  },
  userPreferences: {
    prioritizeQuality: false,
    allowDynamicResolution: true,
    allowEffectsDisabling: true,
    minAcceptableQuality: 'low',
    maxAutomaticQuality: 'ultra',
  },
}

export const DEFAULT_QUALITY_PROFILES: Record<QualityLevel, Schema.Schema.Type<typeof QualityProfile>> = {
  ultra: {
    _tag: 'QualityProfile',
    profileName: 'Ultra Quality',
    overallLevel: 'ultra',
    settings: {
      renderDistance: 32,
      chunkLoadDistance: 48,
      textureResolution: '4k',
      meshDetailLevel: 1.0,
      shadowQuality: 'ultra',
      effectsQuality: 'ultra',
      animationFrameRate: 60,
      audioQuality: 'ultra',
      compressionLevel: 0,
    },
    targetMetrics: {
      minFPS: 60,
      maxMemoryUsage: 6 * 1024 * 1024 * 1024,
      maxCPUUsage: 0.8,
      maxGPUUsage: 0.9,
    },
  },
  high: {
    _tag: 'QualityProfile',
    profileName: 'High Quality',
    overallLevel: 'high',
    settings: {
      renderDistance: 24,
      chunkLoadDistance: 32,
      textureResolution: '2k',
      meshDetailLevel: 0.8,
      shadowQuality: 'high',
      effectsQuality: 'high',
      animationFrameRate: 60,
      audioQuality: 'high',
      compressionLevel: 2,
    },
    targetMetrics: {
      minFPS: 45,
      maxMemoryUsage: 4 * 1024 * 1024 * 1024,
      maxCPUUsage: 0.7,
      maxGPUUsage: 0.8,
    },
  },
  medium: {
    _tag: 'QualityProfile',
    profileName: 'Medium Quality',
    overallLevel: 'medium',
    settings: {
      renderDistance: 16,
      chunkLoadDistance: 24,
      textureResolution: '1k',
      meshDetailLevel: 0.6,
      shadowQuality: 'medium',
      effectsQuality: 'medium',
      animationFrameRate: 60,
      audioQuality: 'medium',
      compressionLevel: 4,
    },
    targetMetrics: {
      minFPS: 30,
      maxMemoryUsage: 3 * 1024 * 1024 * 1024,
      maxCPUUsage: 0.6,
      maxGPUUsage: 0.7,
    },
  },
  low: {
    _tag: 'QualityProfile',
    profileName: 'Low Quality',
    overallLevel: 'low',
    settings: {
      renderDistance: 12,
      chunkLoadDistance: 16,
      textureResolution: '512',
      meshDetailLevel: 0.4,
      shadowQuality: 'low',
      effectsQuality: 'low',
      animationFrameRate: 30,
      audioQuality: 'low',
      compressionLevel: 6,
    },
    targetMetrics: {
      minFPS: 25,
      maxMemoryUsage: 2 * 1024 * 1024 * 1024,
      maxCPUUsage: 0.5,
      maxGPUUsage: 0.6,
    },
  },
  minimal: {
    _tag: 'QualityProfile',
    profileName: 'Minimal Quality',
    overallLevel: 'minimal',
    settings: {
      renderDistance: 8,
      chunkLoadDistance: 12,
      textureResolution: '256',
      meshDetailLevel: 0.2,
      shadowQuality: 'minimal',
      effectsQuality: 'minimal',
      animationFrameRate: 30,
      audioQuality: 'minimal',
      compressionLevel: 9,
    },
    targetMetrics: {
      minFPS: 20,
      maxMemoryUsage: 1 * 1024 * 1024 * 1024,
      maxCPUUsage: 0.4,
      maxGPUUsage: 0.5,
    },
  },
}

export type {
  QualityProfile as QualityProfileType,
  PerformanceSnapshot as PerformanceSnapshotType,
  PerformanceTrend as PerformanceTrendType,
  AdaptationConfiguration as AdaptationConfigurationType,
  QualityAdjustment as QualityAdjustmentType,
} from './adaptive_quality.js'