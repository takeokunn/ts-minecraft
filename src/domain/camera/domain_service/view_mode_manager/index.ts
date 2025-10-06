/**
 * View Mode Manager Domain Service
 *
 * ビューモード管理ドメインサービスのバレルエクスポート。
 * サービス定義、Live実装、型定義を統合的に提供します。
 */

// Service Interface & Context Tag
export { TransitionExecutionResult, TransitionStep, ViewModeManagerService } from './index'
export type {
  CameraKeyframe,
  CameraPath,
  CinematicEffect,
  CinematicSettings,
  EnvironmentState,
  GameMode,
  GameState,
  InputState,
  PathInterpolationType,
  PlayerState,
  TransitionType,
  ViewModeAlternative,
  ViewModeConstraintResult,
  ViewModeContext,
  ViewModeHistoryEntry,
  ViewModeManagerService as ViewModeManagerServiceInterface,
  ViewModePermissions,
  ViewModePreferences,
  ViewModeSuggestion,
  ViewModeTransition,
  ViewModeTransitionSettings,
  ViewModeType,
} from './index'

// Live Implementation
export { ViewModeManagerServiceLive } from './index'

/**
 * 統合エクスポート - 便利な再エクスポート
 */

// よく使用される型の再エクスポート
export type { ViewModeManagerService as ViewModeManager } from './index'

// サービスタグの別名エクスポート
export { ViewModeManagerService as ViewModeManagerTag } from './index'

/**
 * 使用例:
 *
 * ```typescript
 * import { Effect } from 'effect'
 * import { ViewModeManagerService } from '@minecraft/domain/camera/domain_service/view_mode_manager'
 *
 * const program = Effect.gen(function* () {
 *   const viewModeManager = yield* ViewModeManagerService
 *   const canSwitch = yield* viewModeManager.canSwitchToMode(
 *     currentMode,
 *     targetMode,
 *     context
 *   )
 *   return canSwitch
 * })
 * ```
 */
export * from './index';
