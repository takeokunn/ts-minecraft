/**
 * Scene Camera Application Service Module
 *
 * シーンカメラのユースケースを実現するApplication Service層です。
 * シネマティック機能、複数カメラ協調制御、動的ターゲット追跡などの
 * 高度なカメラ制御機能を提供します。
 */

import { Schema } from 'effect'

// ========================================
// Service Interface & Context
// ========================================

export { SceneCameraApplicationService } from './service'

// ========================================
// Live Implementation
// ========================================

export { SceneCameraApplicationServiceLive } from './live'

// ========================================
// Types & Schemas
// ========================================

export type {
  BoundingBox,
  CameraConstraints,
  CameraEffect,
  CameraKeyframe,
  CameraPriority,
  CenteringMode,
  CinematicSequence,
  // Cinematic Types
  CinematicSettings,
  ColorGradingSettings,
  EasingType,
  ExposureSettings,
  FadeType,
  FollowMode,
  InterruptionReason,
  LoopMode,
  OrbitDirection,
  RenderingMetrics,
  // Error Types
  SceneCameraApplicationError,
  SceneCameraConfig,
  SceneCameraId,
  // Setup & Configuration Types
  SceneCameraSetup,
  // State Types
  SceneCameraState,
  SceneCameraStatistics,
  // Core Identifiers
  SceneId,
  SceneTarget,
  ScheduleId,
  SequenceCategory,
  SequenceExecutionError,
  // Result Types
  SequenceExecutionResult,
  SequenceId,
  SequenceMetadata,
  SequenceStatistics,
  TransitionSettings,
} from './types'

// Additional service-specific types
export type {
  CameraSyncOperation,
  CameraTransitionConfig,
  DynamicTrackingConfig,
  ErrorSeverity,
  MemoryBreakdown,
  OptimizationResult,
  OptimizationTargets,
  SceneCameraDebugInfo,
  SceneStatistics,
  SequenceDebugDetails,
  SequenceValidationResult,
  TransitionBlendMode,
  ValidationError,
  ValidationWarning,
  WipeDirection,
} from './types'

export {
  CinematicSequenceSchema,
  // Factory Functions
  createSceneCameraApplicationError,
  createSequenceExecutionResult,
  FollowModeSchema,
  SceneCameraApplicationErrorSchema,
  SceneCameraIdSchema,
  // Schema Exports
  SceneIdSchema,
  SceneTargetSchema,
  ScheduleIdSchema,
  SequenceIdSchema,
} from './types'

// ========================================
// Module Information
// ========================================

/**
 * Scene Camera Application Service Module Information
 */
export const SceneCameraApplicationServiceModule = {
  name: 'SceneCameraApplicationService',
  version: '1.0.0',
  description: 'シーンカメラ・シネマティック機能のApplication Service',

  responsibilities: [
    'シーンカメラの作成・管理・破棄',
    'シネマティックシーケンスの実行制御',
    'カメラターゲットの動的管理',
    '複数カメラの協調制御',
    'カメラ間のスムーズな切り替え',
    '動的ターゲット追跡',
    'パフォーマンス最適化と監視',
    'シーケンス検証とデバッグ支援',
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
  ] as const,

  provides: {
    primaryInterface: 'SceneCameraApplicationService',
    liveImplementation: 'SceneCameraApplicationServiceLive',
    types: ['SceneCameraSetup', 'CinematicSequence', 'SequenceExecutionResult', 'SceneCameraApplicationError'],
  } as const,

  features: [
    'Effect-TSパターン完全適用',
    'シネマティックシーケンス制御',
    '複数カメラ同期制御',
    '動的ターゲット追跡',
    'カメラ間遷移効果',
    'リアルタイム最適化',
    'シーケンス検証機能',
    'デバッグ情報提供',
  ] as const,
} as const

// ========================================
// Type Guards & Utilities
// ========================================

/**
 * Scene Camera Application Service Type Guards
 */
