import { Brand } from 'effect'

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
export type EasingType =
  | { readonly _tag: 'Linear' }
  | { readonly _tag: 'EaseIn'; readonly power: number }
  | { readonly _tag: 'EaseOut'; readonly power: number }
  | { readonly _tag: 'EaseInOut'; readonly power: number }
  | { readonly _tag: 'Bounce'; readonly amplitude: number; readonly period: number }
  | { readonly _tag: 'Elastic'; readonly amplitude: number; readonly period: number }
  | { readonly _tag: 'Back'; readonly overshoot: number }
  | {
      readonly _tag: 'Cubic'
      readonly controlPoint1: { x: number; y: number }
      readonly controlPoint2: { x: number; y: number }
    }
  | { readonly _tag: 'Spring'; readonly tension: number; readonly friction: number }
  | { readonly _tag: 'Custom'; readonly easingFunction: (t: number) => number }

/**
 * アニメーション状態のADT
 */
export type AnimationState =
  | { readonly _tag: 'Idle' }
  | {
      readonly _tag: 'Playing'
      readonly startTime: Timestamp
      readonly duration: AnimationDuration
      readonly currentProgress: AnimationProgress
    }
  | {
      readonly _tag: 'Paused'
      readonly pausedAt: Timestamp
      readonly remainingDuration: AnimationDuration
      readonly currentProgress: AnimationProgress
    }
  | {
      readonly _tag: 'Completed'
      readonly completedAt: Timestamp
      readonly finalProgress: AnimationProgress
    }
  | {
      readonly _tag: 'Cancelled'
      readonly cancelledAt: Timestamp
      readonly progressAtCancel: AnimationProgress
      readonly reason: string
    }

/**
 * AnimationState コンストラクタ関数群
 */
export const AnimationState = {
  Idle: (): AnimationState => ({ _tag: 'Idle' as const }),
  Playing: (props: {
    readonly startTime: Timestamp
    readonly duration: AnimationDuration
    readonly currentProgress: AnimationProgress
  }): AnimationState => ({ _tag: 'Playing' as const, ...props }),
  Paused: (props: {
    readonly pausedAt: Timestamp
    readonly remainingDuration: AnimationDuration
    readonly currentProgress: AnimationProgress
  }): AnimationState => ({ _tag: 'Paused' as const, ...props }),
  Completed: (props: {
    readonly completedAt: Timestamp
    readonly finalProgress: AnimationProgress
  }): AnimationState => ({ _tag: 'Completed' as const, ...props }),
  Cancelled: (props: {
    readonly cancelledAt: Timestamp
    readonly progressAtCancel: AnimationProgress
    readonly reason: string
  }): AnimationState => ({ _tag: 'Cancelled' as const, ...props }),
} as const

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
export type AnimationEvent =
  | { readonly _tag: 'Started'; readonly animationId: string; readonly startTime: Timestamp }
  | {
      readonly _tag: 'Updated'
      readonly animationId: string
      readonly progress: AnimationProgress
      readonly currentTime: Timestamp
    }
  | { readonly _tag: 'Paused'; readonly animationId: string; readonly pauseTime: Timestamp }
  | { readonly _tag: 'Resumed'; readonly animationId: string; readonly resumeTime: Timestamp }
  | { readonly _tag: 'Completed'; readonly animationId: string; readonly completionTime: Timestamp }
  | {
      readonly _tag: 'Cancelled'
      readonly animationId: string
      readonly cancellationTime: Timestamp
      readonly reason: string
    }
  | {
      readonly _tag: 'LoopCompleted'
      readonly animationId: string
      readonly loopCount: number
      readonly time: Timestamp
    }

/**
 * AnimationEvent コンストラクタ関数群
 */
