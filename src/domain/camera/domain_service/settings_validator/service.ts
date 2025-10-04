/**
 * Settings Validator Domain Service
 *
 * カメラ設定検証に関する純粋なドメインロジックを提供するサービス。
 * 設定値の妥当性検証、相互依存の確認、制約の適用、
 * 互換性チェック等の設定検証ロジックを集約しています。
 */

import { Context, Data, Effect } from 'effect'
import type {
  AnimationSettings,
  AspectRatio,
  CameraSettings,
  FarPlane,
  FOV,
  FrameRate,
  NearPlane,
  QualityLevel,
  Sensitivity,
  ViewModeSettings,
} from '../../value_object'

/**
 * 設定検証ドメインサービスの型定義
 */
export interface SettingsValidatorService {
  /**
   * カメラ設定の検証
   * 全体的な設定の妥当性とビジネスルールを検証
   */
  readonly validateCameraSettings: (
    settings: CameraSettings
  ) => Effect.Effect<ValidatedCameraSettings, SettingsValidationError>

  /**
   * ビューモード設定の検証
   * 各ビューモード固有の設定制約を検証
   */
  readonly validateViewModeSettings: (
    viewMode: ViewModeType,
    settings: ViewModeSettings
  ) => Effect.Effect<ValidatedViewModeSettings, SettingsValidationError>

  /**
   * アニメーション設定の検証
   * アニメーション関連の設定値を検証
   */
  readonly validateAnimationSettings: (
    settings: AnimationSettings
  ) => Effect.Effect<ValidatedAnimationSettings, SettingsValidationError>

  /**
   * 設定の相互互換性チェック
   * 複数の設定間の依存関係と整合性を確認
   */
  readonly checkSettingsCompatibility: (
    cameraSettings: CameraSettings,
    viewModeSettings: ViewModeSettings,
    animationSettings?: AnimationSettings
  ) => Effect.Effect<CompatibilityResult, SettingsValidationError>

  /**
   * 設定制約の適用
   * ハードウェア制限やパフォーマンス制約を適用
   */
  readonly applySettingsConstraints: (
    settings: CameraSettings,
    constraints: SettingsConstraints
  ) => Effect.Effect<CameraSettings, SettingsValidationError>

  /**
   * FOV値の検証
   * 視野角の有効範囲と他設定との整合性を確認
   */
  readonly validateFOV: (
    fov: FOV,
    aspectRatio: AspectRatio,
    context: ValidationContext
  ) => Effect.Effect<FOV, SettingsValidationError>

  /**
   * フレームレート制約の検証
   * ハードウェア能力とパフォーマンス要件を考慮
   */
  readonly validateFrameRateConstraints: (
    targetFrameRate: FrameRate,
    qualityLevel: QualityLevel,
    hardwareLimits: HardwareLimits
  ) => Effect.Effect<FrameRate, SettingsValidationError>

  /**
   * レンダリング設定の妥当性確認
   * Near/Far plane、レンダリング距離等の検証
   */
  readonly validateRenderingSettings: (
    nearPlane: NearPlane,
    farPlane: FarPlane,
    renderDistance: number,
    qualityLevel: QualityLevel
  ) => Effect.Effect<ValidatedRenderingSettings, SettingsValidationError>

  /**
   * 感度設定の検証
   * マウス感度とコントローラー感度の妥当性確認
   */
  readonly validateSensitivitySettings: (
    mouseSensitivity: Sensitivity,
    controllerSensitivity: Sensitivity,
    inputType: InputType
  ) => Effect.Effect<ValidatedSensitivitySettings, SettingsValidationError>

  /**
   * パフォーマンス最適化設定の提案
   * 現在の設定から最適化された設定を提案
   */
  readonly suggestOptimizedSettings: (
    currentSettings: CameraSettings,
    performanceTarget: PerformanceTarget,
    hardwareLimits: HardwareLimits
  ) => Effect.Effect<OptimizedSettingsRecommendation, SettingsValidationError>
}

/**
 * 検証済みカメラ設定
 */
