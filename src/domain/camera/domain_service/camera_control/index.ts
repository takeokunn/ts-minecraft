/**
 * Camera Control Domain Service
 *
 * カメラ制御ドメインサービスのバレルエクスポート。
 * サービス定義、Live実装、型定義を統合的に提供します。
 */

// Service Interface & Context Tag
export { CameraControlService } from './index'
export type {
  BoundingBox,
  CameraControlService as CameraControlServiceInterface,
  PositionConstraints,
  SphericalCoordinate,
  ViewBounds,
} from './index'

// Live Implementation
export { CameraControlServiceLive } from './index'

/**
 * 統合エクスポート - 便利な再エクスポート
 */

// よく使用される型の再エクスポート
export type { CameraControlService as CameraControl } from './index'

// サービスタグの別名エクスポート
export { CameraControlService as CameraControlTag } from './index'

/**
 * 使用例:
 *
 * ```typescript
 * import { Effect } from 'effect'
 * import { CameraControlService } from '@minecraft/domain/camera/domain_service/camera_control'
 *
 * const program = Effect.gen(function* () {
 *   const cameraControl = yield* CameraControlService
 *   const position = yield* cameraControl.calculateFirstPersonPosition(
 *     playerPosition,
 *     playerHeight
 *   )
 *   return position
 * })
 * ```
 */
export * from './index';
