import { Array, Context, Effect } from 'effect'

/**
 * Camera System Orchestrator Service Interface
 *
 * カメラシステム全体のオーケストレーションを担当するApplication Serviceです。
 * 複数のカメラApplication Serviceを統合して、システムレベルの機能を提供します。
 */
export interface CameraSystemOrchestratorService {
  /**
   * カメラシステムを初期化します
   *
   * @param systemConfig - システム設定
   * @returns 初期化処理の結果
   */
  readonly initializeCameraSystem: (systemConfig: CameraSystemConfig) => Effect.Effect<void, CameraSystemError>

  /**
   * カメラシステムをシャットダウンします
   *
   * @returns シャットダウン処理の結果
   */
  readonly shutdownCameraSystem: () => Effect.Effect<void, CameraSystemError>

  /**
   * システム全体の更新処理を実行します
   *
   * @param deltaTime - フレーム間隔時間
   * @param worldState - ワールド状態
   * @returns システム更新結果
   */
  readonly processSystemTick: (
    deltaTime: number,
    worldState: WorldState
  ) => Effect.Effect<CameraSystemTickResult, CameraSystemError>

  /**
   * グローバルカメライベントを処理します
   *
   * @param event - グローバルカメライベント
   * @returns イベント処理結果
   */
  readonly handleGlobalCameraEvent: (event: GlobalCameraEvent) => Effect.Effect<void, CameraSystemError>

  /**
   * カメラシステムの統計情報を取得します
   *
   * @returns システム統計情報
   */
  readonly getCameraSystemStatistics: () => Effect.Effect<CameraSystemStatistics, CameraSystemError>

  /**
   * システムパフォーマンスを最適化します
   *
   * @param performanceTargets - パフォーマンス目標
   * @returns 最適化結果
   */
  readonly optimizeSystemPerformance: (
    performanceTargets: PerformanceTargets
  ) => Effect.Effect<PerformanceOptimizationResult, CameraSystemError>
}

/**
 * カメラシステム設定
 */
export type CameraSystemConfig = import('effect').Brand.Brand<
  {
    readonly maxConcurrentCameras: number
    readonly defaultPerformanceProfile: string
    readonly enableAdvancedFeatures: boolean
    readonly memoryLimitMB: number
  },
  'CameraSystemConfig'
>

/**
 * ワールド状態
 */
export type WorldState = import('effect').Brand.Brand<
  {
    readonly timeOfDay: number
    readonly weather: string
    readonly activeChunks: number
    readonly entityCount: number
  },
  'WorldState'
>

/**
 * システム更新結果
 */
export type CameraSystemTickResult = import('effect').Brand.Brand<
  {
    readonly processedCameras: number
    readonly activeAnimations: number
    readonly frameTime: number
    readonly memoryUsage: number
  },
  'CameraSystemTickResult'
>

/**
 * グローバルカメライベント
 */
export type GlobalCameraEvent = import('effect').Data.TaggedEnum<{
  SystemShutdown: {}
  PerformanceWarning: { readonly metric: string; readonly value: number }
  ResourceExhaustion: { readonly resource: string }
  ConfigurationChanged: { readonly changes: Record<string, unknown> }
}>

/**
 * システム統計情報
 */
export type CameraSystemStatistics = import('effect').Brand.Brand<
  {
    readonly totalCameras: number
    readonly activeCameras: number
    readonly totalMemoryUsage: number
    readonly averageFrameTime: number
    readonly systemUptime: number
  },
  'CameraSystemStatistics'
>

/**
 * パフォーマンス目標
 */
export type PerformanceTargets = import('effect').Brand.Brand<
  {
    readonly targetFPS: number
    readonly maxMemoryMB: number
    readonly reduceQuality: boolean
  },
  'PerformanceTargets'
>

/**
 * パフォーマンス最適化結果
 */
export type PerformanceOptimizationResult = import('effect').Brand.Brand<
  {
    readonly optimizationsApplied: Array.ReadonlyArray<string>
    readonly performanceGain: number
  },
  'PerformanceOptimizationResult'
>

/**
 * カメラシステムエラー
 */
export type CameraSystemError = import('effect').Data.TaggedEnum<{
  InitializationFailed: { readonly reason: string }
  SystemBusy: { readonly activeOperations: number }
  ResourceUnavailable: { readonly resource: string }
  ConfigurationError: { readonly details: string }
}>

/**
 * Camera System Orchestrator Service Context Tag
 */
export const CameraSystemOrchestratorService = Context.GenericTag<CameraSystemOrchestratorService>(
  '@minecraft/domain/camera/CameraSystemOrchestratorService'
)