export const SceneCameraApplicationServiceTypeGuards = {
  /**
   * SceneCameraSetup type guard
   */
  isSceneCameraSetup: (value: unknown): value is SceneCameraSetup => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'initialPosition' in value &&
      'initialRotation' in value &&
      'followMode' in value &&
      'cinematicSettings' in value &&
      'targets' in value &&
      'constraints' in value &&
      'priority' in value
    )
  },

  /**
   * CinematicSequence type guard
   */
  isCinematicSequence: (value: unknown): value is CinematicSequence => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'name' in value &&
      'keyframes' in value &&
      'duration' in value &&
      'loopMode' in value &&
      'transitionSettings' in value &&
      'metadata' in value
    )
  },

  /**
   * SceneTarget type guard
   */
  isSceneTarget: (value: unknown): value is SceneTarget => Schema.is(SceneTargetSchema)(value),

  /**
   * SequenceExecutionResult type guard
   */
  isSequenceExecutionResult: (value: unknown): value is SequenceExecutionResult =>
    Schema.is(
      Schema.Struct({
        _tag: Schema.Union(
          Schema.Literal('Started'),
          Schema.Literal('Completed'),
          Schema.Literal('Failed'),
          Schema.Literal('Interrupted')
        ),
      })
    )(value),

  /**
   * SceneCameraApplicationError type guard
   */
  isSceneCameraApplicationError: (value: unknown): value is SceneCameraApplicationError =>
    Schema.is(SceneCameraApplicationErrorSchema)(value),
} as const

// ========================================
// Convenience Re-exports
// ========================================

/**
 * 便利な型定義の再エクスポート
 * 外部から利用する際の import を簡素化
 */
export type {
  AnimationState,
  CameraRotation,
  CameraSettings,
  EntityId,
  PlayerId,
  Position3D,
} from '@domain/camera/types'

// ========================================
// Usage Examples Documentation
// ========================================

