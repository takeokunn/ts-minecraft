import { Brand, Data } from 'effect'

/**
 * アニメーション時間のBrand型（秒単位）
 */
export type AnimationDuration = Brand.Brand<number, 'AnimationDuration'> & {
  readonly min: 0
  readonly max: 300 // 5分上限
}

/**
 * アニメーション進行率のBrand型（0-1）
 */
export type AnimationProgress = Brand.Brand<number, 'AnimationProgress'> & {
  readonly min: 0
  readonly max: 1
}

/**
 * タイムスタンプのBrand型（ミリ秒）
 */
export type Timestamp = Brand.Brand<number, 'Timestamp'>

/**
 * フレーム番号のBrand型
 */
export type FrameNumber = Brand.Brand<number, 'FrameNumber'> & {
  readonly min: 0
}

/**
 * イージング種類のADT
 */
export type EasingType = Data.TaggedEnum<{
  Linear: {}
  EaseIn: { readonly power: number }
  EaseOut: { readonly power: number }
  EaseInOut: { readonly power: number }
  Bounce: { readonly amplitude: number; readonly period: number }
  Elastic: { readonly amplitude: number; readonly period: number }
  Back: { readonly overshoot: number }
  Cubic: { readonly controlPoint1: { x: number; y: number }; readonly controlPoint2: { x: number; y: number } }
  Spring: { readonly tension: number; readonly friction: number }
  Custom: { readonly easingFunction: (t: number) => number }
}>

/**
 * EasingType コンストラクタ
 */
export const EasingType = Data.taggedEnum<EasingType>()

/**
 * アニメーション状態のADT
 */
export type AnimationState = Data.TaggedEnum<{
  Idle: {}
  Playing: {
    readonly startTime: Timestamp
    readonly duration: AnimationDuration
    readonly currentProgress: AnimationProgress
  }
  Paused: {
    readonly pausedAt: Timestamp
    readonly remainingDuration: AnimationDuration
    readonly currentProgress: AnimationProgress
  }
  Completed: {
    readonly completedAt: Timestamp
    readonly finalProgress: AnimationProgress
  }
  Cancelled: {
    readonly cancelledAt: Timestamp
    readonly progressAtCancel: AnimationProgress
  }
}>

/**
 * AnimationState コンストラクタ
 */
export const AnimationState = Data.taggedEnum<AnimationState>()

/**
 * 位置アニメーションのBrand型
 */
export type PositionAnimation = Brand.Brand<
  {
    readonly fromPosition: { readonly x: number; readonly y: number; readonly z: number }
    readonly toPosition: { readonly x: number; readonly y: number; readonly z: number }
    readonly duration: AnimationDuration
    readonly easingType: EasingType
    readonly currentPosition: { readonly x: number; readonly y: number; readonly z: number }
  },
  'PositionAnimation'
>

/**
 * 回転アニメーションのBrand型
 */
export type RotationAnimation = Brand.Brand<
  {
    readonly fromRotation: { readonly pitch: number; readonly yaw: number; readonly roll: number }
    readonly toRotation: { readonly pitch: number; readonly yaw: number; readonly roll: number }
    readonly duration: AnimationDuration
    readonly easingType: EasingType
    readonly currentRotation: { readonly pitch: number; readonly yaw: number; readonly roll: number }
  },
  'RotationAnimation'
>

/**
 * FOVアニメーションのBrand型
 */
export type FOVAnimation = Brand.Brand<
  {
    readonly fromFOV: number
    readonly toFOV: number
    readonly duration: AnimationDuration
    readonly easingType: EasingType
    readonly currentFOV: number
  },
  'FOVAnimation'
>

/**
 * 複合カメラアニメーションのBrand型
 */
export type CameraAnimation = Brand.Brand<
  {
    readonly positionAnimation: PositionAnimation | null
    readonly rotationAnimation: RotationAnimation | null
    readonly fovAnimation: FOVAnimation | null
    readonly state: AnimationState
    readonly priority: number
    readonly loop: boolean
    readonly playbackRate: number
  },
  'CameraAnimation'
>

/**
 * キーフレームのBrand型
 */
export type Keyframe = Brand.Brand<
  {
    readonly time: AnimationProgress
    readonly position: { readonly x: number; readonly y: number; readonly z: number }
    readonly rotation: { readonly pitch: number; readonly yaw: number; readonly roll: number }
    readonly fov: number
    readonly easingToNext: EasingType
  },
  'Keyframe'
>

/**
 * キーフレームアニメーションのBrand型
 */
export type KeyframeAnimation = Brand.Brand<
  {
    readonly keyframes: readonly Keyframe[]
    readonly duration: AnimationDuration
    readonly loop: boolean
    readonly currentKeyframe: number
    readonly state: AnimationState
  },
  'KeyframeAnimation'
>

/**
 * アニメーションイベントのADT
 */
export type AnimationEvent = Data.TaggedEnum<{
  Started: { readonly animationId: string; readonly startTime: Timestamp }
  Updated: { readonly animationId: string; readonly progress: AnimationProgress; readonly currentTime: Timestamp }
  Paused: { readonly animationId: string; readonly pauseTime: Timestamp }
  Resumed: { readonly animationId: string; readonly resumeTime: Timestamp }
  Completed: { readonly animationId: string; readonly completionTime: Timestamp }
  Cancelled: { readonly animationId: string; readonly cancellationTime: Timestamp; readonly reason: string }
  LoopCompleted: { readonly animationId: string; readonly loopCount: number; readonly time: Timestamp }
}>

/**
 * AnimationEvent コンストラクタ
 */
export const AnimationEvent = Data.taggedEnum<AnimationEvent>()

/**
 * アニメーションエラーのADT
 */
export type AnimationError = Data.TaggedEnum<{
  InvalidDuration: { readonly duration: number; readonly min: number; readonly max: number }
  InvalidProgress: { readonly progress: number; readonly expected: string }
  InvalidTimestamp: { readonly timestamp: number; readonly reason: string }
  InvalidEasingParameter: { readonly easingType: string; readonly parameter: string; readonly value: unknown }
  KeyframeValidationFailed: { readonly keyframeIndex: number; readonly reason: string }
  AnimationNotFound: { readonly animationId: string }
  AnimationAlreadyRunning: { readonly animationId: string }
  AnimationStateConflict: { readonly currentState: string; readonly requestedOperation: string }
  InterpolationFailed: {
    readonly from: unknown
    readonly to: unknown
    readonly progress: number
    readonly reason: string
  }
}>

/**
 * AnimationError コンストラクタ
 */
export const AnimationError = Data.taggedEnum<AnimationError>()

/**
 * アニメーション補間種類の列挙型
 */
export type InterpolationType = 'linear' | 'spherical' | 'cubic' | 'hermite'

/**
 * アニメーション方向の列挙型
 */
export type AnimationDirection = 'forward' | 'reverse' | 'alternate' | 'alternate-reverse'

/**
 * アニメーション再生モードの列挙型
 */
export type PlaybackMode = 'once' | 'loop' | 'ping-pong' | 'hold-last'
