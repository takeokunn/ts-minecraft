/**
 * Animation Engine Domain Service Live Implementation
 *
 * アニメーションエンジンドメインサービスの純粋なドメインロジック実装。
 * イージング関数、補間計算、アニメーション状態管理の
 * 核となるビジネスロジックを実装しています。
 */

import { Clock, Effect, Layer, Match, pipe } from 'effect'
import type {
  AnimationDuration,
  AnimationState,
  CameraError,
  CameraRotation,
  EasingType,
  Position3D,
  Timestamp,
} from '../../value_object'
import {
  AnimationStateOps,
  AnimationValueFactory,
  CameraRotationOps,
  EasingFunctions,
  InterpolationOps,
  Position3DOps,
} from '../../value_object'
import type {
  AnimationKeyframe,
  AnimationStateUnion,
  AnimationUpdateResult,
  CombinedAnimationState,
  FOVAnimationState,
  PositionAnimationState,
  RotationAnimationState,
} from './index'
import { AnimationEngineService } from './index'

/**
 * アニメーションエンジンサービスのLive実装
 * 純粋なドメインロジックのみを含む
 */
export const AnimationEngineServiceLive = Layer.succeed(
  AnimationEngineService,
  AnimationEngineService.of({
    /**
     * 位置アニメーションの作成
     */
    createPositionAnimation: (fromPosition, toPosition, duration, easingType) =>
      Effect.gen(function* () {
        const id = yield* generateAnimationId()
        const startTime = yield* getCurrentTime()

        return {
          _tag: 'PositionAnimation' as const,
          id,
          startPosition: fromPosition,
          endPosition: toPosition,
          currentPosition: fromPosition,
          duration,
          easingType,
          startTime,
          progress: AnimationValueFactory.createProgress(0),
          state: AnimationStateOps.createIdle(),
        }
      }),

    /**
     * 回転アニメーションの作成
     */
    createRotationAnimation: (fromRotation, toRotation, duration, easingType) =>
      Effect.gen(function* () {
        const id = yield* generateAnimationId()
        const startTime = yield* getCurrentTime()

        return {
          _tag: 'RotationAnimation' as const,
          id,
          startRotation: fromRotation,
          endRotation: toRotation,
          currentRotation: fromRotation,
          duration,
          easingType,
          startTime,
          progress: AnimationValueFactory.createProgress(0),
          state: AnimationStateOps.createIdle(),
        }
      }),

    /**
     * FOVアニメーションの作成
     */
    createFOVAnimation: (fromFOV, toFOV, duration, easingType) =>
      Effect.gen(function* () {
        const id = yield* generateAnimationId()
        const startTime = yield* getCurrentTime()

        return {
          _tag: 'FOVAnimation' as const,
          id,
          startFOV: fromFOV,
          endFOV: toFOV,
          currentFOV: fromFOV,
          duration,
          easingType,
          startTime,
          progress: AnimationValueFactory.createProgress(0),
          state: AnimationStateOps.createIdle(),
        }
      }),

    /**
     * 複合アニメーションの作成
     */
    createCombinedAnimation: (positionAnimation, rotationAnimation, fovAnimation) =>
      Effect.gen(function* () {
        const id = yield* generateAnimationId()
        const startTime = yield* getCurrentTime()

        return {
          _tag: 'CombinedAnimation' as const,
          id,
          positionAnimation,
          rotationAnimation,
          fovAnimation,
          state: AnimationStateOps.createIdle(),
          startTime,
        }
      }),

    /**
     * アニメーション状態の更新
     */
    updateAnimation: (animation, currentTime) =>
      Effect.gen(function* () {
        return yield* pipe(
          animation,
          Match.value,
          Match.tag('PositionAnimation', (anim) => updatePositionAnimation(anim, currentTime)),
          Match.tag('RotationAnimation', (anim) => updateRotationAnimation(anim, currentTime)),
          Match.tag('FOVAnimation', (anim) => updateFOVAnimation(anim, currentTime)),
          Match.tag('CombinedAnimation', (anim) => updateCombinedAnimation(anim, currentTime)),
          Match.exhaustive
        )
      }),

    /**
     * アニメーション完了確認
     */
    isAnimationComplete: (animation, currentTime) => {
      const elapsed = currentTime - getAnimationStartTime(animation)
      const duration = getAnimationDuration(animation)
      return elapsed >= duration
    },

    /**
     * イージング計算
     */
    calculateEasedValue: (startValue, endValue, progress, easingType) => {
      const easingFunction = EasingFunctions.getFunction(easingType)
      const easedProgress = easingFunction(progress)
      return InterpolationOps.lerp(startValue, endValue, easedProgress)
    },

    /**
     * 球面線形補間
     */
    slerpRotation: (fromRotation, toRotation, progress) =>
      Effect.gen(function* () {
        return yield* CameraRotationOps.slerp(fromRotation, toRotation, progress)
      }),

    /**
     * キーフレームアニメーションの評価
     */
    evaluateKeyframeAnimation: (keyframes, currentTime) =>
      Effect.gen(function* () {
        yield* Effect.when(keyframes.length === 0, () => Effect.fail(createAnimationError.emptyKeyframes()))

        // 現在時刻に対応するキーフレーム範囲を検索
        const { currentKeyframe, nextKeyframe, progress } = yield* findKeyframeRange(keyframes, currentTime)

        const current = keyframes[currentKeyframe]
        const next = nextKeyframe !== undefined ? keyframes[nextKeyframe] : undefined

        // 各プロパティを補間
        const position = yield* interpolateKeyframeProperty(
          current.position,
          next?.position,
          progress,
          current.easingType
        )

        const rotation = yield* interpolateKeyframeProperty(
          current.rotation,
          next?.rotation,
          progress,
          current.easingType
        )

        const fov = yield* interpolateKeyframeProperty(current.fov, next?.fov, progress, current.easingType)

        return {
          position,
          rotation,
          fov,
          currentKeyframe,
          nextKeyframe,
          progress,
        }
      }),

    /**
     * アニメーション一時停止
     */
    pauseAnimation: (animation) =>
      Effect.gen(function* () {
        return yield* setAnimationState(animation, AnimationStateOps.createPaused())
      }),

    /**
     * アニメーション再開
     */
    resumeAnimation: (animation, currentTime) =>
      Effect.gen(function* () {
        return yield* setAnimationState(animation, AnimationStateOps.createPlaying())
      }),

    /**
     * アニメーション停止
     */
    stopAnimation: (animation) =>
      Effect.gen(function* () {
        return yield* setAnimationState(animation, AnimationStateOps.createCompleted())
      }),
  })
)