/**
 * Scene Camera Application Service Usage Examples
 *
 * ## 基本的な使用例
 *
 * ### 1. シーンカメラの作成
 * ```typescript
 * import { Effect } from 'effect'
 * import {
 *   SceneCameraApplicationService,
 *   SceneCameraApplicationServiceLive
 * } from '@/application/camera/scene_camera'
 *
 * const createCinematicCamera = (sceneId: SceneId) =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *     const setup: SceneCameraSetup = {
 *       initialPosition: { x: 0, y: 100, z: 0 },
 *       initialRotation: { pitch: 0, yaw: 0, roll: 0 },
 *       followMode: { _tag: 'Static' },
 *       cinematicSettings: {
 *         enableMotionBlur: true,
 *         enableDepthOfField: true,
 *         fieldOfView: 75,
 *         // ... other settings
 *       },
 *       targets: [],
 *       constraints: {
 *         minDistance: 1,
 *         maxDistance: 1000,
 *         // ... other constraints
 *       },
 *       priority: { _tag: 'Normal' }
 *     }
 *
 *     const cameraId = yield* service.createSceneCamera(sceneId, setup)
 *     return cameraId
 *   })
 * ```
 *
 * ### 2. シネマティックシーケンスの実行
 * ```typescript
 * const playIntroSequence = (sceneCameraId: SceneCameraId) =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *
 *     const sequence: CinematicSequence = {
 *       id: 'intro-sequence',
 *       name: 'Game Intro',
 *       keyframes: [
 *         {
 *           time: 0,
 *           position: { x: 0, y: 100, z: 100 },
 *           rotation: { pitch: -15, yaw: 0, roll: 0 },
 *           fieldOfView: 60,
 *           easing: { _tag: 'EaseIn' },
 *           effects: []
 *         },
 *         {
 *           time: 5000, // 5秒後
 *           position: { x: 0, y: 50, z: 50 },
 *           rotation: { pitch: -30, yaw: 45, roll: 0 },
 *           fieldOfView: 75,
 *           easing: { _tag: 'EaseOut' },
 *           effects: []
 *         }
 *       ],
 *       duration: 5000,
 *       loopMode: { _tag: 'None' },
 *       // ... other settings
 *     }
 *
 *     const result = yield* service.startCinematicSequence(sceneCameraId, sequence)
 *     return result
 *   })
 * ```
 *
 * ### 3. 動的ターゲット追跡
 * ```typescript
 * const followPlayer = (sceneCameraId: SceneCameraId, playerId: PlayerId) =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *
 *     const target: SceneTarget = {
 *       _tag: 'Player',
 *       playerId,
 *       offset: { x: 0, y: 5, z: -10 }, // プレイヤーの後ろ上
 *       weight: 1.0
 *     }
 *
 *     const trackingConfig: DynamicTrackingConfig = {
 *       smoothing: 0.1,
 *       maxSpeed: 50,
 *       anticipation: 0.2,
 *       keepDistance: Option.some(10),
 *       avoidObstacles: true
 *     }
 *
 *     yield* service.startDynamicTracking(sceneCameraId, target, trackingConfig)
 *   })
 * ```
 *
 * ### 4. 複数カメラの同期制御
 * ```typescript
 * const synchronizedCameraShow = (cameraIds: ReadonlyArray<SceneCameraId>) =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *
 *     const operations = cameraIds.map(id => ({
 *       sceneCameraId: id,
 *       operation: {
 *         _tag: 'StartSequence' as const,
 *         sequence: createSyncSequence(id),
 *         startTime: Option.some((yield* Clock.currentTimeMillis) + 1000) // 1秒後に同期開始
 *       }
 *     }))
 *
 *     const results = yield* service.synchronizeCameras(operations)
 *     return results
 *   })
 * ```
 *
 * ### 5. カメラ間のスムーズな切り替え
 * ```typescript
 * const smoothCameraSwitch = (fromId: SceneCameraId, toId: SceneCameraId) =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *
 *     const transitionConfig: CameraTransitionConfig = {
 *       duration: 2000, // 2秒間の遷移
 *       easing: 'easeInOut',
 *       blendMode: {
 *         _tag: 'Fade',
 *         color: '#000000'
 *       },
 *       preserveTargets: false
 *     }
 *
 *     const result = yield* service.switchBetweenCameras(fromId, toId, transitionConfig)
 *     return result
 *   })
 * ```
 *
 * ## エラーハンドリング例
 *
 * ```typescript
 * import { Match } from 'effect'
 *
 * const handleSceneCameraOperation = (sceneCameraId: SceneCameraId) =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *     const state = yield* service.getSceneCameraState(sceneCameraId)
 *     return state
 *   }).pipe(
 *     Effect.catchAll((error: SceneCameraApplicationError) =>
 *       pipe(
 *         error,
 *         Match.value,
 *         Match.tag('SceneCameraNotFound', ({ sceneCameraId }) =>
 *           Effect.logError(`Scene camera ${sceneCameraId} not found`)
 *         ),
 *         Match.tag('SequenceExecutionFailed', ({ sequenceId, error }) =>
 *           Effect.logError(`Sequence ${sequenceId} failed: ${error._tag}`)
 *         ),
 *         Match.tag('ResourceLimitExceeded', ({ resource, current, limit }) =>
 *           Effect.logError(`Resource ${resource} exceeded: ${current}/${limit}`)
 *         ),
 *         Match.orElse(() =>
 *           Effect.logError(`Unexpected scene camera error: ${error._tag}`)
 *         )
 *       )
 *     )
 *   )
 * ```
 *
 * ## 最適化とデバッグ例
 *
 * ```typescript
 * const optimizeAndDebug = () =>
 *   Effect.gen(function* () {
 *     const service = yield* SceneCameraApplicationService
 *
 *     // パフォーマンス最適化
 *     const optimizationResult = yield* service.optimizeSceneCameras({
 *       reduceMemoryUsage: true,
 *       improveFrameRate: true,
 *       optimizeSequences: true,
 *       cleanupInactiveCameras: true,
 *       targetFPS: 60,
 *       maxMemoryMB: 500
 *     })
 *
 *     console.log('Optimization results:', optimizationResult)
 *
 *     // デバッグ情報の取得
 *     const debugInfo = yield* service.getDebugInfo(sceneCameraId)
 *     console.log('Memory breakdown:', debugInfo.memoryBreakdown)
 *
 *     return { optimizationResult, debugInfo }
 *   })
 * ```
 *
 * この設計により、以下の価値を提供します：
 *
 * 1. **シネマティック制御**: 映画品質のカメラワーク
 * 2. **複数カメラ協調**: 同期・非同期カメラ制御
 * 3. **動的追跡**: リアルタイムターゲット追跡
 * 4. **スムーズ遷移**: カメラ間の自然な切り替え
 * 5. **パフォーマンス最適化**: 大規模シーン対応
 * 6. **デバッグ支援**: 開発・運用支援機能
 */
