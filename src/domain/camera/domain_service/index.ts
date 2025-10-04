/**
 * Camera Domain Service Layer
 *
 * カメラドメインのドメインサービス層統合エクスポート。
 * 純粋なビジネスロジックを実装したドメインサービスを
 * 統合的に提供します。
 */

/**
 * Camera Control Domain Service
 * カメラ制御に関する純粋なドメインロジック
 */
export * from './camera-control'

/**
 * Animation Engine Domain Service
 * カメラアニメーション制御に関するドメインロジック
 */
export * from './animation-engine'

/**
 * Collision Detection Domain Service
 * カメラ衝突検出に関するドメインロジック
 */
export * from './collision-detection'

/**
 * Settings Validator Domain Service
 * カメラ設定検証に関するドメインロジック
 */
export * from './settings-validator'

/**
 * View Mode Manager Domain Service
 * ビューモード管理に関するドメインロジック
 */
export * from './view-mode-manager'

/**
 * 統合型定義エクスポート
 *
 * よく使用される型を便利に再エクスポートします。
 */

// Service Tags for Effect-TS DI
export {
  AnimationEngineService as AnimationEngineTag,
  CameraControlService as CameraControlTag,
  CollisionDetectionService as CollisionDetectionTag,
  SettingsValidatorService as SettingsValidatorTag,
  ViewModeManagerService as ViewModeManagerTag,
} from './camera-control'

export { AnimationEngineService } from './animation-engine'
export { CollisionDetectionService } from './collision-detection'
export { SettingsValidatorService } from './settings-validator'
export { ViewModeManagerService } from './view-mode-manager'

// Live Implementations for Layer composition
export {
  AnimationEngineServiceLive,
  CameraControlServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,
} from './camera-control'

/**
 * 統合Layer定義
 *
 * 全てのカメラドメインサービスを統合したLayerを提供
 */
import { Layer } from 'effect'
import {
  AnimationEngineServiceLive,
  CameraControlServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,
} from './camera-control'

/**
 * 全カメラドメインサービスの統合Layer
 *
 * この単一のLayerを提供することで、すべてのカメラ
 * ドメインサービスを一度に利用可能にします。
 */
export const CameraDomainServicesLayer = Layer.mergeAll(
  CameraControlServiceLive,
  AnimationEngineServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive
)

/**
 * 主要なドメインサービス型の再エクスポート
 *
 * 外部から利用する際の便利型定義
 */
export type {
  AnimationEngineService,
  CameraControlService,
  CollisionDetectionService,
  SettingsValidatorService,
  ViewModeManagerService,
} from './camera-control'

/**
 * 主要なドメインエラー型の再エクスポート
 */
export type {
  CollisionResult,
  CompatibilityResult,
  SettingsValidationError,
  TransitionExecutionResult,
} from './camera-control'

/**
 * 使用例:
 *
 * ```typescript
 * import { Effect } from 'effect'
 * import {
 *   CameraDomainServicesLayer,
 *   CameraControlService,
 *   AnimationEngineService,
 *   ViewModeManagerService
 * } from '@minecraft/domain/camera/domain_service'
 *
 * const program = Effect.gen(function* () {
 *   // カメラ制御サービス
 *   const cameraControl = yield* CameraControlService
 *   const position = yield* cameraControl.calculateFirstPersonPosition(
 *     playerPosition,
 *     playerHeight
 *   )
 *
 *   // アニメーションエンジン
 *   const animationEngine = yield* AnimationEngineService
 *   const animation = yield* animationEngine.createPositionAnimation(
 *     startPos,
 *     endPos,
 *     duration,
 *     'easeInOut'
 *   )
 *
 *   // ビューモード管理
 *   const viewModeManager = yield* ViewModeManagerService
 *   const canSwitch = yield* viewModeManager.canSwitchToMode(
 *     currentMode,
 *     targetMode,
 *     context
 *   )
 *
 *   return { position, animation, canSwitch }
 * }).pipe(
 *   Effect.provide(CameraDomainServicesLayer)
 * )
 * ```
 *
 * この設計により、以下の価値を提供します：
 *
 * 1. **純粋なドメインロジック**: 外部依存のない純粋関数として実装
 * 2. **型安全性**: Effect-TSとBrand型による完全な型安全性
 * 3. **テスタビリティ**: モックが容易で単体テストが書きやすい
 * 4. **合成可能性**: Layer.mergeAllによる柔軟なサービス組み合わせ
 * 5. **保守性**: 単一責任の原則に基づく明確な責任分離
 */
