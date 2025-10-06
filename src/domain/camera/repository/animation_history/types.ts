/**
 * Animation History Repository - Types
 *
 * Cameraアニメーション履歴永続化のためのRepository専用型定義
 * アニメーション記録、統計情報、履歴管理の型安全性確保
 */

import type { CameraId, CameraRotation, Position3D } from '@domain/camera/types'
import { Brand, Clock, Data, Effect, Option, Schema } from 'effect'
import type { EasingType, ViewMode } from '../../value_object/index'

// ========================================
// Repository専用Brand型定義
// ========================================

/**
 * Animation Record ID - アニメーション記録識別子
 */
export type AnimationRecordId = Brand<string, 'AnimationRecordId'>

/**
 * Time Range - 時間範囲指定
 */
export type TimeRange = Brand<
  {
    readonly startTime: number
    readonly endTime: number
  },
  'TimeRange'
>

/**
 * Animation Type - アニメーション種別
 */
export type AnimationType = Data.TaggedEnum<{
  readonly PositionChange: {
    readonly reason: 'player-movement' | 'manual' | 'collision-avoidance'
  }
  readonly RotationChange: {
    readonly reason: 'mouse-input' | 'look-at' | 'animation'
  }
  readonly ViewModeSwitch: {
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
  }
  readonly Cinematic: {
    readonly sequenceName: string
  }
  readonly FOVChange: {
    readonly reason: 'zoom' | 'settings' | 'animation'
  }
  readonly Collision: {
    readonly adjustmentType: 'avoidance' | 'recovery'
  }
}>

/**
 * Interruption Reason - アニメーション中断理由
 */
export type InterruptionReason = Data.TaggedEnum<{
  readonly PlayerInput: {}
  readonly Collision: {
    readonly position: Position3D
  }
  readonly NewAnimation: {
    readonly newAnimationId: AnimationRecordId
  }
  readonly SystemShutdown: {}
  readonly PerformanceIssue: {
    readonly frameDrops: number
  }
  readonly ManualOverride: {
    readonly source: string
  }
}>

/**
 * Animation Record - アニメーション記録
 */
export type AnimationRecord = Brand<
  {
    readonly id: AnimationRecordId
    readonly cameraId: CameraId
    readonly animationType: AnimationType
    readonly startPosition: Position3D
    readonly endPosition: Position3D
    readonly startRotation: CameraRotation
    readonly endRotation: CameraRotation
    readonly duration: number
    readonly easingType: EasingType
    readonly startTime: number
    readonly endTime: number
    readonly success: boolean
    readonly interruption: Option<InterruptionReason>
    readonly metadata: AnimationMetadata
  },
  'AnimationRecord'
>

/**
 * Animation Metadata - アニメーション付帯情報
 */
export type AnimationMetadata = Brand<
  {
    readonly frameRate: number
    readonly performanceScore: number // 0-100
    readonly memoryUsageMB: number
    readonly renderTime: number
    readonly userTriggered: boolean
    readonly priority: AnimationPriority
  },
  'AnimationMetadata'
>

/**
 * Animation Priority - アニメーション優先度
 */
export type AnimationPriority = Data.TaggedEnum<{
  readonly Low: {}
  readonly Normal: {}
  readonly High: {}
  readonly Critical: {}
}>

/**
 * Animation Statistics - アニメーション統計情報
 */
export type AnimationStatistics = Brand<
  {
    readonly totalAnimations: number
    readonly successfulAnimations: number
    readonly interruptedAnimations: number
    readonly averageDuration: number
    readonly averagePerformanceScore: number
    readonly totalPlaytime: number
    readonly animationTypeDistribution: AnimationTypeDistribution
    readonly performanceMetrics: PerformanceMetrics
    readonly timeRangeAnalyzed: TimeRange
  },
  'AnimationStatistics'
>

/**
 * Animation Type Distribution - アニメーション種別分布
 */
export type AnimationTypeDistribution = Brand<
  {
    readonly positionChanges: number
    readonly rotationChanges: number
    readonly viewModeSwitches: number
    readonly cinematics: number
    readonly fovChanges: number
    readonly collisionAdjustments: number
  },
  'AnimationTypeDistribution'
>

/**
 * Performance Metrics - パフォーマンス指標
 */
export type PerformanceMetrics = Brand<
  {
    readonly averageFrameRate: number
    readonly frameDropCount: number
    readonly memoryPeakMB: number
    readonly renderTimeP95: number // 95パーセンタイル
    readonly stutterEvents: number
  },
  'PerformanceMetrics'
