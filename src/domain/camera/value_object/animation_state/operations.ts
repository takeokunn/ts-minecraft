import { Brand, Clock, Effect, Match, pipe, Schema } from 'effect'
import { AnimationDuration, AnimationDurationSchema, AnimationProgressSchema, TimestampSchema } from './schema'
import {
  AnimationError,
  AnimationProgress,
  AnimationState,
  CameraAnimation,
  EasingType,
  Keyframe,
  PositionAnimation,
  Timestamp,
} from './types'

/**
 * 基本アニメーション値のファクトリー関数群
 */
export const AnimationValueFactory = {
  /**
   * AnimationDuration作成
   */
  createDuration: (seconds: number): Effect.Effect<AnimationDuration, AnimationError> =>
    pipe(
      Schema.decodeUnknown(AnimationDurationSchema)(seconds),
      Effect.mapError(() =>
        AnimationError.InvalidDuration({
          duration: seconds,
          min: 0,
          max: 300,
        })
      )
    ),

  /**
   * AnimationProgress作成
   */
  createProgress: (progress: number): Effect.Effect<AnimationProgress, AnimationError> =>
    pipe(
      Schema.decodeUnknown(AnimationProgressSchema)(progress),
      Effect.mapError(() =>
        AnimationError.InvalidProgress({
          progress,
          expected: 'number between 0 and 1',
        })
      )
    ),

  /**
   * Timestamp作成
   */
  createTimestamp: (milliseconds?: number): Effect.Effect<Timestamp, AnimationError> =>
    Effect.gen(function* () {
      const ms = milliseconds ?? (yield* Clock.currentTimeMillis)
      return yield* pipe(
        Schema.decodeUnknown(TimestampSchema)(ms),
        Effect.mapError(() =>
          AnimationError.InvalidTimestamp({
            timestamp: ms,
            reason: 'Timestamp must be non-negative',
          })
        )
      )
    }),
}

/**
 * イージング関数の実装
 */
export const EasingFunctions = {
  /**
   * イージング関数の計算
   */
  apply: (t: AnimationProgress, easing: EasingType): number =>
    pipe(
      easing,
      Match.value,
      Match.tag('Linear', () => t),
      Match.tag('EaseIn', ({ power }) => Math.pow(t, power)),
      Match.tag('EaseOut', ({ power }) => 1 - Math.pow(1 - t, power)),
      Match.tag('EaseInOut', ({ power }) => {
        const tNum = t
        return tNum < 0.5 ? Math.pow(2 * tNum, power) / 2 : 1 - Math.pow(2 * (1 - tNum), power) / 2
      }),
      Match.tag('Bounce', ({ amplitude, period }) => {
        const tNum = t
        if (tNum === 1) return 1
        return amplitude * Math.pow(2, -10 * tNum) * Math.sin(((tNum - period / 4) * (2 * Math.PI)) / period) + 1
      }),
      Match.tag('Elastic', ({ amplitude, period }) => {
        const tNum = t
        if (tNum === 0 || tNum === 1) return tNum
        return amplitude * Math.pow(2, -10 * tNum) * Math.sin(((tNum - period / 4) * (2 * Math.PI)) / period) + 1
      }),
      Match.tag('Back', ({ overshoot }) => {
        const tNum = t
        const c1 = 1.70158 * overshoot
        const c3 = c1 + 1
        return c3 * tNum * tNum * tNum - c1 * tNum * tNum
      }),
      Match.tag('Cubic', ({ controlPoint1, controlPoint2 }) => {
        // ベジェ曲線の実装
        const tNum = t
        const u = 1 - tNum
        return 3 * u * u * tNum * controlPoint1.y + 3 * u * tNum * tNum * controlPoint2.y + tNum * tNum * tNum
      }),
      Match.tag('Spring', ({ tension, friction }) => {
        // スプリングアニメーションの簡易実装
        const tNum = t
        const omega = Math.sqrt(tension)
        const zeta = friction / (2 * Math.sqrt(tension))
        return 1 - Math.exp(-zeta * omega * tNum) * Math.cos(omega * Math.sqrt(1 - zeta * zeta) * tNum)
      }),
      Match.tag('Custom', ({ easingFunction }) => easingFunction(t)),
      Match.exhaustive
    ),

  /**
   * 事前定義されたイージング関数
   */
  presets: {
    linear: (): EasingType => ({ _tag: 'Linear' }),
    easeIn: (power: number = 2): EasingType => ({ _tag: 'EaseIn', power }),
    easeOut: (power: number = 2): EasingType => ({ _tag: 'EaseOut', power }),
    easeInOut: (power: number = 2): EasingType => ({ _tag: 'EaseInOut', power }),
    bounce: (amplitude: number = 1, period: number = 0.3): EasingType => ({ _tag: 'Bounce', amplitude, period }),
    elastic: (amplitude: number = 1, period: number = 0.3): EasingType => ({ _tag: 'Elastic', amplitude, period }),
    back: (overshoot: number = 1.7): EasingType => ({ _tag: 'Back', overshoot }),
    spring: (tension: number = 300, friction: number = 30): EasingType => ({ _tag: 'Spring', tension, friction }),
  },
}

