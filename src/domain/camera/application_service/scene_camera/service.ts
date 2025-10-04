import { Array, Context, Effect, Option } from 'effect'
import type {
  CinematicSequence,
  SceneCameraApplicationError,
  SceneCameraConfig,
  SceneCameraId,
  SceneCameraSetup,
  SceneCameraState,
  SceneCameraStatistics,
  SceneId,
  SceneTarget,
  SequenceExecutionResult,
  SequenceId,
} from './types.js'

/**
 * Scene Camera Application Service Interface
 *
 * シーンカメラのユースケースを実現するApplication Serviceです。
 * このサービスは以下の責務を持ちます：
 *
 * 1. シーンカメラの作成・管理・破棄
 * 2. シネマティックシーケンスの実行制御
 * 3. カメラターゲットの動的管理
 * 4. 複数カメラの協調制御
 * 5. パフォーマンス最適化と監視
 * 6. エラーハンドリングと回復処理
 */
export interface SceneCameraApplicationService {
  /**
   * シーンカメラを作成します
   *
   * @param sceneId - シーンID
   * @param initialSetup - 初期セットアップ設定
   * @returns 作成されたシーンカメラID
   */
  readonly createSceneCamera: (
    sceneId: SceneId,
    initialSetup: SceneCameraSetup
  ) => Effect.Effect<SceneCameraId, SceneCameraApplicationError>

  /**
   * 既存シーンにカメラを追加します
   *
   * @param sceneId - シーンID
   * @param cameraConfig - カメラ設定
   * @returns 作成されたシーンカメラID
   */
  readonly addCameraToScene: (
    sceneId: SceneId,
    cameraConfig: SceneCameraConfig
  ) => Effect.Effect<SceneCameraId, SceneCameraApplicationError>

  /**
   * シーンカメラのターゲットを更新します
   *
   * @param sceneCameraId - シーンカメラID
   * @param targets - 新しいターゲット一覧
   * @returns 更新処理の結果
   */
  readonly updateSceneTargets: (
    sceneCameraId: SceneCameraId,
    targets: Array.ReadonlyArray<SceneTarget>
  ) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * シネマティックシーケンスを開始します
   *
   * @param sceneCameraId - シーンカメラID
   * @param sequence - 実行するシーケンス
   * @returns シーケンス実行結果
   */
  readonly startCinematicSequence: (
    sceneCameraId: SceneCameraId,
    sequence: CinematicSequence
  ) => Effect.Effect<SequenceExecutionResult, SceneCameraApplicationError>

  /**
   * シネマティックシーケンスを一時停止します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns 一時停止処理の結果
   */
  readonly pauseCinematicSequence: (sceneCameraId: SceneCameraId) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * 一時停止中のシネマティックシーケンスを再開します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns 再開処理の結果
   */
  readonly resumeCinematicSequence: (sceneCameraId: SceneCameraId) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * シネマティックシーケンスを停止します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns 停止処理の結果
   */
  readonly stopCinematicSequence: (sceneCameraId: SceneCameraId) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * シーンカメラの現在状態を取得します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns カメラ状態
   */
  readonly getSceneCameraState: (
    sceneCameraId: SceneCameraId
  ) => Effect.Effect<SceneCameraState, SceneCameraApplicationError>

  /**
   * シーンの全カメラ状態を取得します
   *
   * @param sceneId - シーンID
   * @returns シーンの全カメラ状態
   */
  readonly getAllSceneCameras: (
    sceneId: SceneId
  ) => Effect.Effect<Array.ReadonlyArray<SceneCameraState>, SceneCameraApplicationError>

  /**
   * シーンカメラを破棄します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns 破棄処理の結果
   */
  readonly destroySceneCamera: (sceneCameraId: SceneCameraId) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * シーン全体を破棄します
   *
   * @param sceneId - シーンID
   * @returns 破棄処理の結果
   */
  readonly destroyScene: (sceneId: SceneId) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * 複数のシーンカメラを同期して制御します
   *
   * @param operations - 同期実行する操作の配列
   * @returns 同期実行結果
   */
  readonly synchronizeCameras: (
    operations: Array.ReadonlyArray<{
      readonly sceneCameraId: SceneCameraId
      readonly operation: CameraSyncOperation
    }>
  ) => Effect.Effect<Array.ReadonlyArray<SequenceExecutionResult>, SceneCameraApplicationError>

