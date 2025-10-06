import { Brand, Schema } from 'effect'
import {
  AnimationDuration,
  AnimationProgress,
  CameraAnimation,
  FOVAnimation,
  FrameNumber,
  Keyframe,
  KeyframeAnimation,
  PositionAnimation,
  RotationAnimation,
  Timestamp,
} from './index'

/**
 * AnimationDuration Brand型用Schema
 */
export const AnimationDurationSchema = Schema.Number.pipe(
  Schema.between(0, 300), // 0秒から5分
  Schema.fromBrand(Brand.nominal<AnimationDuration>())
)

/**
 * AnimationProgress Brand型用Schema
 */
export const AnimationProgressSchema = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.fromBrand(Brand.nominal<AnimationProgress>())
)

/**
 * Timestamp Brand型用Schema
 */
export const TimestampSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.fromBrand(Brand.nominal<Timestamp>()))

/**
 * FrameNumber Brand型用Schema
 */
export const FrameNumberSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.int(),
  Schema.fromBrand(Brand.nominal<FrameNumber>())
)

/**
 * EasingType Schema - Unionを使用
 */
const LinearEasing = Schema.Struct({
  _tag: Schema.Literal('Linear'),
})

const EaseInEasing = Schema.Struct({
  _tag: Schema.Literal('EaseIn'),
  power: Schema.Number.pipe(Schema.between(1, 10)),
})

const EaseOutEasing = Schema.Struct({
  _tag: Schema.Literal('EaseOut'),
  power: Schema.Number.pipe(Schema.between(1, 10)),
})

const EaseInOutEasing = Schema.Struct({
  _tag: Schema.Literal('EaseInOut'),
  power: Schema.Number.pipe(Schema.between(1, 10)),
})

const BounceEasing = Schema.Struct({
  _tag: Schema.Literal('Bounce'),
  amplitude: Schema.Number.pipe(Schema.between(0.1, 2.0)),
  period: Schema.Number.pipe(Schema.between(0.1, 1.0)),
})

const ElasticEasing = Schema.Struct({
  _tag: Schema.Literal('Elastic'),
  amplitude: Schema.Number.pipe(Schema.between(0.1, 2.0)),
  period: Schema.Number.pipe(Schema.between(0.1, 1.0)),
})

const BackEasing = Schema.Struct({
  _tag: Schema.Literal('Back'),
  overshoot: Schema.Number.pipe(Schema.between(0.1, 3.0)),
})

const CubicEasing = Schema.Struct({
  _tag: Schema.Literal('Cubic'),
  controlPoint1: Schema.Struct({
    x: Schema.Number.pipe(Schema.between(0, 1)),
    y: Schema.Number,
  }),
  controlPoint2: Schema.Struct({
    x: Schema.Number.pipe(Schema.between(0, 1)),
    y: Schema.Number,
  }),
})

const SpringEasing = Schema.Struct({
  _tag: Schema.Literal('Spring'),
  tension: Schema.Number.pipe(Schema.between(0.1, 1000)),
  friction: Schema.Number.pipe(Schema.between(0.1, 100)),
})

// Custom easing with function is not supported in Schema as functions cannot be serialized
// Removed CustomEasing from the union

export const EasingTypeSchema = Schema.Union(
  LinearEasing,
  EaseInEasing,
  EaseOutEasing,
  EaseInOutEasing,
  BounceEasing,
  ElasticEasing,
  BackEasing,
  CubicEasing,
  SpringEasing
)

/**
 * AnimationState Schema - Unionを使用
 */
const IdleAnimationState = Schema.Struct({
  _tag: Schema.Literal('Idle'),
})

const PlayingAnimationState = Schema.Struct({
  _tag: Schema.Literal('Playing'),
  startTime: TimestampSchema,
  duration: AnimationDurationSchema,
  currentProgress: AnimationProgressSchema,
})

const PausedAnimationState = Schema.Struct({
  _tag: Schema.Literal('Paused'),
  pausedAt: TimestampSchema,
  remainingDuration: AnimationDurationSchema,
  currentProgress: AnimationProgressSchema,
})

const CompletedAnimationState = Schema.Struct({
  _tag: Schema.Literal('Completed'),
  completedAt: TimestampSchema,
  finalProgress: AnimationProgressSchema,
})

const CancelledAnimationState = Schema.Struct({
  _tag: Schema.Literal('Cancelled'),
  cancelledAt: TimestampSchema,
  progressAtCancel: AnimationProgressSchema,
  reason: Schema.String,
})

export const AnimationStateSchema = Schema.Union(
  IdleAnimationState,
  PlayingAnimationState,
  PausedAnimationState,
  CompletedAnimationState,
  CancelledAnimationState
)

/**
 * Position3D Schema（再利用）
 */
const Position3DSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

/**
 * Rotation3D Schema（再利用）
 */
const Rotation3DSchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-90, 90)),
  yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  roll: Schema.Number.pipe(Schema.between(-180, 180)),
})

/**
 * PositionAnimation Brand型用Schema
 */
export const PositionAnimationSchema = Schema.Struct({
  fromPosition: Position3DSchema,
  toPosition: Position3DSchema,
  duration: AnimationDurationSchema,
  easingType: EasingTypeSchema,
  currentPosition: Position3DSchema,
}).pipe(Schema.fromBrand(Brand.nominal<PositionAnimation>()))