>

/**
 * Animation Query Options - アニメーション履歴クエリオプション
 */
export type AnimationQueryOptions = Brand<
  {
    readonly filterByType: Option<AnimationType>
    readonly filterBySuccess: Option<boolean>
    readonly filterByPriority: Option<AnimationPriority>
    readonly sortBy: AnimationSortBy
    readonly includeMetadata: boolean
    readonly limit: Option<number>
  },
  'AnimationQueryOptions'
>

/**
 * Animation Sort By - アニメーション履歴ソート方法
 */
export type AnimationSortBy = Data.TaggedEnum<{
  readonly StartTime: { readonly ascending: boolean }
  readonly Duration: { readonly ascending: boolean }
  readonly PerformanceScore: { readonly ascending: boolean }
  readonly Priority: { readonly ascending: boolean }
}>

// ========================================
// Repository Error型定義
// ========================================

/**
 * Animation History Repository Error
 */
export type AnimationHistoryRepositoryError = Data.TaggedEnum<{
  readonly AnimationRecordNotFound: {
    readonly recordId: AnimationRecordId
  }
  readonly CameraNotFound: {
    readonly cameraId: CameraId
  }
  readonly InvalidTimeRange: {
    readonly startTime: number
    readonly endTime: number
    readonly reason: string
  }
  readonly QueryLimitExceeded: {
    readonly requestedLimit: number
    readonly maxAllowed: number
  }
  readonly StatisticsCalculationFailed: {
    readonly cameraId: CameraId
    readonly reason: string
  }
  readonly StorageError: {
    readonly message: string
    readonly cause: Option<unknown>
  }
  readonly EncodingFailed: {
    readonly recordType: string
    readonly reason: string
  }
  readonly DecodingFailed: {
    readonly recordType: string
    readonly reason: string
  }
  readonly ConcurrencyError: {
    readonly operation: string
    readonly conflictingRecord: Option<AnimationRecordId>
  }
}>

// ========================================
// Schema定義
// ========================================

/**
 * Animation Record ID Schema
 */
export const AnimationRecordIdSchema = Schema.String.pipe(Schema.brand('AnimationRecordId'))

/**
 * Time Range Schema
 */
export const TimeRangeSchema = Schema.Struct({
  startTime: Schema.Number.pipe(Schema.positive()),
  endTime: Schema.Number.pipe(Schema.positive()),
}).pipe(
  Schema.filter((range) => range.endTime > range.startTime, {
    message: () => 'End time must be greater than start time',
  }),
  Schema.brand('TimeRange')
)

/**
 * Animation Type Schema
 */
export const AnimationTypeSchema = Schema.TaggedEnum<AnimationType>()({
  PositionChange: Schema.Struct({
    reason: Schema.Literal('player-movement', 'manual', 'collision-avoidance'),
  }),
  RotationChange: Schema.Struct({
    reason: Schema.Literal('mouse-input', 'look-at', 'animation'),
  }),
  ViewModeSwitch: Schema.Struct({
    fromMode: Schema.String,
    toMode: Schema.String,
  }),
  Cinematic: Schema.Struct({
    sequenceName: Schema.String,
  }),
  FOVChange: Schema.Struct({
    reason: Schema.Literal('zoom', 'settings', 'animation'),
  }),
  Collision: Schema.Struct({
    adjustmentType: Schema.Literal('avoidance', 'recovery'),
  }),
})

/**
 * Interruption Reason Schema
 */
export const InterruptionReasonSchema = Schema.TaggedEnum<InterruptionReason>()({
  PlayerInput: Schema.Struct({}),
  Collision: Schema.Struct({
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
  }),
  NewAnimation: Schema.Struct({
    newAnimationId: AnimationRecordIdSchema,
  }),
  SystemShutdown: Schema.Struct({}),
  PerformanceIssue: Schema.Struct({
    frameDrops: Schema.Number.pipe(Schema.nonNegative()),
  }),
  ManualOverride: Schema.Struct({
    source: Schema.String,
  }),
})

/**
 * Animation Priority Schema
 */
export const AnimationPrioritySchema = Schema.TaggedEnum<AnimationPriority>()({
  Low: Schema.Struct({}),
  Normal: Schema.Struct({}),
  High: Schema.Struct({}),
  Critical: Schema.Struct({}),
})

/**
 * Animation Metadata Schema
 */
