import { Brand, Schema } from 'effect'
import {
  AspectRatio,
  CameraLimits,
  CameraSettings,
  DisplaySettings,
  FarPlane,
  FOV,
  FrameRate,
  NearPlane,
  PerformanceSettings,
  QualityLevel,
  RenderDistance,
  Sensitivity,
  Smoothing,
} from './index'

/**
 * FOV Brand型用Schema
 */
export const FOVSchema = Schema.Number.pipe(Schema.between(30, 120), Schema.fromBrand(Brand.nominal<FOV>()))

/**
 * Sensitivity Brand型用Schema
 */
export const SensitivitySchema = Schema.Number.pipe(
  Schema.between(0.1, 5.0),
  Schema.fromBrand(Brand.nominal<Sensitivity>())
)

/**
 * Smoothing Brand型用Schema
 */
export const SmoothingSchema = Schema.Number.pipe(Schema.between(0, 1), Schema.fromBrand(Brand.nominal<Smoothing>()))

/**
 * AspectRatio Brand型用Schema
 */
export const AspectRatioSchema = Schema.Number.pipe(
  Schema.between(0.1, 10.0),
  Schema.positive(),
  Schema.fromBrand(Brand.nominal<AspectRatio>())
)

/**
 * NearPlane Brand型用Schema
 */
export const NearPlaneSchema = Schema.Number.pipe(
  Schema.between(0.01, 10.0),
  Schema.fromBrand(Brand.nominal<NearPlane>())
)

/**
 * FarPlane Brand型用Schema
 */
export const FarPlaneSchema = Schema.Number.pipe(
  Schema.between(100, 10000),
  Schema.fromBrand(Brand.nominal<FarPlane>())
)

/**
 * FrameRate Brand型用Schema
 */
export const FrameRateSchema = Schema.Number.pipe(
  Schema.between(30, 240),
  Schema.int(),
  Schema.fromBrand(Brand.nominal<FrameRate>())
)

/**
 * RenderDistance Brand型用Schema
 */
export const RenderDistanceSchema = Schema.Number.pipe(
  Schema.between(2, 32),
  Schema.int(),
  Schema.fromBrand(Brand.nominal<RenderDistance>())
)

/**
 * QualityLevel Brand型用Schema
 */
export const QualityLevelSchema = Schema.Number.pipe(
  Schema.between(1, 5),
  Schema.int(),
  Schema.fromBrand(Brand.nominal<QualityLevel>())
)

/**
 * CameraLimits Brand型用Schema（制約チェック付き）
 */
export const CameraLimitsSchema = Schema.Struct({
  maxPitch: Schema.Number.pipe(Schema.between(-90, 90)),
  minPitch: Schema.Number.pipe(Schema.between(-90, 90)),
  maxDistance: Schema.Number.pipe(Schema.positive()),
  minDistance: Schema.Number.pipe(Schema.positive()),
  maxFOV: FOVSchema,
  minFOV: FOVSchema,
}).pipe(
  Schema.filter(
    (limits) => {
      return (
        limits.minPitch <= limits.maxPitch && limits.minDistance <= limits.maxDistance && limits.minFOV <= limits.maxFOV
      )
    },
    {
      message: () => 'Camera limits: min values must be less than or equal to max values',
    }
  ),
  Schema.fromBrand(Brand.nominal<CameraLimits>())
)

/**
 * CameraSettings Brand型用Schema（制約チェック付き）
 */
export const CameraSettingsSchema = Schema.Struct({
  fov: FOVSchema,
  sensitivity: SensitivitySchema,
  smoothing: SmoothingSchema,
  aspectRatio: AspectRatioSchema,
  nearPlane: NearPlaneSchema,
  farPlane: FarPlaneSchema,
  frameRate: FrameRateSchema,
  renderDistance: RenderDistanceSchema,
  qualityLevel: QualityLevelSchema,
}).pipe(
  Schema.filter(
    (settings) => {
      return settings.nearPlane < settings.farPlane
    },
    {
      message: () => 'Near plane distance must be less than far plane distance',
    }
  ),
  Schema.fromBrand(Brand.nominal<CameraSettings>())
)

/**
 * DisplaySettings Brand型用Schema
 */
export const DisplaySettingsSchema = Schema.Struct({
  brightness: Schema.Number.pipe(Schema.between(0, 2)),
  contrast: Schema.Number.pipe(Schema.between(0, 2)),
  saturation: Schema.Number.pipe(Schema.between(0, 2)),
  gamma: Schema.Number.pipe(Schema.between(0.5, 3.0)),
  antiAliasing: Schema.Boolean,
  vsync: Schema.Boolean,
  fullscreen: Schema.Boolean,
}).pipe(Schema.fromBrand(Brand.nominal<DisplaySettings>()))

/**
 * PerformanceSettings Brand型用Schema
 */
export const PerformanceSettingsSchema = Schema.Struct({
  targetFPS: FrameRateSchema,
  adaptiveQuality: Schema.Boolean,
  dynamicLOD: Schema.Boolean,
  frustumCulling: Schema.Boolean,
  occlusionCulling: Schema.Boolean,
}).pipe(Schema.fromBrand(Brand.nominal<PerformanceSettings>()))

/**
 * QualityPreset Schema
 */
export const QualityPresetSchema = Schema.Literal('low', 'medium', 'high', 'ultra', 'custom')

/**
 * RenderingMode Schema
 */
export const RenderingModeSchema = Schema.Literal('forward', 'deferred', 'hybrid')

/**
 * AntiAliasingMode Schema
 */
export const AntiAliasingModeSchema = Schema.Literal('none', 'fxaa', 'msaa_2x', 'msaa_4x', 'msaa_8x', 'taa')

/**
 * 設定値の制約定義
 */
export const SettingsConstraints = {
  // FOV制約
  fov: {
    min: 30,
    max: 120,
    default: 75,
    gaming: 90,
    cinematic: 60,
  },

  // 感度制約
  sensitivity: {
    min: 0.1,
    max: 5.0,
    default: 1.0,
    lowSensitivity: 0.5,
    highSensitivity: 2.0,
  },

  // フレームレート制約
  frameRate: {
    min: 30,
    max: 240,
    common: [30, 60, 120, 144, 240] as const,
    default: 60,
  },

  // レンダリング距離制約
  renderDistance: {
    min: 2,
    max: 32,
    default: 8,
    performance: 4,
    quality: 16,
    extreme: 32,
  },

  // アスペクト比の一般的な値
  aspectRatio: {
    traditional: 4 / 3,
    widescreen: 16 / 9,
    ultrawide: 21 / 9,
    square: 1 / 1,
  },
} as const

/**
 * 品質プリセット定義用のSchema
 */
export const QualityPresetDefinitionSchema = Schema.Struct({
  preset: QualityPresetSchema,
  settings: Schema.Struct({
    renderDistance: RenderDistanceSchema,
    qualityLevel: QualityLevelSchema,
    antiAliasing: AntiAliasingModeSchema,
    renderingMode: RenderingModeSchema,
    targetFPS: FrameRateSchema,
  }),
})
