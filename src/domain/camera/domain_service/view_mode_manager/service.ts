/**
 * View Mode Manager Domain Service
 *
 * ビューモード切り替えに関する純粋なドメインロジックを提供するサービス。
 * 各ビューモード間のトランジション、状態管理、制約確認等の
 * ビューモード制御ロジックを集約しています。
 */

import { Context, Data, Effect } from 'effect'
import type {
  AnimationDuration,
  Camera,
  CameraDistance,
  CameraError,
  CameraRotation,
  EasingType,
  Position3D,
  ViewMode,
} from '../../value-object'

/**
 * ビューモード管理ドメインサービスの型定義
 */
export interface ViewModeManagerService {
  /**
   * 一人称視点への切り替え
   * プレイヤー位置を基準とした一人称カメラに変更
   */
  readonly switchToFirstPerson: (
    camera: Camera,
    playerPosition: Position3D,
    transitionSettings?: ViewModeTransitionSettings
  ) => Effect.Effect<Camera, CameraError>

  /**
   * 三人称視点への切り替え
   * ターゲット位置と距離を指定した三人称カメラに変更
   */
  readonly switchToThirdPerson: (
    camera: Camera,
    targetPosition: Position3D,
    distance: CameraDistance,
    transitionSettings?: ViewModeTransitionSettings
  ) => Effect.Effect<Camera, CameraError>

  /**
   * スペクテイターモードへの切り替え
   * 自由視点カメラに変更
   */
  readonly switchToSpectator: (
    camera: Camera,
    initialPosition: Position3D,
    transitionSettings?: ViewModeTransitionSettings
  ) => Effect.Effect<Camera, CameraError>

  /**
   * シネマティックモードへの切り替え
   * 演出用カメラモードに変更
   */
  readonly switchToCinematic: (
    camera: Camera,
    cinematicSettings: CinematicSettings,
    transitionSettings?: ViewModeTransitionSettings
  ) => Effect.Effect<Camera, CameraError>

  /**
   * ビューモード切り替え可能性の確認
   * 現在の状況で指定されたビューモードに切り替え可能かチェック
   */
  readonly canSwitchToMode: (
    currentMode: ViewMode,
    targetMode: ViewMode,
    context: ViewModeContext
  ) => Effect.Effect<boolean, CameraError>

  /**
   * ビューモードトランジションの作成
   * あるビューモードから別のビューモードへの遷移定義を作成
   */
  readonly createViewModeTransition: (
    fromMode: ViewMode,
    toMode: ViewMode,
    transitionType: TransitionType
  ) => Effect.Effect<ViewModeTransition, CameraError>

  /**
   * トランジション実行
   * 作成されたトランジションを実際に実行
   */
  readonly executeTransition: (
    camera: Camera,
    transition: ViewModeTransition,
    currentTime: number
  ) => Effect.Effect<TransitionExecutionResult, CameraError>

  /**
   * ビューモード制約の確認
   * 指定されたビューモードでの制約や制限をチェック
   */
  readonly checkViewModeConstraints: (
    viewMode: ViewMode,
    context: ViewModeContext
  ) => Effect.Effect<ViewModeConstraintResult, CameraError>

  /**
   * 最適なビューモードの提案
   * 現在の状況に最も適したビューモードを提案
   */
  readonly suggestOptimalViewMode: (
    context: ViewModeContext,
    userPreferences: ViewModePreferences
  ) => Effect.Effect<ViewModeSuggestion, CameraError>

  /**
   * ビューモード履歴の管理
   * ビューモード切り替えの履歴を記録・取得
   */
  readonly getViewModeHistory: (
    camera: Camera,
    maxEntries?: number
  ) => Effect.Effect<readonly ViewModeHistoryEntry[], CameraError>

  /**
   * 前回のビューモードに復帰
   * 履歴から前回のビューモードに戻す
   */
  readonly revertToPreviousMode: (
    camera: Camera,
    transitionSettings?: ViewModeTransitionSettings
  ) => Effect.Effect<Camera, CameraError>
}

/**
 * ビューモードトランジション設定
 */
export interface ViewModeTransitionSettings {
  readonly duration: AnimationDuration
  readonly easingType: EasingType
  readonly smoothPosition: boolean
  readonly smoothRotation: boolean
  readonly smoothFOV: boolean
  readonly allowInterruption: boolean
}

/**
 * シネマティック設定
 */
export interface CinematicSettings {
  readonly cameraPath?: CameraPath
  readonly lookAtTarget?: Position3D
  readonly fovOverride?: number
  readonly enableDepthOfField: boolean
  readonly cinematicEffects: readonly CinematicEffect[]
}

/**
 * カメラパス
 */
export interface CameraPath {
  readonly keyframes: readonly CameraKeyframe[]
  readonly interpolationType: PathInterpolationType
  readonly duration: AnimationDuration
  readonly looping: boolean
}

/**
 * カメラキーフレーム
 */
export interface CameraKeyframe {
  readonly time: number // 0.0-1.0
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly fov?: number
  readonly easingType: EasingType
}

/**
 * シネマティック効果
 */
export type CinematicEffect =
  | 'depth_of_field'
  | 'motion_blur'
  | 'vignette'
  | 'color_grading'
  | 'screen_shake'
  | 'fade_in'
  | 'fade_out'