  /**
   * カメラ間でのスムーズな切り替えを実行します
   *
   * @param fromCameraId - 切り替え元カメラID
   * @param toCameraId - 切り替え先カメラID
   * @param transitionConfig - 切り替え設定
   * @returns 切り替え結果
   */
  readonly switchBetweenCameras: (
    fromCameraId: SceneCameraId,
    toCameraId: SceneCameraId,
    transitionConfig: CameraTransitionConfig
  ) => Effect.Effect<SequenceExecutionResult, SceneCameraApplicationError>

  /**
   * 動的ターゲット追跡を開始します
   *
   * @param sceneCameraId - シーンカメラID
   * @param target - 追跡するターゲット
   * @param trackingConfig - 追跡設定
   * @returns 追跡開始結果
   */
  readonly startDynamicTracking: (
    sceneCameraId: SceneCameraId,
    target: SceneTarget,
    trackingConfig: DynamicTrackingConfig
  ) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * 動的ターゲット追跡を停止します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns 追跡停止結果
   */
  readonly stopDynamicTracking: (sceneCameraId: SceneCameraId) => Effect.Effect<void, SceneCameraApplicationError>

  /**
   * シーンカメラの統計情報を取得します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns 統計情報
   */
  readonly getSceneCameraStatistics: (
    sceneCameraId: SceneCameraId
  ) => Effect.Effect<SceneCameraStatistics, SceneCameraApplicationError>

  /**
   * シーン全体の統計情報を取得します
   *
   * @param sceneId - シーンID
   * @returns シーン統計情報
   */
  readonly getSceneStatistics: (sceneId: SceneId) => Effect.Effect<SceneStatistics, SceneCameraApplicationError>

  /**
   * カメラシステムの最適化を実行します
   *
   * @param optimizationTargets - 最適化対象
   * @returns 最適化結果
   */
  readonly optimizeSceneCameras: (
    optimizationTargets: OptimizationTargets
  ) => Effect.Effect<OptimizationResult, SceneCameraApplicationError>

  /**
   * シーケンスの事前検証を実行します
   *
   * @param sequence - 検証対象シーケンス
   * @returns 検証結果
   */
  readonly validateSequence: (
    sequence: CinematicSequence
  ) => Effect.Effect<SequenceValidationResult, SceneCameraApplicationError>

  /**
   * シーンカメラのデバッグ情報を取得します
   *
   * @param sceneCameraId - シーンカメラID
   * @returns デバッグ情報
   */
  readonly getDebugInfo: (
    sceneCameraId: SceneCameraId
  ) => Effect.Effect<SceneCameraDebugInfo, SceneCameraApplicationError>
}

/**
 * カメラ同期操作
 */
export type CameraSyncOperation = import('effect').Data.TaggedEnum<{
  StartSequence: {
    readonly sequence: CinematicSequence
    readonly startTime: Option<number>
  }
  StopSequence: {}
  PauseSequence: {}
  ResumeSequence: {}
  UpdateTargets: {
    readonly targets: Array.ReadonlyArray<SceneTarget>
  }
}>

/**
 * カメラ遷移設定
 */
export type CameraTransitionConfig = import('effect').Brand.Brand<
  {
    readonly duration: number
    readonly easing: string
    readonly blendMode: TransitionBlendMode
    readonly preserveTargets: boolean
  },
  'CameraTransitionConfig'
>

/**
 * 遷移ブレンドモード
 */
export type TransitionBlendMode = import('effect').Data.TaggedEnum<{
  Cut: {} // 瞬間切り替え
  Fade: { readonly color: string }
  Dissolve: { readonly pattern: string }
  Wipe: { readonly direction: WipeDirection }
  Morph: { readonly steps: number }
}>

/**
 * ワイプ方向
 */
export type WipeDirection = import('effect').Data.TaggedEnum<{
  LeftToRight: {}
  RightToLeft: {}
  TopToBottom: {}
  BottomToTop: {}
  Circular: { readonly center: import('./types.js').Position3D }
}>