/**
 * AnimationState 操作関数群
 */
export const AnimationStateOps = {
  /**
   * アニメーション開始
   */
  start: (duration: AnimationDuration): Effect.Effect<AnimationState, AnimationError> =>
    Effect.gen(function* () {
      const startTime = yield* AnimationValueFactory.createTimestamp()
      const initialProgress = yield* AnimationValueFactory.createProgress(0)

      return AnimationState.Playing({
        startTime,
        duration,
        currentProgress: initialProgress,
      })
    }),

  /**
   * アニメーション一時停止
   */
  pause: (state: AnimationState): Effect.Effect<AnimationState, AnimationError> =>
    pipe(
      state,
      Match.value,
      Match.tag('Playing', ({ duration, currentProgress }) =>
        Effect.gen(function* () {
          const pausedAt = yield* AnimationValueFactory.createTimestamp()
          const remaining = duration * (1 - currentProgress)
          const remainingDuration = yield* AnimationValueFactory.createDuration(remaining)

          return AnimationState.Paused({
            pausedAt,
            remainingDuration,
            currentProgress,
          })
        })
      ),
      Match.orElse(() =>
        Effect.fail(
          AnimationError.AnimationStateConflict({
            currentState: state._tag,
            requestedOperation: 'pause',
          })
        )
      )
    ),

  /**
   * アニメーション再開
   */
  resume: (state: AnimationState): Effect.Effect<AnimationState, AnimationError> =>
    pipe(
      state,
      Match.value,
      Match.tag('Paused', ({ remainingDuration, currentProgress }) =>
        Effect.gen(function* () {
          const startTime = yield* AnimationValueFactory.createTimestamp()

          return AnimationState.Playing({
            startTime,
            duration: remainingDuration,
            currentProgress,
          })
        })
      ),
      Match.orElse(() =>
        Effect.fail(
          AnimationError.AnimationStateConflict({
            currentState: state._tag,
            requestedOperation: 'resume',
          })
        )
      )
    ),

  /**
   * アニメーション完了
   */
  complete: (state: AnimationState): Effect.Effect<AnimationState, AnimationError> =>
    Effect.gen(function* () {
      const completedAt = yield* AnimationValueFactory.createTimestamp()
      const finalProgress = yield* AnimationValueFactory.createProgress(1)

      return AnimationState.Completed({
        completedAt,
        finalProgress,
      })
    }),

  /**
   * アニメーションキャンセル
   */
  cancel: (state: AnimationState, reason: string = 'User cancelled'): Effect.Effect<AnimationState, AnimationError> =>
    Effect.gen(function* () {
      const cancelledAt = yield* AnimationValueFactory.createTimestamp()

      const progressAtCancel = pipe(
        state,
        Match.value,
        Match.tag('Playing', ({ currentProgress }) => currentProgress),
        Match.tag('Paused', ({ currentProgress }) => currentProgress),
        Match.orElse(() => Brand.nominal<AnimationProgress>()(0))
      )

      return AnimationState.Cancelled({
        cancelledAt,
        progressAtCancel,
        reason,
      })
    }),

  /**
   * 進行状況の更新
   */
  updateProgress: (state: AnimationState, currentTime: Timestamp): Effect.Effect<AnimationState, AnimationError> =>
    pipe(
      state,
      Match.value,
      Match.tag('Playing', ({ startTime, duration }) =>
        Effect.gen(function* () {
          const elapsed = (currentTime - startTime) / 1000 // ミリ秒から秒に変換
          const progress = Math.min(1, elapsed / duration)
          const currentProgress = yield* AnimationValueFactory.createProgress(progress)

          if (progress >= 1) {
            return yield* AnimationStateOps.complete(state)
          }

          return AnimationState.Playing({
            startTime,
            duration,
            currentProgress,
          })
        })
      ),
      Match.orElse(() => Effect.succeed(state))
    ),
}