/**
 * Helper Functions
 */

/**
 * 位置アニメーションの更新
 */
const updatePositionAnimation = (
  animation: PositionAnimationState,
  currentTime: Timestamp
): Effect.Effect<AnimationUpdateResult, CameraError> =>
  Effect.gen(function* () {
    const elapsed = currentTime - animation.startTime
    const progress = Math.min(1.0, elapsed / animation.duration)
    const easedProgress = EasingFunctions.getFunction(animation.easingType)(progress)

    const currentPosition = yield* Position3DOps.lerp(animation.startPosition, animation.endPosition, easedProgress)

    const isComplete = progress >= 1.0
    const newState = isComplete ? AnimationStateOps.createCompleted() : AnimationStateOps.createPlaying()

    const updatedAnimation: PositionAnimationState = {
      ...animation,
      currentPosition,
      progress: AnimationValueFactory.createProgress(progress),
      state: newState,
    }

    return {
      animation: updatedAnimation,
      hasChanged: true,
      isComplete,
    }
  })

/**
 * 回転アニメーションの更新
 */
const updateRotationAnimation = (
  animation: RotationAnimationState,
  currentTime: Timestamp
): Effect.Effect<AnimationUpdateResult, CameraError> =>
  Effect.gen(function* () {
    const elapsed = currentTime - animation.startTime
    const progress = Math.min(1.0, elapsed / animation.duration)
    const easedProgress = EasingFunctions.getFunction(animation.easingType)(progress)

    const currentRotation = yield* CameraRotationOps.slerp(
      animation.startRotation,
      animation.endRotation,
      easedProgress
    )

    const isComplete = progress >= 1.0
    const newState = isComplete ? AnimationStateOps.createCompleted() : AnimationStateOps.createPlaying()

    const updatedAnimation: RotationAnimationState = {
      ...animation,
      currentRotation,
      progress: AnimationValueFactory.createProgress(progress),
      state: newState,
    }

    return {
      animation: updatedAnimation,
      hasChanged: true,
      isComplete,
    }
  })