/**
 * RotationAnimation Brand型用Schema
 */
export const RotationAnimationSchema = Schema.Struct({
  fromRotation: Rotation3DSchema,
  toRotation: Rotation3DSchema,
  duration: AnimationDurationSchema,
  easingType: EasingTypeSchema,
  currentRotation: Rotation3DSchema,
}).pipe(Schema.fromBrand(Brand.nominal<RotationAnimation>()))

/**
 * FOVAnimation Brand型用Schema
 */
export const FOVAnimationSchema = Schema.Struct({
  fromFOV: Schema.Number.pipe(Schema.between(30, 120)),
  toFOV: Schema.Number.pipe(Schema.between(30, 120)),
  duration: AnimationDurationSchema,
  easingType: EasingTypeSchema,
  currentFOV: Schema.Number.pipe(Schema.between(30, 120)),
}).pipe(Schema.fromBrand(Brand.nominal<FOVAnimation>()))

/**
 * CameraAnimation Brand型用Schema
 */
export const CameraAnimationSchema = Schema.Struct({
  positionAnimation: Schema.NullOr(PositionAnimationSchema),
  rotationAnimation: Schema.NullOr(RotationAnimationSchema),
  fovAnimation: Schema.NullOr(FOVAnimationSchema),
  state: AnimationStateSchema,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  loop: Schema.Boolean,
  playbackRate: Schema.Number.pipe(Schema.between(0.1, 5.0)),
}).pipe(Schema.fromBrand(Brand.nominal<CameraAnimation>()))

/**
 * Keyframe Brand型用Schema
 */
export const KeyframeSchema = Schema.Struct({
  time: AnimationProgressSchema,
  position: Position3DSchema,
  rotation: Rotation3DSchema,
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  easingToNext: EasingTypeSchema,
}).pipe(Schema.fromBrand(Brand.nominal<Keyframe>()))

/**
 * KeyframeAnimation Brand型用Schema
 */
export const KeyframeAnimationSchema = Schema.Struct({
  keyframes: Schema.Array(KeyframeSchema).pipe(
    Schema.minItems(2), // 最低2つのキーフレームが必要
    Schema.filter(
      (keyframes) => {
        // キーフレームが時間順にソートされていることを確認
        for (let i = 1; i < keyframes.length; i++) {
          if (keyframes[i].time <= keyframes[i - 1].time) {
            return false
          }
        }
        return true
      },
      {
        message: () => 'Keyframes must be sorted by time in ascending order',
      }
    )
  ),
  duration: AnimationDurationSchema,
  loop: Schema.Boolean,
  currentKeyframe: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  state: AnimationStateSchema,
}).pipe(Schema.fromBrand(Brand.nominal<KeyframeAnimation>()))

/**
 * InterpolationType Schema
 */
export const InterpolationTypeSchema = Schema.Literal('linear', 'spherical', 'cubic', 'hermite')

/**
 * AnimationDirection Schema
 */
export const AnimationDirectionSchema = Schema.Literal('forward', 'reverse', 'alternate', 'alternate-reverse')

/**
 * PlaybackMode Schema
 */
export const PlaybackModeSchema = Schema.Literal('once', 'loop', 'ping-pong', 'hold-last')

/**
 * AnimationEvent Schema - Unionを使用
 */
const StartedAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('Started'),
  animationId: Schema.String,
  startTime: TimestampSchema,
})

const UpdatedAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('Updated'),
  animationId: Schema.String,
  progress: AnimationProgressSchema,
  currentTime: TimestampSchema,
})

const PausedAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('Paused'),
  animationId: Schema.String,
  pauseTime: TimestampSchema,
})

const ResumedAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('Resumed'),
  animationId: Schema.String,
  resumeTime: TimestampSchema,
})

const CompletedAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('Completed'),
  animationId: Schema.String,
  completionTime: TimestampSchema,
})

const CancelledAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('Cancelled'),
  animationId: Schema.String,
  cancellationTime: TimestampSchema,
  reason: Schema.String,
})

const LoopCompletedAnimationEvent = Schema.Struct({
  _tag: Schema.Literal('LoopCompleted'),
  animationId: Schema.String,
  loopCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
  time: TimestampSchema,
})

export const AnimationEventSchema = Schema.Union(
  StartedAnimationEvent,
  UpdatedAnimationEvent,
  PausedAnimationEvent,
  ResumedAnimationEvent,
  CompletedAnimationEvent,
  CancelledAnimationEvent,
  LoopCompletedAnimationEvent
)

/**
 * アニメーション設定用のSchema
 */
export const AnimationConstraints = {
  duration: {
    min: 0,
    max: 300,
    default: 1.0,
    quick: 0.3,
    slow: 3.0,
  },

  progress: {
    start: 0,
    end: 1,
    step: 0.01,
  },

  easingPower: {
    min: 1,
    max: 10,
    default: 2,
  },

  playbackRate: {
    min: 0.1,
    max: 5.0,
    default: 1.0,
    slow: 0.5,
    fast: 2.0,
  },
} as const