/**
 * 補間関数群
 */
export const InterpolationOps = {
  /**
   * 数値の線形補間
   */
  lerpNumber: (from: number, to: number, t: number): number => from + (to - from) * t,

  /**
   * 3D位置の補間
   */
  lerpPosition: (
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    t: number
  ): { x: number; y: number; z: number } => ({
    x: InterpolationOps.lerpNumber(from.x, to.x, t),
    y: InterpolationOps.lerpNumber(from.y, to.y, t),
    z: InterpolationOps.lerpNumber(from.z, to.z, t),
  }),

  /**
   * 回転の補間（最短経路）
   */
  lerpRotation: (
    from: { pitch: number; yaw: number; roll: number },
    to: { pitch: number; yaw: number; roll: number },
    t: number
  ): { pitch: number; yaw: number; roll: number } => {
    // ヨー角の最短経路を計算
    let yawDiff = to.yaw - from.yaw
    if (yawDiff > 180) yawDiff -= 360
    if (yawDiff < -180) yawDiff += 360

    return {
      pitch: InterpolationOps.lerpNumber(from.pitch, to.pitch, t),
      yaw: from.yaw + yawDiff * t,
      roll: InterpolationOps.lerpNumber(from.roll, to.roll, t),
    }
  },

  /**
   * キーフレーム間の補間
   */
  interpolateKeyframes: (
    keyframes: readonly Keyframe[],
    progress: AnimationProgress
  ): Effect.Effect<
    {
      position: { x: number; y: number; z: number }
      rotation: { pitch: number; yaw: number; roll: number }
      fov: number
    },
    AnimationError
  > => {
    if (keyframes.length < 2) {
      return Effect.fail(
        AnimationError.KeyframeValidationFailed({
          keyframeIndex: 0,
          reason: 'At least 2 keyframes required for interpolation',
        })
      )
    }

    const t = progress

    // 現在の時間に対応するキーフレームペアを見つける
    const keyframePair = pipe(
      ReadonlyArray.range(0, keyframes.length - 1),
      ReadonlyArray.findFirst((i) => t >= keyframes[i].time && t <= keyframes[i + 1].time),
      Option.map((i) => ({ fromIndex: i, toIndex: i + 1 })),
      Option.getOrElse(() => ({ fromIndex: 0, toIndex: 1 }))
    )

    const fromKeyframe = keyframes[keyframePair.fromIndex]
    const toKeyframe = keyframes[keyframePair.toIndex]

    // キーフレーム間での正規化された時間
    const segmentProgress = (t - fromKeyframe.time) / (toKeyframe.time - fromKeyframe.time)

    // イージングを適用
    const easedProgress = EasingFunctions.apply(
      Brand.nominal<AnimationProgress>()(segmentProgress),
      fromKeyframe.easingToNext
    )

    return Effect.succeed({
      position: InterpolationOps.lerpPosition(fromKeyframe.position, toKeyframe.position, easedProgress),
      rotation: InterpolationOps.lerpRotation(fromKeyframe.rotation, toKeyframe.rotation, easedProgress),
      fov: InterpolationOps.lerpNumber(fromKeyframe.fov, toKeyframe.fov, easedProgress),
    })
  },
}

