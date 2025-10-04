/**
 * Animation Engine Domain Service
 *
 * カメラアニメーションに関する純粋なドメインロジックを提供するサービス。
 * 位置・回転・FOVアニメーションの制御、イージング関数、
 * 補間計算等のアニメーション処理を集約しています。
 */

import { Context, Effect } from 'effect'
import type {
  AnimationDuration,
  AnimationProgress,
  AnimationState,
  CameraError,
  CameraRotation,
  EasingType,
  FOV,
  Position3D,
  Timestamp,
} from '../../value-object'

/**
 * アニメーションエンジンドメインサービスの型定義
 */
export interface AnimationEngineService {
  /**
   * 位置アニメーションの作成
   * 開始位置から終了位置への滑らかなアニメーションを作成
   */
  readonly createPositionAnimation: (
    fromPosition: Position3D,
    toPosition: Position3D,
    duration: AnimationDuration,
    easingType: EasingType
  ) => Effect.Effect<PositionAnimationState, CameraError>

  /**
   * 回転アニメーションの作成
   * 開始回転から終了回転への最短経路アニメーションを作成
   */
  readonly createRotationAnimation: (
    fromRotation: CameraRotation,
    toRotation: CameraRotation,
    duration: AnimationDuration,
    easingType: EasingType
  ) => Effect.Effect<RotationAnimationState, CameraError>

  /**
   * FOVアニメーションの作成
   * ズームイン・アウト効果のためのFOVアニメーション
   */
  readonly createFOVAnimation: (
    fromFOV: FOV,
    toFOV: FOV,
    duration: AnimationDuration,
    easingType: EasingType
  ) => Effect.Effect<FOVAnimationState, CameraError>

  /**
   * 複合アニメーションの作成
   * 位置、回転、FOVを同時にアニメーション
   */
  readonly createCombinedAnimation: (
    positionAnimation: PositionAnimationState,
    rotationAnimation: RotationAnimationState,
    fovAnimation?: FOVAnimationState
  ) => Effect.Effect<CombinedAnimationState, CameraError>

  /**
   * アニメーション状態の更新
   * 現在時刻に基づいてアニメーション状態を進行
   */
  readonly updateAnimation: (
    animation: AnimationStateUnion,
    currentTime: Timestamp
  ) => Effect.Effect<AnimationUpdateResult, CameraError>

  /**
   * アニメーション完了確認
   * アニメーションが終了しているかをチェック
   */
  readonly isAnimationComplete: (animation: AnimationStateUnion, currentTime: Timestamp) => boolean

  /**
   * イージング計算
   * 指定されたイージング関数で値を補間
   */
  readonly calculateEasedValue: (
    startValue: number,
    endValue: number,
    progress: AnimationProgress,
    easingType: EasingType
  ) => number

  /**
   * 球面線形補間（SLERP）
   * 回転アニメーション用の球面補間
   */
  readonly slerpRotation: (
    fromRotation: CameraRotation,
    toRotation: CameraRotation,
    progress: AnimationProgress
  ) => Effect.Effect<CameraRotation, CameraError>

  /**
   * キーフレームアニメーションの評価
   * 複数のキーフレームから現在値を計算
   */
  readonly evaluateKeyframeAnimation: (
    keyframes: readonly AnimationKeyframe[],
    currentTime: Timestamp
  ) => Effect.Effect<KeyframeEvaluationResult, CameraError>

  /**
   * アニメーション一時停止
   * 実行中のアニメーションを一時停止
   */
  readonly pauseAnimation: (animation: AnimationStateUnion) => Effect.Effect<AnimationStateUnion, CameraError>

  /**
   * アニメーション再開
   * 一時停止中のアニメーションを再開
   */
  readonly resumeAnimation: (
    animation: AnimationStateUnion,
    currentTime: Timestamp
  ) => Effect.Effect<AnimationStateUnion, CameraError>

  /**
   * アニメーション停止
   * アニメーションを強制終了
   */
  readonly stopAnimation: (animation: AnimationStateUnion) => Effect.Effect<AnimationStateUnion, CameraError>
}

/**
 * 位置アニメーション状態
 */
export interface PositionAnimationState {
  readonly _tag: 'PositionAnimation'
  readonly id: string
  readonly startPosition: Position3D
  readonly endPosition: Position3D
  readonly currentPosition: Position3D
  readonly duration: AnimationDuration
  readonly easingType: EasingType
  readonly startTime: Timestamp
  readonly progress: AnimationProgress
  readonly state: AnimationState
}

/**
 * 回転アニメーション状態
 */
export interface RotationAnimationState {
  readonly _tag: 'RotationAnimation'
  readonly id: string
  readonly startRotation: CameraRotation
  readonly endRotation: CameraRotation
  readonly currentRotation: CameraRotation
  readonly duration: AnimationDuration
  readonly easingType: EasingType
  readonly startTime: Timestamp
  readonly progress: AnimationProgress
  readonly state: AnimationState
}

/**
 * FOVアニメーション状態
 */
export interface FOVAnimationState {
  readonly _tag: 'FOVAnimation'
  readonly id: string
  readonly startFOV: FOV
  readonly endFOV: FOV
  readonly currentFOV: FOV
  readonly duration: AnimationDuration
  readonly easingType: EasingType
  readonly startTime: Timestamp
  readonly progress: AnimationProgress
  readonly state: AnimationState
}

/**
 * 複合アニメーション状態
 */
export interface CombinedAnimationState {
  readonly _tag: 'CombinedAnimation'
  readonly id: string
  readonly positionAnimation: PositionAnimationState
  readonly rotationAnimation: RotationAnimationState
  readonly fovAnimation?: FOVAnimationState
  readonly state: AnimationState
  readonly startTime: Timestamp
}

/**
 * アニメーション状態の統合型
 */
export type AnimationStateUnion =
  | PositionAnimationState
  | RotationAnimationState
  | FOVAnimationState
  | CombinedAnimationState

/**
 * アニメーション更新結果
 */
export type AnimationUpdateResult = {
  readonly animation: AnimationStateUnion
  readonly hasChanged: boolean
  readonly isComplete: boolean
}

/**
 * アニメーションキーフレーム
 */
export interface AnimationKeyframe {
  readonly time: Timestamp
  readonly position?: Position3D
  readonly rotation?: CameraRotation
  readonly fov?: FOV
  readonly easingType: EasingType
}

/**
 * キーフレーム評価結果
 */
export interface KeyframeEvaluationResult {
  readonly position?: Position3D
  readonly rotation?: CameraRotation
  readonly fov?: FOV
  readonly currentKeyframe: number
  readonly nextKeyframe?: number
  readonly progress: AnimationProgress
}

/**
 * Animation Engine Service Context Tag
 * Effect-TSのDIコンテナで使用するサービスタグ
 */
export const AnimationEngineService = Context.GenericTag<AnimationEngineService>(
  '@minecraft/domain/camera/AnimationEngineService'
)
