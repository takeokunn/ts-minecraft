/**
 * Player Camera Application Service Module
 *
 * プレイヤーカメラのユースケースを実現するApplication Service層です。
 * Effect-TSの依存性注入パターンを活用して、ドメインサービスとリポジトリを
 * 統合した高次のビジネスロジックを提供します。
 */

// ========================================
// Service Interface & Context
// ========================================

export { PlayerCameraApplicationService } from './service.js'
export type { PlayerCameraApplicationService } from './service.js'

// ========================================
// Live Implementation
// ========================================

export { PlayerCameraApplicationServiceLive } from './live.js'

// ========================================
// Types & Schemas
// ========================================

export type {
  // Error Types
  CameraApplicationError,
  KeyModifier,
  KeyboardAction,
  PerformanceMetrics,
  // Input Types
  PlayerCameraInput,
  // Update Types
  PlayerCameraSettingsUpdate,
  // State Types
  PlayerCameraState,
  PlayerCameraStatistics,
  ViewModeTransitionFailureReason,
  // Result Types
  ViewModeTransitionResult,
} from './types.js'

export {
  CameraApplicationErrorSchema,
  // Schema Exports
  PlayerCameraInputSchema,
  PlayerCameraStateSchema,
  ViewModeTransitionResultSchema,
  createCameraApplicationError,
  // Factory Functions
  createPlayerCameraInput,
  createViewModeTransitionResult,
} from './types.js'

// ========================================
// Module Information
// ========================================

/**
 * Player Camera Application Service Module Information
 */
export const PlayerCameraApplicationServiceModule = {
  name: 'PlayerCameraApplicationService',
  version: '1.0.0',
  description: 'プレイヤーカメラユースケース実現のApplication Service',

  responsibilities: [
    'プレイヤーカメラの初期化・破棄',
    'プレイヤー入力処理とカメラ更新',
    'ビューモード切り替え管理',
    'カメラ設定の適用・永続化',
    'プレイヤー位置連動管理',
    'アニメーション制御',
    'パフォーマンス監視・最適化',
    '統計情報管理',
  ] as const,

  dependencies: [
    'CameraControlService',
    'AnimationEngineService',
    'CollisionDetectionService',
    'SettingsValidatorService',
    'ViewModeManagerService',
    'CameraStateRepository',
    'SettingsStorageRepository',
    'AnimationHistoryRepository',
    'ViewModePreferencesRepository',
  ] as const,

  provides: {
    primaryInterface: 'PlayerCameraApplicationService',
    liveImplementation: 'PlayerCameraApplicationServiceLive',
    types: ['PlayerCameraInput', 'PlayerCameraState', 'ViewModeTransitionResult', 'CameraApplicationError'],
  } as const,

  features: [
    'Effect-TSパターン完全適用',
    'マルチプレイヤー対応',
    'リアルタイム入力処理',
    'アニメーション統合',
    '衝突検出統合',
    'パフォーマンス最適化',
    '設定学習・推奨',
    'デバッグ支援',
  ] as const,
} as const

// ========================================
// Type Guards & Utilities
// ========================================

/**
 * Player Camera Application Service Type Guards
 */