export interface ValidatedCameraSettings {
  readonly _tag: 'ValidatedCameraSettings'
  readonly settings: CameraSettings
  readonly validationTimestamp: number
  readonly appliedConstraints: readonly string[]
  readonly warnings: readonly ValidationWarning[]
}

/**
 * 検証済みビューモード設定
 */
export interface ValidatedViewModeSettings {
  readonly _tag: 'ValidatedViewModeSettings'
  readonly viewMode: ViewModeType
  readonly settings: ViewModeSettings
  readonly validationResult: ViewModeValidationResult
}

/**
 * 検証済みアニメーション設定
 */
export interface ValidatedAnimationSettings {
  readonly _tag: 'ValidatedAnimationSettings'
  readonly settings: AnimationSettings
  readonly validationResult: AnimationValidationResult
}

/**
 * 互換性チェック結果
 */
export type CompatibilityResult = Data.TaggedEnum<{
  Compatible: {
    readonly confidence: number // 0.0-1.0
    readonly notes: readonly string[]
  }
  PartiallyCompatible: {
    readonly issues: readonly CompatibilityIssue[]
    readonly suggestions: readonly string[]
  }
  Incompatible: {
    readonly conflicts: readonly SettingsConflict[]
    readonly requiredChanges: readonly RequiredChange[]
  }
}>

/**
 * 設定制約
 */
export interface SettingsConstraints {
  readonly hardwareLimits: HardwareLimits
  readonly performanceLimits: PerformanceLimits
  readonly platformLimits: PlatformLimits
  readonly accessibilityRequirements?: AccessibilityRequirements
}

/**
 * ハードウェア制限
 */
export interface HardwareLimits {
  readonly maxFrameRate: FrameRate
  readonly maxRenderDistance: number
  readonly maxTextureQuality: QualityLevel
  readonly availableMemory: number // MB
  readonly gpuCapabilities: GPUCapabilities
  readonly cpuCapabilities: CPUCapabilities
}

/**
 * パフォーマンス制限
 */
export interface PerformanceLimits {
  readonly targetFrameRate: FrameRate
  readonly maxInputLatency: number // ms
  readonly thermalThresholds: ThermalThresholds
  readonly powerConsumptionLimit?: number // watts
}

/**
 * プラットフォーム制限
 */
export interface PlatformLimits {
  readonly platform: Platform
  readonly maxWindowSize: readonly [number, number]
  readonly supportedInputMethods: readonly InputType[]
  readonly displayCapabilities: DisplayCapabilities
}

/**
 * ビューモード種別
 */
export type ViewModeType = 'firstPerson' | 'thirdPerson' | 'spectator' | 'cinematic'

/**
 * 入力タイプ
 */
export type InputType = 'mouse' | 'controller' | 'touch' | 'mixed'

/**
 * プラットフォーム
 */
export type Platform = 'desktop' | 'mobile' | 'console' | 'web' | 'vr' | 'ar'

/**
 * パフォーマンスターゲット
 */
export type PerformanceTarget = 'quality' | 'balanced' | 'performance' | 'batteryLife'

/**
 * 検証コンテキスト
 */
export interface ValidationContext {
  readonly platform: Platform
  readonly inputType: InputType
  readonly userPreferences: UserPreferences
  readonly accessibilityNeeds?: AccessibilityRequirements
}

/**
 * ユーザー設定
 */
export interface UserPreferences {
  readonly preferredFrameRate: FrameRate
  readonly qualityPreference: QualityLevel
  readonly comfortSettings: ComfortSettings
  readonly expertMode: boolean
}

/**
 * 快適性設定
 */
export interface ComfortSettings {
  readonly motionSickness: 'low' | 'medium' | 'high'
  readonly fovPreference: 'narrow' | 'normal' | 'wide'
  readonly animationSpeed: 'slow' | 'normal' | 'fast'
}

/**
 * アクセシビリティ要件
 */
export interface AccessibilityRequirements {
  readonly reduceMotion: boolean
  readonly highContrast: boolean
  readonly largeText: boolean
  readonly colorBlindSupport: boolean
}

/**
 * GPU機能
 */
export interface GPUCapabilities {
  readonly vendor: string
  readonly model: string
  readonly memoryMB: number
  readonly computeUnits: number
  readonly shaderModel: string
  readonly supportedFeatures: readonly string[]
}

