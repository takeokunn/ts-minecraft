/**
 * Animation Engine Domain Service
 *
 * アニメーションエンジンドメインサービスのバレルエクスポート。
 * サービス定義、Live実装、型定義を統合的に提供します。
 */

// Service Interface & Context Tag
export { AnimationEngineService } from './index'
export type {
  AnimationEngineService as AnimationEngineServiceInterface,
  AnimationKeyframe,
  AnimationStateUnion,
  AnimationUpdateResult,
  CombinedAnimationState,
  FOVAnimationState,
  KeyframeEvaluationResult,
  PositionAnimationState,
  RotationAnimationState,
} from './index'

// Live Implementation
export { AnimationEngineServiceLive } from './index'

/**
 * 統合エクスポート - 便利な再エクスポート
 */

// よく使用される型の再エクスポート
export type { AnimationEngineService as AnimationEngine } from './index'

// サービスタグの別名エクスポート
export { AnimationEngineService as AnimationEngineTag } from './index'

/**
 * 使用例:
 *
 * ```typescript
 * import { Effect } from 'effect'
 * import { AnimationEngineService } from '@minecraft/domain/camera/domain_service/animation_engine'
 *
 * const program = Effect.gen(function* () {
 *   const animationEngine = yield* AnimationEngineService
 *   const positionAnim = yield* animationEngine.createPositionAnimation(
 *     startPosition,
 *     endPosition,
 *     duration,
 *     'easeInOut'
 *   )
 *   return positionAnim
 * })
 * ```
 */
export * from './index';
