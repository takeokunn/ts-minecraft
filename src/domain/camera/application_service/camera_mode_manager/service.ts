import { Array, Context, Effect, Option } from 'effect'
import type { CameraId, ViewMode } from '@domain/camera/types'
import type {
  CameraModeManagerApplicationError,
  CameraModeSwitchOperation,
  GameContext,
  PlayerPreferences,
  ScheduleId,
  ViewModeContext,
  ViewModeRecommendation,
  ViewModeTransitionConfig,
  ViewModeTransitionResult,
} from './index'

/**
 * Camera Mode Manager Application Service Interface
 *
 * カメラモード切り替えのユースケースを実現するApplication Serviceです。
 * このサービスは以下の責務を持ちます：
 *
 * 1. ビューモードの切り替え管理
 * 2. 複数カメラの一括モード切り替え
 * 3. スケジュール化されたモード遷移
 * 4. コンテキスト依存のモード推奨
 * 5. パフォーマンス最適化に基づくモード選択
 * 6. ユーザー設定とシステム制約の調整
 */
export interface CameraModeManagerApplicationService {
  /**
   * カメラのビューモードを切り替えます
   *
   * @param cameraId - カメラID
   * @param targetMode - 切り替え先のビューモード
   * @param transitionConfig - 遷移設定
   * @returns 遷移結果
   */
  readonly switchCameraMode: (
    cameraId: CameraId,
    targetMode: ViewMode,
    transitionConfig: ViewModeTransitionConfig
  ) => Effect.Effect<ViewModeTransitionResult, CameraModeManagerApplicationError>

  /**
   * 複数のカメラのモードを一括切り替えします
   *
   * @param operations - 切り替え操作の配列
   * @returns 切り替え結果の配列
   */
  readonly batchSwitchCameraMode: (
    operations: Array.ReadonlyArray<CameraModeSwitchOperation>
  ) => Effect.Effect<Array.ReadonlyArray<ViewModeTransitionResult>, CameraModeManagerApplicationError>

  /**
   * スケジュール化されたビューモード遷移を設定します
   *
   * @param cameraId - カメラID
   * @param targetMode - 切り替え先のビューモード
   * @param scheduledTime - 実行予定時刻
   * @param transitionConfig - 遷移設定
   * @returns スケジュールID
   */
  readonly scheduleViewModeTransition: (
    cameraId: CameraId,
    targetMode: ViewMode,
    scheduledTime: Date,
    transitionConfig: ViewModeTransitionConfig
  ) => Effect.Effect<ScheduleId, CameraModeManagerApplicationError>

  /**
   * スケジュール化された遷移をキャンセルします
   *
   * @param scheduleId - スケジュールID
   * @returns キャンセル処理の結果
   */
  readonly cancelScheduledTransition: (scheduleId: ScheduleId) => Effect.Effect<void, CameraModeManagerApplicationError>

  /**
   * 利用可能なビューモードを取得します
   *
   * @param cameraId - カメラID
   * @param context - ビューモードコンテキスト
   * @returns 利用可能なビューモードの配列
   */
  readonly getAvailableViewModes: (
    cameraId: CameraId,
    context: ViewModeContext
  ) => Effect.Effect<Array.ReadonlyArray<ViewMode>, CameraModeManagerApplicationError>

  /**
   * コンテキストに基づいて最適なビューモードを推奨します
   *
   * @param cameraId - カメラID
   * @param context - ゲームコンテキスト
   * @param playerPreferences - プレイヤー設定
   * @returns ビューモード推奨結果
   */
  readonly optimizeViewModeForContext: (
    cameraId: CameraId,
    context: GameContext,
    playerPreferences: PlayerPreferences
  ) => Effect.Effect<ViewModeRecommendation, CameraModeManagerApplicationError>

  /**
   * 現在のビューモード遷移状況を取得します
   *
   * @param cameraId - カメラID
   * @returns 遷移状況
   */
  readonly getTransitionStatus: (
    cameraId: CameraId
  ) => Effect.Effect<Option<ViewModeTransitionResult>, CameraModeManagerApplicationError>

  /**
   * 全スケジュール済み遷移を取得します
   *
   * @returns スケジュール済み遷移の一覧
   */
  readonly getAllScheduledTransitions: () => Effect.Effect<
    Array.ReadonlyArray<{
      readonly scheduleId: ScheduleId
      readonly cameraId: CameraId
      readonly targetMode: ViewMode
      readonly scheduledTime: number
      readonly status: ScheduleStatus
    }>,
    CameraModeManagerApplicationError
  >

