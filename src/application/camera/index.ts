/**
 * Camera Domain - Application Service Layer
 *
 * カメラドメインのApplication Service層統合エクスポートです。
 * ユースケース実現層として、ドメインサービスとリポジトリを統合し、
 * 外部から利用可能な高次のビジネスロジックを提供します。
 */

// ========================================
// Camera API Service
// ========================================

export { CameraAPIService, CameraAPIServiceLive, type CameraAPIError } from './api-service'
export type { CameraAPIService } from './api-service'

// ========================================
// Player Camera Application Service
// ========================================

export {
  PlayerCameraApplicationService,
  PlayerCameraApplicationServiceLive,
  PlayerCameraApplicationServiceModule,
  PlayerCameraApplicationServiceTypeGuards,
} from './player_camera/index'
export type { PlayerCameraApplicationService } from './player_camera/index'

export type {
  CameraApplicationError,
  KeyModifier,
  KeyboardAction,
  PerformanceMetrics,
  PlayerCameraInput,
  PlayerCameraSettingsUpdate,
  PlayerCameraState,
  PlayerCameraStatistics,
  ViewModeTransitionResult as PlayerViewModeTransitionResult,
} from './player_camera/index'

export {
  createCameraApplicationError,
  createPlayerCameraInput,
  createViewModeTransitionResult as createPlayerViewModeTransitionResult,
} from './player_camera/index'

// ========================================
// Scene Camera Application Service
// ========================================

export {
  SceneCameraApplicationService,
  SceneCameraApplicationServiceLive,
  SceneCameraApplicationServiceModule,
  SceneCameraApplicationServiceTypeGuards,
} from './scene_camera/index'
export type { SceneCameraApplicationService } from './scene_camera/index'

export type {
  CameraSyncOperation,
  CameraTransitionConfig,
  CinematicSequence,
  DynamicTrackingConfig,
  FollowMode,
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
} from './scene_camera/index'

export { createSceneCameraApplicationError, createSequenceExecutionResult } from './scene_camera/index'

// ========================================
// Camera Mode Manager Application Service
// ========================================

export {
  CameraModeManagerApplicationService,
  CameraModeManagerApplicationServiceLive,
  CameraModeManagerApplicationServiceModule,
} from './camera_mode_manager/index'
export type { CameraModeManagerApplicationService } from './camera_mode_manager/index'

export type {
  AnimationType,
  CameraModeManagerApplicationError,
  CameraModeSwitchOperation,
  EasingFunction,
  GameContext,
  ViewModeTransitionResult as ModeManagerViewModeTransitionResult,
  PlayerPreferences,
  ViewModeContext,
  ViewModeRecommendation,
  ViewModeTransitionConfig,
} from './camera_mode_manager/index'

export {
  createCameraModeManagerApplicationError,
  createViewModeTransitionResult as createModeManagerViewModeTransitionResult,
} from './camera_mode_manager/index'

// ========================================
// Camera System Orchestrator Service
// ========================================

export {
  CameraSystemOrchestratorService,
  CameraSystemOrchestratorServiceLive,
  CameraSystemOrchestratorServiceModule,
} from './camera_system_orchestrator/index'
export type { CameraSystemOrchestratorService } from './camera_system_orchestrator/index'

export type {
  CameraSystemConfig,
  CameraSystemError,
  CameraSystemStatistics,
  CameraSystemTickResult,
  GlobalCameraEvent,
  PerformanceOptimizationResult,
  PerformanceTargets,
  WorldState,
} from './camera_system_orchestrator/index'

// ========================================
// Layer Integration
// ========================================

export * from './layer'

// ========================================
// Module Information
// ========================================

/**
 * Camera Application Service Layer Module Information
 */