export const AnimationMetadataSchema = Schema.Struct({
  frameRate: Schema.Number.pipe(Schema.positive()),
  performanceScore: Schema.Number.pipe(Schema.clamp(0, 100)),
  memoryUsageMB: Schema.Number.pipe(Schema.nonNegative()),
  renderTime: Schema.Number.pipe(Schema.nonNegative()),
  userTriggered: Schema.Boolean,
  priority: AnimationPrioritySchema,
}).pipe(Schema.brand('AnimationMetadata'))

/**
 * Animation Record Schema
 */
export const AnimationRecordSchema = Schema.Struct({
  id: AnimationRecordIdSchema,
  cameraId: Schema.String.pipe(Schema.brand('CameraId')),
  animationType: AnimationTypeSchema,
  startPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  endPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  startRotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
    roll: Schema.Number,
  }),
  endRotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
    roll: Schema.Number,
  }),
  duration: Schema.Number.pipe(Schema.positive()),
  easingType: Schema.String,
  startTime: Schema.Number.pipe(Schema.positive()),
  endTime: Schema.Number.pipe(Schema.positive()),
  success: Schema.Boolean,
  interruption: Schema.OptionFromNullable(InterruptionReasonSchema),
  metadata: AnimationMetadataSchema,
}).pipe(
  Schema.filter((record) => record.endTime > record.startTime, {
    message: () => 'Animation end time must be greater than start time',
  }),
  Schema.brand('AnimationRecord')
)

/**
 * Animation Query Options Schema
 */
export const AnimationQueryOptionsSchema = Schema.Struct({
  filterByType: Schema.OptionFromNullable(AnimationTypeSchema),
  filterBySuccess: Schema.OptionFromNullable(Schema.Boolean),
  filterByPriority: Schema.OptionFromNullable(AnimationPrioritySchema),
  sortBy: Schema.TaggedEnum<AnimationSortBy>()({
    StartTime: Schema.Struct({ ascending: Schema.Boolean }),
    Duration: Schema.Struct({ ascending: Schema.Boolean }),
    PerformanceScore: Schema.Struct({ ascending: Schema.Boolean }),
    Priority: Schema.Struct({ ascending: Schema.Boolean }),
  }),
  includeMetadata: Schema.Boolean,
  limit: Schema.OptionFromNullable(Schema.Number.pipe(Schema.positive())),
}).pipe(Schema.brand('AnimationQueryOptions'))

/**
 * Animation History Repository Error Schema
 */
export const AnimationHistoryRepositoryErrorSchema = Schema.TaggedEnum<AnimationHistoryRepositoryError>()({
  AnimationRecordNotFound: Schema.Struct({
    recordId: AnimationRecordIdSchema,
  }),
  CameraNotFound: Schema.Struct({
    cameraId: Schema.String.pipe(Schema.brand('CameraId')),
  }),
  InvalidTimeRange: Schema.Struct({
    startTime: Schema.Number,
    endTime: Schema.Number,
    reason: Schema.String,
  }),
  QueryLimitExceeded: Schema.Struct({
    requestedLimit: Schema.Number,
    maxAllowed: Schema.Number,
  }),
  StatisticsCalculationFailed: Schema.Struct({
    cameraId: Schema.String.pipe(Schema.brand('CameraId')),
    reason: Schema.String,
  }),
  StorageError: Schema.Struct({
    message: Schema.String,
    cause: Schema.OptionFromNullable(Schema.Unknown),
  }),
  EncodingFailed: Schema.Struct({
    recordType: Schema.String,
    reason: Schema.String,
  }),
  DecodingFailed: Schema.Struct({
    recordType: Schema.String,
    reason: Schema.String,
  }),
  ConcurrencyError: Schema.Struct({
    operation: Schema.String,
    conflictingRecord: Schema.OptionFromNullable(AnimationRecordIdSchema),
  }),
})

// ========================================
// Factory Functions
// ========================================

/**
 * Animation History Repository Error Factory
 */