export const AnimationEvent = {
  Started: (props: { readonly animationId: string; readonly startTime: Timestamp }): AnimationEvent => ({
    _tag: 'Started' as const,
    ...props,
  }),
  Updated: (props: {
    readonly animationId: string
    readonly progress: AnimationProgress
    readonly currentTime: Timestamp
  }): AnimationEvent => ({ _tag: 'Updated' as const, ...props }),
  Paused: (props: { readonly animationId: string; readonly pauseTime: Timestamp }): AnimationEvent => ({
    _tag: 'Paused' as const,
    ...props,
  }),
  Resumed: (props: { readonly animationId: string; readonly resumeTime: Timestamp }): AnimationEvent => ({
    _tag: 'Resumed' as const,
    ...props,
  }),
  Completed: (props: { readonly animationId: string; readonly completionTime: Timestamp }): AnimationEvent => ({
    _tag: 'Completed' as const,
    ...props,
  }),
  Cancelled: (props: {
    readonly animationId: string
    readonly cancellationTime: Timestamp
    readonly reason: string
  }): AnimationEvent => ({ _tag: 'Cancelled' as const, ...props }),
  LoopCompleted: (props: {
    readonly animationId: string
    readonly loopCount: number
    readonly time: Timestamp
  }): AnimationEvent => ({ _tag: 'LoopCompleted' as const, ...props }),
} as const

/**
 * アニメーション補間可能な値の型
 * カメラアニメーションで補間可能な全ての値の型を定義
 */
export type AnimatableValue =
  | { readonly x: number; readonly y: number; readonly z: number } // Position3D/Vector3
  | { readonly pitch: number; readonly yaw: number; readonly roll: number } // Rotation
  | { readonly x: number; readonly y: number; readonly z: number; readonly w: number } // Quaternion
  | number // FOV, scalar values

/**
 * アニメーションエラーのADT
 */
export type AnimationError =
  | { readonly _tag: 'InvalidDuration'; readonly duration: number; readonly min: number; readonly max: number }
  | { readonly _tag: 'InvalidProgress'; readonly progress: number; readonly expected: string }
  | { readonly _tag: 'InvalidTimestamp'; readonly timestamp: number; readonly reason: string }
  | {
      readonly _tag: 'InvalidEasingParameter'
      readonly easingType: string
      readonly parameter: string
      readonly value: number | string | boolean
    }
  | { readonly _tag: 'KeyframeValidationFailed'; readonly keyframeIndex: number; readonly reason: string }
  | { readonly _tag: 'AnimationNotFound'; readonly animationId: string }
  | { readonly _tag: 'AnimationAlreadyRunning'; readonly animationId: string }
  | { readonly _tag: 'AnimationStateConflict'; readonly currentState: string; readonly requestedOperation: string }
  | {
      readonly _tag: 'InterpolationFailed'
      readonly from: AnimatableValue
      readonly to: AnimatableValue
      readonly progress: number
      readonly reason: string
    }

/**
 * AnimationError コンストラクタ関数群
 */
export const AnimationError = {
  InvalidDuration: (props: {
    readonly duration: number
    readonly min: number
    readonly max: number
  }): AnimationError => ({ _tag: 'InvalidDuration' as const, ...props }),
  InvalidProgress: (props: { readonly progress: number; readonly expected: string }): AnimationError => ({
    _tag: 'InvalidProgress' as const,
    ...props,
  }),
  InvalidTimestamp: (props: { readonly timestamp: number; readonly reason: string }): AnimationError => ({
    _tag: 'InvalidTimestamp' as const,
    ...props,
  }),
  InvalidEasingParameter: (props: {
    readonly easingType: string
    readonly parameter: string
    readonly value: number | string | boolean
  }): AnimationError => ({ _tag: 'InvalidEasingParameter' as const, ...props }),
  KeyframeValidationFailed: (props: { readonly keyframeIndex: number; readonly reason: string }): AnimationError => ({
    _tag: 'KeyframeValidationFailed' as const,
    ...props,
  }),
  AnimationNotFound: (props: { readonly animationId: string }): AnimationError => ({
    _tag: 'AnimationNotFound' as const,
    ...props,
  }),
  AnimationAlreadyRunning: (props: { readonly animationId: string }): AnimationError => ({
    _tag: 'AnimationAlreadyRunning' as const,
    ...props,
  }),
  AnimationStateConflict: (props: {
    readonly currentState: string
    readonly requestedOperation: string
  }): AnimationError => ({ _tag: 'AnimationStateConflict' as const, ...props }),
  InterpolationFailed: (props: {
    readonly from: AnimatableValue
    readonly to: AnimatableValue
    readonly progress: number
    readonly reason: string
  }): AnimationError => ({ _tag: 'InterpolationFailed' as const, ...props }),
} as const

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