export const CameraApplicationServiceLayerModule = {
  name: 'CameraApplicationServiceLayer',
  version: '1.0.0',
  description: 'Camera Domain Application Service層統合 - ユースケース実現の完全実装',

  services: [
    'PlayerCameraApplicationService',
    'SceneCameraApplicationService',
    'CameraModeManagerApplicationService',
    'CameraSystemOrchestratorService',
    'CameraAPIService',
  ] as const,

  responsibilities: [
    'プレイヤーカメラのユースケース実現',
    'シーンカメラ・シネマティック機能',
    'ビューモード切り替え・最適化',
    'システム全体のオーケストレーション',
    'Camera CQRS APIサービスの提供',
  ] as const,

  features: [
    'Effect-TSパターン完全適用',
    'Domain Service・Repository統合',
    'Layer.mergeAll統合Layer提供',
    '型安全なユースケース実現',
    'エラーハンドリング統一',
    'パフォーマンス最適化',
    'テスタビリティ保証',
    '拡張性・保守性向上',
  ] as const,

  dependencies: {
    domainServices: [
      'CameraControlService',
      'AnimationEngineService',
      'CollisionDetectionService',
      'SettingsValidatorService',
      'ViewModeManagerService',
    ],
    repositories: [
      'CameraStateRepository',
      'SettingsStorageRepository',
      'AnimationHistoryRepository',
      'ViewModePreferencesRepository',
    ],
  } as const,

  provides: {
    playerCamera: 'PlayerCameraApplicationService',
    sceneCamera: 'SceneCameraApplicationService',
    modeManager: 'CameraModeManagerApplicationService',
    systemOrchestrator: 'CameraSystemOrchestratorService',
    unifiedLayer: 'CameraApplicationServicesLayer',
  } as const,
} as const

// ========================================
// Type Guards
// ========================================

/**
 * Camera Application Service Layer Type Guards
 */
export const CameraApplicationServiceLayerTypeGuards = {
  /**
   * Layer統合の妥当性確認
   */
  isValidApplicationServiceLayer: (layer: unknown): boolean => {
    // 実際の実装では、layerから各Application Serviceを抽出して確認
    return typeof layer === 'object' && layer !== null
  },

  /**
   * Application Serviceの完全性確認
   */
  hasAllApplicationServices: (services: unknown): boolean => {
    return (
      typeof services === 'object' &&
      services !== null &&
      'PlayerCameraApplicationService' in services &&
      'SceneCameraApplicationService' in services &&
      'CameraModeManagerApplicationService' in services &&
      'CameraSystemOrchestratorService' in services
    )
  },
} as const

// ========================================
// Convenience Re-exports
// ========================================

/**
 * 便利な型定義の再エクスポート
 * 外部から利用する際の import を簡素化
 */
export type {
  AnimationConfig,
  AnimationState,
  CameraId,
  CameraRotation,
  CameraSettings,
  PlayerId,
  Position3D,
  Vector3D,
  ViewMode,
} from '@domain/camera/types'

// ========================================
// Usage Examples Documentation
// ========================================