/**
 * 動的追跡設定
 */
export type DynamicTrackingConfig = import('effect').Brand.Brand<
  {
    readonly smoothing: number
    readonly maxSpeed: number
    readonly anticipation: number
    readonly keepDistance: Option<number>
    readonly avoidObstacles: boolean
  },
  'DynamicTrackingConfig'
>

/**
 * シーン統計情報
 */
export type SceneStatistics = import('effect').Brand.Brand<
  {
    readonly totalCameras: number
    readonly activeCameras: number
    readonly totalSequencesPlayed: number
    readonly averagePerformance: number
    readonly memoryUsage: number
    readonly lastOptimization: number
  },
  'SceneStatistics'
>

/**
 * 最適化対象
 */
export type OptimizationTargets = import('effect').Brand.Brand<
  {
    readonly reduceMemoryUsage: boolean
    readonly improveFrameRate: boolean
    readonly optimizeSequences: boolean
    readonly cleanupInactiveCameras: boolean
    readonly targetFPS: number
    readonly maxMemoryMB: number
  },
  'OptimizationTargets'
>

/**
 * 最適化結果
 */
export type OptimizationResult = import('effect').Brand.Brand<
  {
    readonly camerasOptimized: number
    readonly sequencesOptimized: number
    readonly memoryFreed: number
    readonly performanceImprovement: number
    readonly optimizationDuration: number
  },
  'OptimizationResult'
>

/**
 * シーケンス検証結果
 */
export type SequenceValidationResult = import('effect').Data.TaggedEnum<{
  Valid: {
    readonly estimatedDuration: number
    readonly requiredResources: Array.ReadonlyArray<string>
  }
  Invalid: {
    readonly errors: Array.ReadonlyArray<ValidationError>
    readonly warnings: Array.ReadonlyArray<ValidationWarning>
  }
}>

/**
 * 検証エラー
 */
export type ValidationError = import('effect').Brand.Brand<
  {
    readonly type: string
    readonly message: string
    readonly keyframeIndex: Option<number>
    readonly severity: ErrorSeverity
  },
  'ValidationError'
>

/**
 * 検証警告
 */
export type ValidationWarning = import('effect').Brand.Brand<
  {
    readonly type: string
    readonly message: string
    readonly recommendation: Option<string>
  },
  'ValidationWarning'
>

/**
 * エラー深刻度
 */
export type ErrorSeverity = import('effect').Data.TaggedEnum<{
  Low: {}
  Medium: {}
  High: {}
  Critical: {}
}>

/**
 * シーンカメラデバッグ情報
 */
export type SceneCameraDebugInfo = import('effect').Brand.Brand<
  {
    readonly currentState: SceneCameraState
    readonly recentOperations: Array.ReadonlyArray<string>
    readonly performanceMetrics: SceneCameraStatistics
    readonly memoryBreakdown: MemoryBreakdown
    readonly activeSequenceDetails: Option<SequenceDebugDetails>
  },
  'SceneCameraDebugInfo'
>

/**
 * メモリ使用詳細
 */
export type MemoryBreakdown = import('effect').Brand.Brand<
  {
    readonly sequences: number
    readonly keyframes: number
    readonly targets: number
    readonly animations: number
    readonly effects: number
    readonly total: number
  },
  'MemoryBreakdown'
>

/**
 * シーケンスデバッグ詳細
 */
export type SequenceDebugDetails = import('effect').Brand.Brand<
  {
    readonly sequenceId: SequenceId
    readonly currentKeyframe: number
    readonly totalKeyframes: number
    readonly progress: number
    readonly remainingTime: number
    readonly lastFrameTime: number
  },
  'SequenceDebugDetails'
>

/**
 * Scene Camera Application Service Context Tag
 *
 * 依存性注入で使用するContextタグです。
 * Layer.effectでの実装提供とEffect.genでの利用で使用されます。
 */
export const SceneCameraApplicationService = Context.GenericTag<SceneCameraApplicationService>(
  '@minecraft/domain/camera/SceneCameraApplicationService'
)
