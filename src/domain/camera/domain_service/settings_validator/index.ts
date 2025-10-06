/**
 * Settings Validator Domain Service
 *
 * 設定検証ドメインサービスのバレルエクスポート。
 * サービス定義、Live実装、型定義を統合的に提供します。
 */

// Service Interface & Context Tag
export { CompatibilityResult, SettingsValidationError, SettingsValidatorService } from './index'
export type {
  AccessibilityRequirements,
  AnimationValidationResult,
  CPUCapabilities,
  ComfortSettings,
  CompatibilityIssue,
  DisplayCapabilities,
  GPUCapabilities,
  HardwareLimits,
  InputType,
  OptimizedSettingsRecommendation,
  PerformanceLimits,
  PerformanceTarget,
  Platform,
  PlatformLimits,
  RequiredChange,
  SettingsConflict,
  SettingsConstraints,
  SettingsValidatorService as SettingsValidatorServiceInterface,
  ThermalThresholds,
  UserPreferences,
  ValidatedAnimationSettings,
  ValidatedCameraSettings,
  ValidatedRenderingSettings,
  ValidatedSensitivitySettings,
  ValidatedViewModeSettings,
  ValidationContext,
  ValidationWarning,
  ViewModeType,
  ViewModeValidationResult,
  WarningType,
} from './index'

// Live Implementation
export { SettingsValidatorServiceLive } from './index'

/**
 * 統合エクスポート - 便利な再エクスポート
 */

// よく使用される型の再エクスポート
export type { SettingsValidatorService as SettingsValidator } from './index'

// サービスタグの別名エクスポート
export { SettingsValidatorService as SettingsValidatorTag } from './index'

/**
 * 使用例:
 *
 * ```typescript
 * import { Effect } from 'effect'
 * import { SettingsValidatorService } from '@minecraft/domain/camera/domain_service/settings_validator'
 *
 * const program = Effect.gen(function* () {
 *   const validator = yield* SettingsValidatorService
 *   const validated = yield* validator.validateCameraSettings(cameraSettings)
 *   return validated
 * })
 * ```
 */
export * from './index';