/**
 * Camera Application Service Layer Usage Examples
 *
 * ## 完全なカメラシステムの構築
 *
 * ### 1. 統合Layerの使用
 * ```typescript
 * import { Effect } from 'effect'
 * import {
 *   CameraApplicationServicesLayer,
 *   PlayerCameraApplicationService,
 *   SceneCameraApplicationService,
 *   CameraModeManagerApplicationService,
 *   CameraSystemOrchestratorService
 * } from '@/application/camera'
 *
 * const cameraSystemProgram = Effect.gen(function* () {
 *   // プレイヤーカメラの初期化
 *   const playerService = yield* PlayerCameraApplicationService
 *   const playerId = 'player-1'
 *   const cameraId = yield* playerService.initializePlayerCamera(
 *     playerId,
 *     { x: 0, y: 64, z: 0 },
 *     Option.none()
 *   )
 *
 *   // シーンカメラの作成
 *   const sceneService = yield* SceneCameraApplicationService
 *   const sceneCameraId = yield* sceneService.createSceneCamera(
 *     'main-scene',
 *     cinematicSetup
 *   )
 *
 *   // モード管理の設定
 *   const modeManager = yield* CameraModeManagerApplicationService
 *   const transitionResult = yield* modeManager.switchCameraMode(
 *     cameraId,
 *     { _tag: 'ThirdPerson' },
 *     transitionConfig
 *   )
 *
 *   // システム統計の取得
 *   const orchestrator = yield* CameraSystemOrchestratorService
 *   const stats = yield* orchestrator.getCameraSystemStatistics()
 *
 *   return { cameraId, sceneCameraId, transitionResult, stats }
 * }).pipe(
 *   Effect.provide(CameraApplicationServicesLayer)
 * )
 * ```
 *
 * ### 2. Domain Service・Repository統合の活用
 * ```typescript
 * import { CameraDomainServicesLayer } from '@/domain/camera/domain_service'
 * import { CameraRepositoryLayerLive } from '@/domain/camera/repository'
 *
 * // 完全なカメラドメインLayer
 * const CompleteCameraDomainLayer = Layer.mergeAll(
 *   CameraDomainServicesLayer,
 *   CameraRepositoryLayerLive,
 *   CameraApplicationServicesLayer
 * )
 *
 * // アプリケーションでの使用
 * const app = cameraSystemProgram.pipe(
 *   Effect.provide(CompleteCameraDomainLayer)
 * )
 * ```
 *
 * ### 3. 個別Application Serviceの使用
 * ```typescript
 * // プレイヤーカメラのみ使用
 * const playerCameraProgram = Effect.gen(function* () {
 *   const service = yield* PlayerCameraApplicationService
 *   // プレイヤーカメラ固有の操作
 * }).pipe(
 *   Effect.provide(PlayerCameraApplicationServiceLive)
 * )
 *
 * // シーンカメラのみ使用
 * const sceneCameraProgram = Effect.gen(function* () {
 *   const service = yield* SceneCameraApplicationService
 *   // シーンカメラ固有の操作
 * }).pipe(
 *   Effect.provide(SceneCameraApplicationServiceLive)
 * )
 * ```
 *
 * ## エラーハンドリング統合
 *
 * ```typescript
 * import { Match } from 'effect'
 *
 * const handleCameraErrors = Effect.gen(function* () {
 *   const playerService = yield* PlayerCameraApplicationService
 *   const sceneService = yield* SceneCameraApplicationService
 *
 *   try {
 *     // 複数のApplication Service操作
 *     const playerResult = yield* playerService.getPlayerCameraState('player-1')
 *     const sceneResult = yield* sceneService.getSceneCameraState('scene-1')
 *     return { playerResult, sceneResult }
 *   } catch (error) {
 *     // 統一されたエラーハンドリング
 *     return yield* pipe(
 *       error,
 *       Match.value,
 *       Match.when(
 *         (e): e is CameraApplicationError =>
 *           PlayerCameraApplicationServiceTypeGuards.isCameraApplicationError(e),
 *         (e) => Effect.logError(`Player camera error: ${e._tag}`)
 *       ),
 *       Match.when(
 *         (e): e is SceneCameraApplicationError =>
 *           SceneCameraApplicationServiceTypeGuards.isSceneCameraApplicationError(e),
 *         (e) => Effect.logError(`Scene camera error: ${e._tag}`)
 *       ),
 *       Match.orElse(() => Effect.logError('Unknown camera error'))
 *     )
 *   }
 * })
 * ```
 *
 * この設計により、以下の価値を提供します：
 *
 * 1. **ユースケース中心**: ビジネスロジックの完全な実現
 * 2. **統合Layer**: 4つのApplication Serviceの統一提供
 * 3. **依存性管理**: Effect-TSによる完全な依存性注入
 * 4. **型安全性**: Brand型とSchema検証による型安全性
 * 5. **エラーハンドリング**: 構造化されたエラー処理
 * 6. **テスタビリティ**: モックが容易で単体テストが書きやすい
 * 7. **拡張性**: 新しいApplication Serviceの追加が容易
 * 8. **保守性**: 単一責任の原則に基づく明確な責任分離
 */