/**
 * FOVアニメーションの更新
 */
const updateFOVAnimation = (
  animation: FOVAnimationState,
  currentTime: Timestamp
): Effect.Effect<AnimationUpdateResult, CameraError> =>
  Effect.gen(function* () {
    const elapsed = currentTime - animation.startTime
    const progress = Math.min(1.0, elapsed / animation.duration)
    const easedProgress = EasingFunctions.getFunction(animation.easingType)(progress)

    const currentFOVValue = InterpolationOps.lerp(animation.startFOV, animation.endFOV, easedProgress)

    const currentFOV = yield* AnimationValueFactory.createFOV(currentFOVValue)

    const isComplete = progress >= 1.0
    const newState = isComplete ? AnimationStateOps.createCompleted() : AnimationStateOps.createPlaying()

    const updatedAnimation: FOVAnimationState = {
      ...animation,
      currentFOV,
      progress: AnimationValueFactory.createProgress(progress),
      state: newState,
    }

    return {
      animation: updatedAnimation,
      hasChanged: true,
      isComplete,
    }
  })

/**
 * 複合アニメーションの更新
 */
const updateCombinedAnimation = (
  animation: CombinedAnimationState,
  currentTime: Timestamp
): Effect.Effect<AnimationUpdateResult, CameraError> =>
  Effect.gen(function* () {
    // 各アニメーションを個別に更新
    const positionResult = yield* updatePositionAnimation(animation.positionAnimation, currentTime)
    const rotationResult = yield* updateRotationAnimation(animation.rotationAnimation, currentTime)

    const fovResult = yield* pipe(
      Option.fromNullable(animation.fovAnimation),
      Option.match({
        onSome: (fovAnim) => Effect.map(updateFOVAnimation(fovAnim, currentTime), Option.some),
        onNone: () => Effect.succeed(Option.none<AnimationUpdateResult>()),
      })
    )

    // すべてのアニメーションが完了したかチェック
    const isComplete =
      positionResult.isComplete &&
      rotationResult.isComplete &&
      pipe(
        fovResult,
        Option.match({
          onSome: (result) => result.isComplete,
          onNone: () => true,
        })
      )

    const newState = isComplete ? AnimationStateOps.createCompleted() : AnimationStateOps.createPlaying()

    const updatedAnimation: CombinedAnimationState = {
      ...animation,
      positionAnimation: positionResult.animation as PositionAnimationState,
      rotationAnimation: rotationResult.animation as RotationAnimationState,
      fovAnimation: fovResult?.animation as FOVAnimationState | undefined,
      state: newState,
    }

    return {
      animation: updatedAnimation,
      hasChanged: positionResult.hasChanged || rotationResult.hasChanged || (fovResult?.hasChanged ?? false),
      isComplete,
    }
  })

/**
 * アニメーション開始時刻の取得
 */
const getAnimationStartTime = (animation: AnimationStateUnion): Timestamp =>
  pipe(
    animation._tag,
    Match.value,
    Match.when('PositionAnimation', () => animation.startTime),
    Match.when('RotationAnimation', () => animation.startTime),
    Match.when('FOVAnimation', () => animation.startTime),
    Match.when('CombinedAnimation', () => animation.startTime),
    Match.exhaustive
  )

/**
 * アニメーション期間の取得
 */
const getAnimationDuration = (animation: AnimationStateUnion): AnimationDuration =>
  pipe(
    animation._tag,
    Match.value,
    Match.when('PositionAnimation', () => animation.duration),
    Match.when('RotationAnimation', () => animation.duration),
    Match.when('FOVAnimation', () => animation.duration),
    Match.when('CombinedAnimation', () => {
      // 複合アニメーションでは最長の期間を返す
      const durations = [
        animation.positionAnimation.duration,
        animation.rotationAnimation.duration,
        animation.fovAnimation?.duration,
      ].filter(Boolean) as AnimationDuration[]
      return Math.max(...durations) as AnimationDuration
    }),
    Match.exhaustive
  )

