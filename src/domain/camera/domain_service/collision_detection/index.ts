/**
 * Collision Detection Domain Service
 *
 * 衝突検出ドメインサービスのバレルエクスポート。
 * サービス定義、Live実装、型定義を統合的に提供します。
 */

// Service Interface & Context Tag
export { CollisionDetectionService, CollisionObject, CollisionResult } from './service'
export type {
  BlockType,
  CollisionDetectionService as CollisionDetectionServiceInterface,
  CollisionDetectionSettings,
  CollisionMaterial,
  CollisionMaterialType,
  PathCollisionInfo,
  RaycastHit,
  TerrainCollisionData,
  WorldCollisionData,
} from './service'

// Live Implementation
export { CollisionDetectionServiceLive } from './live'

/**
 * 統合エクスポート - 便利な再エクスポート
 */

// よく使用される型の再エクスポート
export type { CollisionDetectionService as CollisionDetection } from './service'

// サービスタグの別名エクスポート
export { CollisionDetectionService as CollisionDetectionTag } from './service'

/**
 * 使用例:
 *
 * ```typescript
 * import { Effect } from 'effect'
 * import { CollisionDetectionService } from '@minecraft/domain/camera/domain_service/collision_detection'
 *
 * const program = Effect.gen(function* () {
 *   const collisionDetection = yield* CollisionDetectionService
 *   const collision = yield* collisionDetection.checkCameraCollision(
 *     cameraPosition,
 *     collisionRadius,
 *     worldData
 *   )
 *   return collision
 * })
 * ```
 */