export const createAnimationHistoryError = {
  animationRecordNotFound: (recordId: AnimationRecordId): AnimationHistoryRepositoryError =>
    Data.tagged('AnimationRecordNotFound', { recordId }),

  cameraNotFound: (cameraId: CameraId): AnimationHistoryRepositoryError => Data.tagged('CameraNotFound', { cameraId }),

  invalidTimeRange: (startTime: number, endTime: number, reason: string): AnimationHistoryRepositoryError =>
    Data.tagged('InvalidTimeRange', { startTime, endTime, reason }),

  queryLimitExceeded: (requestedLimit: number, maxAllowed: number): AnimationHistoryRepositoryError =>
    Data.tagged('QueryLimitExceeded', { requestedLimit, maxAllowed }),

  statisticsCalculationFailed: (cameraId: CameraId, reason: string): AnimationHistoryRepositoryError =>
    Data.tagged('StatisticsCalculationFailed', { cameraId, reason }),

  storageError: (message: string, cause?: unknown): AnimationHistoryRepositoryError =>
    Data.tagged('StorageError', {
      message,
      cause: cause ? Option.some(cause) : Option.none(),
    }),

  encodingFailed: (recordType: string, reason: string): AnimationHistoryRepositoryError =>
    Data.tagged('EncodingFailed', { recordType, reason }),

  decodingFailed: (recordType: string, reason: string): AnimationHistoryRepositoryError =>
    Data.tagged('DecodingFailed', { recordType, reason }),

  concurrencyError: (operation: string, conflictingRecord?: AnimationRecordId): AnimationHistoryRepositoryError =>
    Data.tagged('ConcurrencyError', {
      operation,
      conflictingRecord: conflictingRecord ? Option.some(conflictingRecord) : Option.none(),
    }),
} as const

/**
 * Animation Record Factory
 */
export const createAnimationRecord = {
  /**
   * 新しいアニメーション記録を作成
   */
  create: (
    cameraId: CameraId,
    animationType: AnimationType,
    startPosition: Position3D,
    endPosition: Position3D,
    startRotation: CameraRotation,
    endRotation: CameraRotation,
    duration: number,
    easingType: EasingType
  ): Effect.Effect<AnimationRecord> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const random = yield* Effect.sync(() => Math.random().toString(36).slice(2))
      return {
        id: `anim_${now}_${random}` as AnimationRecordId,
        cameraId,
        animationType,
        startPosition,
        endPosition,
        startRotation,
        endRotation,
        duration,
        easingType,
        startTime: now,
        endTime: now + duration,
        success: false, // 開始時は未完了
        interruption: Option.none(),
        metadata: {
          frameRate: 60,
          performanceScore: 100,
          memoryUsageMB: 0,
          renderTime: 0,
          userTriggered: true,
          priority: Data.tagged('Normal', {}),
        } as AnimationMetadata,
      } as AnimationRecord
    }),

  /**
   * 時間範囲を作成
   */
  timeRange: (startTime: number, endTime: number): TimeRange =>
    ({
      startTime,
      endTime,
    }) as TimeRange,

  /**
   * デフォルトクエリオプションを作成
   */
  defaultQueryOptions: (): AnimationQueryOptions =>
    ({
      filterByType: Option.none(),
      filterBySuccess: Option.none(),
      filterByPriority: Option.none(),
      sortBy: Data.tagged('StartTime', { ascending: false }),
      includeMetadata: true,
      limit: Option.some(100),
    }) as AnimationQueryOptions,
} as const

// ========================================
// Type Guards
// ========================================

/**
 * Animation History Repository Error Type Guards
 */
export const isAnimationRecordNotFoundError = (error: AnimationHistoryRepositoryError): boolean =>
  error._tag === 'AnimationRecordNotFound'

export const isCameraNotFoundError = (error: AnimationHistoryRepositoryError): boolean =>
  error._tag === 'CameraNotFound'

export const isInvalidTimeRangeError = (error: AnimationHistoryRepositoryError): boolean =>
  error._tag === 'InvalidTimeRange'

export const isQueryLimitExceededError = (error: AnimationHistoryRepositoryError): boolean =>
  error._tag === 'QueryLimitExceeded'

export const isStorageError = (error: AnimationHistoryRepositoryError): boolean => error._tag === 'StorageError'

export const isConcurrencyError = (error: AnimationHistoryRepositoryError): boolean => error._tag === 'ConcurrencyError'

/**
 * Animation Type Guards
 */
export const isPositionChangeAnimation = (animationType: AnimationType): boolean =>
  animationType._tag === 'PositionChange'

export const isRotationChangeAnimation = (animationType: AnimationType): boolean =>
  animationType._tag === 'RotationChange'

export const isViewModeSwitchAnimation = (animationType: AnimationType): boolean =>
  animationType._tag === 'ViewModeSwitch'

export const isCinematicAnimation = (animationType: AnimationType): boolean => animationType._tag === 'Cinematic'

/**
 * Priority Guards
 */
export const isCriticalPriority = (priority: AnimationPriority): boolean => priority._tag === 'Critical'

export const isHighPriority = (priority: AnimationPriority): boolean => priority._tag === 'High'