/**
 * アニメーション状態の設定
 */
const setAnimationState = (
  animation: AnimationStateUnion,
  newState: AnimationState
): Effect.Effect<AnimationStateUnion, CameraError> =>
  Effect.gen(function* () {
    return pipe(
      animation._tag,
      Match.value,
      Match.when('PositionAnimation', () => ({ ...animation, state: newState })),
      Match.when('RotationAnimation', () => ({ ...animation, state: newState })),
      Match.when('FOVAnimation', () => ({ ...animation, state: newState })),
      Match.when('CombinedAnimation', () => ({ ...animation, state: newState })),
      Match.exhaustive
    )
  })

/**
 * キーフレーム範囲の検索
 */
const findKeyframeRange = (
  keyframes: readonly AnimationKeyframe[],
  currentTime: Timestamp
): Effect.Effect<
  {
    currentKeyframe: number
    nextKeyframe?: number
    progress: number
  },
  CameraError
> =>
  Effect.gen(function* () {
    // 時刻でソートされたキーフレームから現在の範囲を検索
    const keyframePair = pipe(
      ReadonlyArray.range(0, keyframes.length - 1),
      ReadonlyArray.findFirst((i) => {
        const current = keyframes[i]
        const next = keyframes[i + 1]
        return currentTime >= current.time && currentTime <= next.time
      }),
      Option.map((i) => {
        const current = keyframes[i]
        const next = keyframes[i + 1]
        const duration = next.time - current.time
        const elapsed = currentTime - current.time
        const progress = duration > 0 ? elapsed / duration : 1.0

        return {
          currentKeyframe: i,
          nextKeyframe: i + 1,
          progress,
        }
      })
    )

    return pipe(
      keyframePair,
      Option.match({
        onSome: (pair) => Effect.succeed(pair),
        onNone: () =>
          Effect.succeed({
            currentKeyframe: keyframes.length - 1,
            nextKeyframe: undefined,
            progress: 1.0,
          }),
      })
    )
  })

/**
 * キーフレームプロパティの補間
 */
const interpolateKeyframeProperty = <T>(
  current: T | undefined,
  next: T | undefined,
  progress: number,
  easingType: EasingType
): Effect.Effect<T | undefined, CameraError> =>
  Effect.gen(function* () {
    // 境界値チェック（意図的保持）
    if (!current) return undefined
    if (!next) return current

    // 型に応じた補間処理（Match.valueで型判定）
    return yield* pipe(
      current,
      Match.value,
      Match.when(
        (c) => typeof c === 'object' && c !== null && 'x' in c,
        (c) => Position3DOps.lerp(c as Position3D, next as Position3D, progress) as Effect.Effect<T, CameraError>
      ),
      Match.when(
        (c) => typeof c === 'object' && c !== null && 'pitch' in c,
        (c) =>
          CameraRotationOps.slerp(c as CameraRotation, next as CameraRotation, progress) as Effect.Effect<
            T,
            CameraError
          >
      ),
      Match.when(
        (c) => typeof c === 'number',
        (c) =>
          Effect.sync(() => {
            const easedProgress = EasingFunctions.getFunction(easingType)(progress)
            return InterpolationOps.lerp(c, next as number, easedProgress) as T
          })
      ),
      Match.orElse((c) => Effect.succeed(c))
    )
  })

/**
 * 現在時刻の取得
 */
const getCurrentTime = (): Effect.Effect<Timestamp, CameraError> =>
  Effect.map(Clock.currentTimeMillis, (ms) => ms as Timestamp)

/**
 * アニメーションID生成（スタブ実装）
 */
const generateAnimationId = (): Effect.Effect<string, CameraError> =>
  Effect.succeed(`anim_${Math.random().toString(36).substr(2, 9)}`)

/**
 * アニメーションエラー作成ヘルパー
 */
const createAnimationError = {
  emptyKeyframes: () => new Error('Empty keyframes array') as CameraError,
}