/**
 * パス補間タイプ
 */
export type PathInterpolationType = 'linear' | 'spline' | 'bezier'

/**
 * ビューモードコンテキスト
 */
export interface ViewModeContext {
  readonly gameState: GameState
  readonly playerState: PlayerState
  readonly environmentState: EnvironmentState
  readonly inputState: InputState
  readonly permissions: ViewModePermissions
}

/**
 * ゲーム状態
 */
export interface GameState {
  readonly mode: GameMode
  readonly paused: boolean
  readonly loading: boolean
  readonly cutscene: boolean
}

/**
 * プレイヤー状態
 */
export interface PlayerState {
  readonly position: Position3D
  readonly velocity: Position3D
  readonly health: number
  readonly alive: boolean
  readonly spectating: boolean
}

/**
 * 環境状態
 */
export interface EnvironmentState {
  readonly underwater: boolean
  readonly underground: boolean
  readonly inVehicle: boolean
  readonly confined: boolean // 狭い空間
}

/**
 * 入力状態
 */
export interface InputState {
  readonly inputType: 'mouse' | 'controller' | 'touch'
  readonly hasRecentInput: boolean
  readonly gestureActive: boolean
}

/**
 * ビューモード許可
 */
export interface ViewModePermissions {
  readonly canUseFirstPerson: boolean
  readonly canUseThirdPerson: boolean
  readonly canUseSpectator: boolean
  readonly canUseCinematic: boolean
  readonly restrictedModes: readonly ViewModeType[]
}

/**
 * ゲームモード
 */
export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator' | 'hardcore'

/**
 * ビューモード種別
 */
export type ViewModeType = 'first_person' | 'third_person' | 'spectator' | 'cinematic'

/**
 * トランジション種別
 */
export type TransitionType = 'instant' | 'smooth' | 'fade' | 'slide' | 'custom'

/**
 * ビューモードトランジション
 */
export interface ViewModeTransition {
  readonly id: string
  readonly fromMode: ViewMode
  readonly toMode: ViewMode
  readonly transitionType: TransitionType
  readonly duration: AnimationDuration
  readonly settings: ViewModeTransitionSettings
  readonly steps: readonly TransitionStep[]
}

/**
 * トランジションステップ
 */
export type TransitionStep = Data.TaggedEnum<{
  PositionTransition: {
    readonly fromPosition: Position3D
    readonly toPosition: Position3D
    readonly easingType: EasingType
  }
  RotationTransition: {
    readonly fromRotation: CameraRotation
    readonly toRotation: CameraRotation
    readonly easingType: EasingType
  }
  FOVTransition: {
    readonly fromFOV: number
    readonly toFOV: number
    readonly easingType: EasingType
  }
  DelayStep: {
    readonly delayMs: number
  }
  CallbackStep: {
    readonly callback: () => Effect.Effect<void, CameraError>
  }
}>

/**
 * トランジション実行結果
 */
export type TransitionExecutionResult = Data.TaggedEnum<{
  InProgress: {
    readonly progress: number // 0.0-1.0
    readonly currentCamera: Camera
    readonly estimatedCompletion: number
  }
  Completed: {
    readonly finalCamera: Camera
    readonly executionTime: number
  }
  Interrupted: {
    readonly reason: string
    readonly partialCamera: Camera
    readonly completedSteps: number
  }
  Failed: {
    readonly error: CameraError
    readonly failedStep: number
  }
}>

/**
 * ビューモード制約結果
 */
export interface ViewModeConstraintResult {
  readonly allowed: boolean
  readonly restrictions: readonly string[]
  readonly recommendations: readonly string[]
  readonly warnings: readonly string[]
}

/**
 * ビューモード設定
 */
export interface ViewModePreferences {
  readonly preferredMode: ViewModeType
  readonly autoSwitchEnabled: boolean
  readonly transitionSpeed: 'fast' | 'normal' | 'slow'
  readonly motionComfort: 'high' | 'medium' | 'low'
  readonly accessibilityModes: readonly string[]
}

/**
 * ビューモード提案
 */
export interface ViewModeSuggestion {
  readonly suggestedMode: ViewModeType
  readonly confidence: number // 0.0-1.0
  readonly reason: string
  readonly alternatives: readonly ViewModeAlternative[]
}

/**
 * ビューモード代替案
 */
export interface ViewModeAlternative {
  readonly mode: ViewModeType
  readonly score: number
  readonly pros: readonly string[]
  readonly cons: readonly string[]
}

/**
 * ビューモード履歴エントリ
 */
export interface ViewModeHistoryEntry {
  readonly timestamp: number
  readonly mode: ViewMode
  readonly duration: number
  readonly context: ViewModeContext
  readonly transitionType: TransitionType
}

/**
 * View Mode Manager Service Context Tag
 * Effect-TSのDIコンテナで使用するサービスタグ
 */
export const ViewModeManagerService = Context.GenericTag<ViewModeManagerService>(
  '@minecraft/domain/camera/ViewModeManagerService'
)

/**
 * Helper constructors for ADTs
 */
export const TransitionStep = Data.taggedEnum<TransitionStep>()
export const TransitionExecutionResult = Data.taggedEnum<TransitionExecutionResult>()