  /**
   * モード切り替えの統計情報を取得します
   *
   * @param timeRange - 時間範囲（オプション）
   * @returns 統計情報
   */
  readonly getModeTransitionStatistics: (
    timeRange: Option<TimeRange>
  ) => Effect.Effect<ModeTransitionStatistics, CameraModeManagerApplicationError>

  /**
   * パフォーマンス制約に基づいてモード切り替えを最適化します
   *
   * @param performanceTargets - パフォーマンス目標
   * @returns 最適化結果
   */
  readonly optimizeForPerformance: (
    performanceTargets: PerformanceTargets
  ) => Effect.Effect<PerformanceOptimizationResult, CameraModeManagerApplicationError>

  /**
   * モード遷移の設定を検証します
   *
   * @param config - 遷移設定
   * @param sourceMode - 遷移元モード
   * @param targetMode - 遷移先モード
   * @returns 検証結果
   */
  readonly validateTransitionConfig: (
    config: ViewModeTransitionConfig,
    sourceMode: ViewMode,
    targetMode: ViewMode
  ) => Effect.Effect<TransitionValidationResult, CameraModeManagerApplicationError>

  /**
   * 緊急時のモード切り替えを実行します
   *
   * @param cameraId - カメラID
   * @param emergencyMode - 緊急時モード
   * @param reason - 緊急切り替えの理由
   * @returns 緊急切り替え結果
   */
  readonly emergencyModeSwitch: (
    cameraId: CameraId,
    emergencyMode: ViewMode,
    reason: string
  ) => Effect.Effect<ViewModeTransitionResult, CameraModeManagerApplicationError>
}

/**
 * スケジュール状態
 */
export type ScheduleStatus = import('effect').Data.TaggedEnum<{
  Pending: {}
  InProgress: {}
  Completed: {}
  Cancelled: {}
  Failed: { readonly error: string }
}>

/**
 * 時間範囲
 */
export type TimeRange = import('effect').Brand.Brand<
  {
    readonly startTime: number
    readonly endTime: number
  },
  'TimeRange'
>

/**
 * モード遷移統計
 */
export type ModeTransitionStatistics = import('effect').Brand.Brand<
  {
    readonly totalTransitions: number
    readonly successfulTransitions: number
    readonly failedTransitions: number
    readonly averageTransitionTime: number
    readonly mostUsedMode: ViewMode
    readonly transitionsByMode: Record<string, number>
    readonly performanceImpact: number
  },
  'ModeTransitionStatistics'
>

/**
 * パフォーマンス目標
 */
export type PerformanceTargets = import('effect').Brand.Brand<
  {
    readonly targetFPS: number
    readonly maxMemoryUsageMB: number
    readonly maxTransitionTime: number
    readonly reduceAnimations: boolean
    readonly prioritizeResponsiveness: boolean
  },
  'PerformanceTargets'
>

/**
 * パフォーマンス最適化結果
 */
export type PerformanceOptimizationResult = import('effect').Brand.Brand<
  {
    readonly optimizationsApplied: Array.ReadonlyArray<string>
    readonly estimatedFPSImprovement: number
    readonly estimatedMemoryReduction: number
    readonly modifiedTransitions: number
  },
  'PerformanceOptimizationResult'
>

/**
 * 遷移検証結果
 */
export type TransitionValidationResult = import('effect').Data.TaggedEnum<{
  Valid: {
    readonly estimatedDuration: number
    readonly warnings: Array.ReadonlyArray<string>
  }
  Invalid: {
    readonly errors: Array.ReadonlyArray<ValidationError>
    readonly suggestions: Array.ReadonlyArray<string>
  }
}>

/**
 * 検証エラー
 */
export type ValidationError = import('effect').Brand.Brand<
  {
    readonly field: string
    readonly message: string
    readonly severity: ErrorSeverity
  },
  'ValidationError'
>

/**
 * エラー深刻度
 */
export type ErrorSeverity = import('effect').Data.TaggedEnum<{
  Info: {}
  Warning: {}
  Error: {}
  Critical: {}
}>

/**
 * Camera Mode Manager Application Service Context Tag
 *
 * 依存性注入で使用するContextタグです。
 * Layer.effectでの実装提供とEffect.genでの利用で使用されます。
 */
export const CameraModeManagerApplicationService = Context.GenericTag<CameraModeManagerApplicationService>(
  '@minecraft/domain/camera/CameraModeManagerApplicationService'
)