/**
 * CPU機能
 */
export interface CPUCapabilities {
  readonly cores: number
  readonly threads: number
  readonly frequencyGHz: number
  readonly architecture: string
  readonly instructionSets: readonly string[]
}

/**
 * 温度制限
 */
export interface ThermalThresholds {
  readonly warningTemp: number
  readonly throttleTemp: number
  readonly shutdownTemp: number
}

/**
 * ディスプレイ機能
 */
export interface DisplayCapabilities {
  readonly maxResolution: readonly [number, number]
  readonly refreshRates: readonly number[]
  readonly colorDepth: number
  readonly hdr: boolean
  readonly variableRefreshRate: boolean
}

/**
 * 設定検証エラー
 */
export type SettingsValidationError = Data.TaggedEnum<{
  InvalidFOV: { readonly value: number; readonly min: number; readonly max: number }
  InvalidFrameRate: { readonly value: number; readonly hardwareLimit: number }
  IncompatibleSettings: { readonly conflicts: readonly SettingsConflict[] }
  HardwareLimitExceeded: { readonly setting: string; readonly limit: number; readonly requested: number }
  PlatformNotSupported: { readonly feature: string; readonly platform: Platform }
  ValidationTimeout: { readonly timeoutMs: number }
}>

/**
 * 検証警告
 */
export interface ValidationWarning {
  readonly type: WarningType
  readonly message: string
  readonly severity: 'low' | 'medium' | 'high'
  readonly affectedSetting: string
  readonly recommendation?: string
}

/**
 * 警告タイプ
 */
export type WarningType = 'performance' | 'compatibility' | 'accessibility' | 'battery' | 'thermal' | 'user_experience'

/**
 * 互換性問題
 */
export interface CompatibilityIssue {
  readonly setting1: string
  readonly setting2: string
  readonly issueType: 'conflict' | 'suboptimal' | 'warning'
  readonly description: string
  readonly impact: 'low' | 'medium' | 'high'
}

/**
 * 設定競合
 */
export interface SettingsConflict {
  readonly conflictingSettings: readonly string[]
  readonly reason: string
  readonly resolution: string
}

/**
 * 必要な変更
 */
export interface RequiredChange {
  readonly setting: string
  readonly currentValue: unknown
  readonly requiredValue: unknown
  readonly reason: string
}

/**
 * ビューモード検証結果
 */
export interface ViewModeValidationResult {
  readonly isValid: boolean
  readonly issues: readonly string[]
  readonly optimizations: readonly string[]
}

/**
 * アニメーション検証結果
 */
export interface AnimationValidationResult {
  readonly isValid: boolean
  readonly performanceImpact: 'low' | 'medium' | 'high'
  readonly recommendations: readonly string[]
}

/**
 * 検証済みレンダリング設定
 */
export interface ValidatedRenderingSettings {
  readonly nearPlane: NearPlane
  readonly farPlane: FarPlane
  readonly renderDistance: number
  readonly qualityLevel: QualityLevel
  readonly adjustments: readonly string[]
}

/**
 * 検証済み感度設定
 */
export interface ValidatedSensitivitySettings {
  readonly mouseSensitivity: Sensitivity
  readonly controllerSensitivity: Sensitivity
  readonly calibrationRecommendations: readonly string[]
}

/**
 * 最適化設定推奨
 */
export interface OptimizedSettingsRecommendation {
  readonly optimizedSettings: CameraSettings
  readonly expectedPerformanceGain: number // percentage
  readonly tradeOffs: readonly string[]
  readonly confidenceScore: number // 0.0-1.0
}

/**
 * Settings Validator Service Context Tag
 * Effect-TSのDIコンテナで使用するサービスタグ
 */
export const SettingsValidatorService = Context.GenericTag<SettingsValidatorService>(
  '@minecraft/domain/camera/SettingsValidatorService'
)

/**
 * Helper constructors for ADTs
 */
export const CompatibilityResult = Data.taggedEnum<CompatibilityResult>()
export const SettingsValidationError = Data.taggedEnum<SettingsValidationError>()