export const PlayerCameraApplicationServiceTypeGuards = {
  /**
   * PlayerCameraInput type guard
   */
  isPlayerCameraInput: (value: unknown): value is PlayerCameraInput => {
    return (
      typeof value === 'object' &&
      value !== null &&
      '_tag' in value &&
      ['MouseMovement', 'KeyboardInput', 'ViewModeSwitch', 'SettingsUpdate'].includes((value as any)._tag)
    )
  },

  /**
   * PlayerCameraState type guard
   */
  isPlayerCameraState: (value: unknown): value is PlayerCameraState => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'playerId' in value &&
      'cameraId' in value &&
      'position' in value &&
      'rotation' in value &&
      'viewMode' in value &&
      'settings' in value &&
      'isInitialized' in value &&
      'lastUpdate' in value
    )
  },

  /**
   * CameraApplicationError type guard
   */
  isCameraApplicationError: (value: unknown): value is CameraApplicationError => {
    return (
      typeof value === 'object' &&
      value !== null &&
      '_tag' in value &&
      [
        'CameraNotFound',
        'PlayerNotFound',
        'ViewModeSwitchNotAllowed',
        'SystemNotInitialized',
        'ConcurrentUpdateConflict',
        'PerformanceLimitExceeded',
        'InvalidInputFormat',
        'ConfigurationValidationFailed',
        'ResourceAllocationFailed',
      ].includes((value as any)._tag)
    )
  },

  /**
   * ViewModeTransitionResult type guard
   */
  isViewModeTransitionResult: (value: unknown): value is ViewModeTransitionResult => {
    return (
      typeof value === 'object' &&
      value !== null &&
      '_tag' in value &&
      ['Success', 'Failed', 'InProgress'].includes((value as any)._tag)
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
  CameraId,
  CameraSettings,
  MouseDelta,
  PlayerCameraPreferences,
  PlayerId,
  Position3D,
  Vector3D,
  ViewMode,
  ViewModeTransitionConfig,
} from '../../types/index.js'

// ========================================
// Usage Examples Documentation
// ========================================

/**
 * Player Camera Application Service Usage Examples
 *
 * ## 基本的な使用例
 *
 * ### 1. プレイヤーカメラの初期化
 * ```typescript
 * import { Effect } from 'effect'
 * import {
 *   PlayerCameraApplicationService,
 *   PlayerCameraApplicationServiceLive
 * } from '@/domain/camera/application_service/player_camera'
 *
 * const initializeCamera = (playerId: PlayerId, position: Position3D) =>
 *   Effect.gen(function* () {
 *     const service = yield* PlayerCameraApplicationService
 *     const cameraId = yield* service.initializePlayerCamera(
 *       playerId,
 *       position,
 *       Option.none()
 *     )
 *     return cameraId
 *   })
 *
 * const program = initializeCamera('player-1', { x: 0, y: 64, z: 0 }).pipe(
 *   Effect.provide(PlayerCameraApplicationServiceLive)
 * )
 * ```
 *
 * ### 2. プレイヤー入力の処理
 * ```typescript
 * import { createPlayerCameraInput } from '@/domain/camera/application_service/player_camera'
 *
 * const handleMouseMovement = (playerId: PlayerId, deltaX: number, deltaY: number) =>
 *   Effect.gen(function* () {
 *     const service = yield* PlayerCameraApplicationService
 *     const input = createPlayerCameraInput.mouseMovement(deltaX, deltaY)
 *     yield* service.handlePlayerInput(playerId, input)
 *   })
 * ```
 *
 * ### 3. ビューモードの切り替え
 * ```typescript
 * const switchToThirdPerson = (playerId: PlayerId) =>
 *   Effect.gen(function* () {
 *     const service = yield* PlayerCameraApplicationService
 *     const result = yield* service.switchViewMode(
 *       playerId,
 *       { _tag: 'ThirdPerson' },
 *       Option.some({ duration: 500, easing: 'easeInOut' })
 *     )
 *     return result
 *   })
 * ```
 *
 * ### 4. バッチ更新処理
 * ```typescript
 * const updateMultipleCameras = (updates: Array<{ playerId: PlayerId, input: PlayerCameraInput }>) =>
 *   Effect.gen(function* () {
 *     const service = yield* PlayerCameraApplicationService
 *     yield* service.batchUpdatePlayerCameras(updates)
 *   })
 * ```
 *
 * ### 5. パフォーマンス最適化
 * ```typescript
 * const optimizePerformance = () =>
 *   Effect.gen(function* () {
 *     const service = yield* PlayerCameraApplicationService
 *     const result = yield* service.optimizePerformance({
 *       maxFrameTime: 16.67, // 60fps
 *       maxMemoryUsage: 100 * 1024 * 1024, // 100MB
 *       targetFPS: 60
 *     })
 *     console.log('Optimizations applied:', result.optimizationsApplied)
 *     console.log('Performance improvement:', result.performanceImprovement)
 *   })
 * ```
 *
 * ## エラーハンドリング例
 *
 * ```typescript
 * import { Match } from 'effect'
 *
 * const handleCameraOperation = (playerId: PlayerId) =>
 *   Effect.gen(function* () {
 *     const service = yield* PlayerCameraApplicationService
 *     const state = yield* service.getPlayerCameraState(playerId)
 *     return state
 *   }).pipe(
 *     Effect.catchAll((error: CameraApplicationError) =>
 *       pipe(
 *         error,
 *         Match.value,
 *         Match.tag('PlayerNotFound', ({ playerId }) =>
 *           Effect.logError(`Player ${playerId} not found`)
 *         ),
 *         Match.tag('SystemNotInitialized', () =>
 *           Effect.logError('Camera system not initialized')
 *         ),
 *         Match.orElse(() =>
 *           Effect.logError(`Unexpected camera error: ${error._tag}`)
 *         )
 *       )
 *     )
 *   )
 * ```
 *
 * ## Layer構成例
 *
 * ```typescript
 * import { Layer } from 'effect'
 * import { CameraDomainServicesLayer } from '@/domain/camera/domain_service'
 * import { CameraRepositoryLayerLive } from '@/domain/camera/repository'
 *
 * // 完全なカメラシステムLayer
 * const CameraSystemLayer = Layer.mergeAll(
 *   CameraDomainServicesLayer,
 *   CameraRepositoryLayerLive,
 *   PlayerCameraApplicationServiceLive
 * )
 *
 * // アプリケーションでの使用
 * const app = myProgram.pipe(
 *   Effect.provide(CameraSystemLayer)
 * )
 * ```
 *
 * この設計により、以下の価値を提供します：
 *
 * 1. **ユースケース中心**: ビジネスロジックの完全な実現
 * 2. **依存性注入**: テスタブルで柔軟なアーキテクチャ
 * 3. **型安全性**: Effect-TSとBrand型による完全な型安全性
 * 4. **エラーハンドリング**: 構造化されたエラー処理
 * 5. **パフォーマンス**: 最適化とモニタリング機能
 * 6. **拡張性**: 新機能追加の容易性
 */