/**
 * CameraAnimation 操作関数群
 */
export const CameraAnimationOps = {
  /**
   * シンプルなカメラアニメーション作成
   */
  createSimple: (
    fromPosition: { x: number; y: number; z: number },
    toPosition: { x: number; y: number; z: number },
    duration: AnimationDuration,
    easing: EasingType = EasingFunctions.presets.easeInOut()
  ): Effect.Effect<CameraAnimation, AnimationError> =>
    Effect.gen(function* () {
      const positionAnimation = Brand.nominal<PositionAnimation>()({
        fromPosition,
        toPosition,
        duration,
        easingType: easing,
        currentPosition: fromPosition,
      })

      const state = yield* AnimationStateOps.start(duration)

      return Brand.nominal<CameraAnimation>()({
        positionAnimation,
        rotationAnimation: null,
        fovAnimation: null,
        state,
        priority: 1,
        loop: false,
        playbackRate: 1.0,
      })
    }),

  /**
   * アニメーションの更新
   */
  update: (animation: CameraAnimation, currentTime: Timestamp): Effect.Effect<CameraAnimation, AnimationError> =>
    Effect.gen(function* () {
      const updatedState = yield* AnimationStateOps.updateProgress(animation.state, currentTime)

      // 進行状況に基づいて各アニメーションを更新
      const progress = pipe(
        updatedState,
        Match.value,
        Match.tag('Playing', ({ currentProgress }) => currentProgress),
        Match.tag('Paused', ({ currentProgress }) => currentProgress),
        Match.tag('Completed', ({ finalProgress }) => finalProgress),
        Match.orElse(() => Brand.nominal<AnimationProgress>()(0))
      )

      const easedProgress = animation.positionAnimation
        ? EasingFunctions.apply(progress, animation.positionAnimation.easingType)
        : progress

      const updatedPositionAnimation = animation.positionAnimation
        ? Brand.nominal<PositionAnimation>()({
            ...animation.positionAnimation,
            currentPosition: InterpolationOps.lerpPosition(
              animation.positionAnimation.fromPosition,
              animation.positionAnimation.toPosition,
              easedProgress
            ),
          })
        : null

      return Brand.nominal<CameraAnimation>()({
        ...animation,
        positionAnimation: updatedPositionAnimation,
        state: updatedState,
      })
    }),

  /**
   * アニメーションの完了チェック
   */
  isCompleted: (animation: CameraAnimation): boolean =>
    pipe(
      animation.state,
      Match.value,
      Match.tag('Completed', () => true),
      Match.orElse(() => false)
    ),

  /**
   * アニメーションの実行中チェック
   */
  isPlaying: (animation: CameraAnimation): boolean =>
    pipe(
      animation.state,
      Match.value,
      Match.tag('Playing', () => true),
      Match.orElse(() => false)
    ),
}

/**
 * デフォルト値と定数
 */
export const AnimationConstants = {
  DEFAULT_DURATION: Brand.nominal<AnimationDuration>()(1.0),
  QUICK_DURATION: Brand.nominal<AnimationDuration>()(0.3),
  SLOW_DURATION: Brand.nominal<AnimationDuration>()(3.0),

  DEFAULT_EASING: EasingFunctions.presets.easeInOut(),
  LINEAR_EASING: EasingFunctions.presets.linear(),
  BOUNCE_EASING: EasingFunctions.presets.bounce(),

  MAX_ANIMATION_PRIORITY: 100,
  DEFAULT_PRIORITY: 1,

  ANIMATION_TICK_RATE: 60, // FPS
} as const
