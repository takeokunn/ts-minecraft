import { Brand, Data } from 'effect'

/**
 * Field of View（視野角）のBrand型
 */
export type FOV = Brand.Brand<number, 'FOV'> & {
  readonly min: 30
  readonly max: 120
}

/**
 * マウス感度のBrand型
 */
export type Sensitivity = Brand.Brand<number, 'Sensitivity'> & {
  readonly min: 0.1
  readonly max: 5.0
}

/**
 * スムージング係数のBrand型
 */
export type Smoothing = Brand.Brand<number, 'Smoothing'> & {
  readonly min: 0
  readonly max: 1
}

/**
 * アスペクト比のBrand型
 */
export type AspectRatio = Brand.Brand<number, 'AspectRatio'> & {
  readonly min: 0.1
  readonly max: 10.0
}

/**
 * Near平面距離のBrand型
 */
export type NearPlane = Brand.Brand<number, 'NearPlane'> & {
  readonly min: 0.01
  readonly max: 10.0
}

/**
 * Far平面距離のBrand型
 */
export type FarPlane = Brand.Brand<number, 'FarPlane'> & {
  readonly min: 100
  readonly max: 10000
}

/**
 * フレームレートのBrand型
 */
export type FrameRate = Brand.Brand<number, 'FrameRate'> & {
  readonly min: 30
  readonly max: 240
}

/**
 * レンダリング距離のBrand型
 */
export type RenderDistance = Brand.Brand<number, 'RenderDistance'> & {
  readonly min: 2
  readonly max: 32
}

/**
 * 品質レベルのBrand型
 */
export type QualityLevel = Brand.Brand<number, 'QualityLevel'> & {
  readonly min: 1
  readonly max: 5
}

/**
 * カメラ制限設定のBrand型
 */
export type CameraLimits = Brand.Brand<
  {
    readonly maxPitch: number
    readonly minPitch: number
    readonly maxDistance: number
    readonly minDistance: number
    readonly maxFOV: FOV
    readonly minFOV: FOV
  },
  'CameraLimits'
>

/**
 * カメラ設定の複合Brand型
 */
export type CameraSettings = Brand.Brand<
  {
    readonly fov: FOV
    readonly sensitivity: Sensitivity
    readonly smoothing: Smoothing
    readonly aspectRatio: AspectRatio
    readonly nearPlane: NearPlane
    readonly farPlane: FarPlane
    readonly frameRate: FrameRate
    readonly renderDistance: RenderDistance
    readonly qualityLevel: QualityLevel
  },
  'CameraSettings'
>

/**
 * 表示設定のBrand型
 */
export type DisplaySettings = Brand.Brand<
  {
    readonly brightness: number
    readonly contrast: number
    readonly saturation: number
    readonly gamma: number
    readonly antiAliasing: boolean
    readonly vsync: boolean
    readonly fullscreen: boolean
  },
  'DisplaySettings'
>

/**
 * パフォーマンス設定のBrand型
 */
export type PerformanceSettings = Brand.Brand<
  {
    readonly targetFPS: FrameRate
    readonly adaptiveQuality: boolean
    readonly dynamicLOD: boolean
    readonly frustumCulling: boolean
    readonly occlusionCulling: boolean
  },
  'PerformanceSettings'
>

/**
 * 設定関連のエラーADT
 */
export type SettingsError = Data.TaggedEnum<{
  InvalidFOV: { readonly value: number; readonly min: number; readonly max: number }
  InvalidSensitivity: { readonly value: number; readonly min: number; readonly max: number }
  InvalidSmoothing: { readonly value: number; readonly min: number; readonly max: number }
  InvalidAspectRatio: { readonly value: number; readonly reason: string }
  InvalidPlaneDistance: { readonly type: 'near' | 'far'; readonly value: number; readonly constraints: string }
  InvalidFrameRate: { readonly value: number; readonly min: number; readonly max: number }
  InvalidRenderDistance: { readonly value: number; readonly min: number; readonly max: number }
  InvalidQualityLevel: { readonly value: number; readonly available: readonly number[] }
  LimitsValidationFailed: { readonly field: string; readonly reason: string }
  SettingsConflict: { readonly setting1: string; readonly setting2: string; readonly reason: string }
  InvalidDisplayValue: { readonly field: string; readonly value: unknown; readonly expected: string }
}>

/**
 * SettingsError コンストラクタ
 */
export const SettingsError = Data.taggedEnum<SettingsError>()

/**
 * 品質プリセットの列挙型
 */
export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom'

/**
 * レンダリングモードの列挙型
 */
export type RenderingMode = 'forward' | 'deferred' | 'hybrid'

/**
 * アンチエイリアシング設定の列挙型
 */
export type AntiAliasingMode = 'none' | 'fxaa' | 'msaa_2x' | 'msaa_4x' | 'msaa_8x' | 'taa'
