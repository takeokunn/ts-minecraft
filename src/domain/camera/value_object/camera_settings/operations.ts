import { Brand, Effect, Match, pipe, Schema } from 'effect'
import {
  AspectRatio,
  AspectRatioSchema,
  CameraLimits,
  CameraLimitsSchema,
  CameraSettings,
  CameraSettingsSchema,
  FarPlane,
  FarPlaneSchema,
  FOV,
  FOVSchema,
  FrameRate,
  FrameRateSchema,
  NearPlane,
  NearPlaneSchema,
  QualityLevel,
  QualityLevelSchema,
  QualityPreset,
  RenderDistance,
  RenderDistanceSchema,
  Sensitivity,
  SensitivitySchema,
  SettingsConstraints,
  SettingsError,
  Smoothing,
  SmoothingSchema,
} from './index'

/**
 * 基本設定値のファクトリー関数群
 */
export const SettingsFactory = {
  /**
   * FOV作成
   */
  createFOV: (value: number): Effect.Effect<FOV, SettingsError> =>
    pipe(
      Schema.decodeUnknown(FOVSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidFOV({
          value,
          min: 30,
          max: 120,
        })
      )
    ),

  /**
   * Sensitivity作成
   */
  createSensitivity: (value: number): Effect.Effect<Sensitivity, SettingsError> =>
    pipe(
      Schema.decodeUnknown(SensitivitySchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidSensitivity({
          value,
          min: 0.1,
          max: 5.0,
        })
      )
    ),

  /**
   * Smoothing作成
   */
  createSmoothing: (value: number): Effect.Effect<Smoothing, SettingsError> =>
    pipe(
      Schema.decodeUnknown(SmoothingSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidSmoothing({
          value,
          min: 0,
          max: 1,
        })
      )
    ),

  /**
   * AspectRatio作成
   */
  createAspectRatio: (value: number): Effect.Effect<AspectRatio, SettingsError> =>
    pipe(
      Schema.decodeUnknown(AspectRatioSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidAspectRatio({
          value,
          reason: 'Aspect ratio must be between 0.1 and 10.0',
        })
      )
    ),

  /**
   * NearPlane作成
   */
  createNearPlane: (value: number): Effect.Effect<NearPlane, SettingsError> =>
    pipe(
      Schema.decodeUnknown(NearPlaneSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidPlaneDistance({
          type: 'near',
          value,
          constraints: 'between 0.01 and 10.0',
        })
      )
    ),

  /**
   * FarPlane作成
   */
  createFarPlane: (value: number): Effect.Effect<FarPlane, SettingsError> =>
    pipe(
      Schema.decodeUnknown(FarPlaneSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidPlaneDistance({
          type: 'far',
          value,
          constraints: 'between 100 and 10000',
        })
      )
    ),

  /**
   * FrameRate作成
   */
  createFrameRate: (value: number): Effect.Effect<FrameRate, SettingsError> =>
    pipe(
      Schema.decodeUnknown(FrameRateSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidFrameRate({
          value,
          min: 30,
          max: 240,
        })
      )
    ),

  /**
   * RenderDistance作成
   */
  createRenderDistance: (value: number): Effect.Effect<RenderDistance, SettingsError> =>
    pipe(
      Schema.decodeUnknown(RenderDistanceSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidRenderDistance({
          value,
          min: 2,
          max: 32,
        })
      )
    ),

  /**
   * QualityLevel作成
   */
  createQualityLevel: (value: number): Effect.Effect<QualityLevel, SettingsError> =>
    pipe(
      Schema.decodeUnknown(QualityLevelSchema)(value),
      Effect.mapError(() =>
        SettingsError.InvalidQualityLevel({
          value,
          available: [1, 2, 3, 4, 5],
        })
      )
    ),
}

/**
 * CameraSettings作成関数
 */
export const createCameraSettings = (
  fov: number,
  sensitivity: number,
  smoothing: number,
  aspectRatio: number,
  nearPlane: number,
  farPlane: number,
  frameRate: number,
  renderDistance: number,
  qualityLevel: number
): Effect.Effect<CameraSettings, SettingsError> =>
  Effect.gen(function* () {
    const validatedFov = yield* SettingsFactory.createFOV(fov)
    const validatedSensitivity = yield* SettingsFactory.createSensitivity(sensitivity)
    const validatedSmoothing = yield* SettingsFactory.createSmoothing(smoothing)
    const validatedAspectRatio = yield* SettingsFactory.createAspectRatio(aspectRatio)
    const validatedNearPlane = yield* SettingsFactory.createNearPlane(nearPlane)
    const validatedFarPlane = yield* SettingsFactory.createFarPlane(farPlane)
    const validatedFrameRate = yield* SettingsFactory.createFrameRate(frameRate)
    const validatedRenderDistance = yield* SettingsFactory.createRenderDistance(renderDistance)
    const validatedQualityLevel = yield* SettingsFactory.createQualityLevel(qualityLevel)

    yield* pipe(
      Match.value(validatedNearPlane < validatedFarPlane),
      Match.when(
        (isValid) => isValid,
        () => Effect.void
      ),
      Match.orElse(() =>
        Effect.fail(
          SettingsError.SettingsConflict({
            setting1: 'nearPlane',
            setting2: 'farPlane',
            reason: 'Near plane must be less than far plane',
          })
        )
      )
    )

    return Brand.nominal<CameraSettings>()({
      fov: validatedFov,
      sensitivity: validatedSensitivity,
      smoothing: validatedSmoothing,
      aspectRatio: validatedAspectRatio,
      nearPlane: validatedNearPlane,
      farPlane: validatedFarPlane,
      frameRate: validatedFrameRate,
      renderDistance: validatedRenderDistance,
      qualityLevel: validatedQualityLevel,
    })
  })

/**
 * CameraLimits作成関数
 */
export const createCameraLimits = (
  maxPitch: number,
  minPitch: number,
  maxDistance: number,
  minDistance: number,
  maxFOV: number,
  minFOV: number
): Effect.Effect<CameraLimits, SettingsError> =>
  Effect.gen(function* () {
    const validatedMaxFOV = yield* SettingsFactory.createFOV(maxFOV)
    const validatedMinFOV = yield* SettingsFactory.createFOV(minFOV)

    const limits = {
      maxPitch,
      minPitch,
      maxDistance,
      minDistance,
      maxFOV: validatedMaxFOV,
      minFOV: validatedMinFOV,
    }

    yield* pipe(
      Schema.decodeUnknown(CameraLimitsSchema)(limits),
      Effect.mapError(() =>
        SettingsError.LimitsValidationFailed({
          field: 'cameraLimits',
          reason: 'Invalid limits configuration',
        })
      )
    )

    return Brand.nominal<CameraLimits>()(limits)
  })

/**
 * CameraSettings 操作関数群
 */
export const CameraSettingsOps = {
  /**
   * デフォルト設定取得
   */
  getDefault: (): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      fov: Brand.nominal<FOV>()(SettingsConstraints.fov.default),
      sensitivity: Brand.nominal<Sensitivity>()(SettingsConstraints.sensitivity.default),
      smoothing: Brand.nominal<Smoothing>()(0.15),
      aspectRatio: Brand.nominal<AspectRatio>()(SettingsConstraints.aspectRatio.widescreen),
      nearPlane: Brand.nominal<NearPlane>()(0.1),
      farPlane: Brand.nominal<FarPlane>()(1000),
      frameRate: Brand.nominal<FrameRate>()(SettingsConstraints.frameRate.default),
      renderDistance: Brand.nominal<RenderDistance>()(SettingsConstraints.renderDistance.default),
      qualityLevel: Brand.nominal<QualityLevel>()(3),
    }),

  /**
   * ゲーミング用設定取得
   */
  getGaming: (): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      fov: Brand.nominal<FOV>()(SettingsConstraints.fov.gaming),
      sensitivity: Brand.nominal<Sensitivity>()(SettingsConstraints.sensitivity.highSensitivity),
      smoothing: Brand.nominal<Smoothing>()(0.05), // 低いスムージング
      aspectRatio: Brand.nominal<AspectRatio>()(SettingsConstraints.aspectRatio.widescreen),
      nearPlane: Brand.nominal<NearPlane>()(0.1),
      farPlane: Brand.nominal<FarPlane>()(500), // パフォーマンス重視
      frameRate: Brand.nominal<FrameRate>()(120),
      renderDistance: Brand.nominal<RenderDistance>()(SettingsConstraints.renderDistance.performance),
      qualityLevel: Brand.nominal<QualityLevel>()(2), // パフォーマンス重視
    }),

  /**
   * 映像品質重視設定取得
   */
  getCinematic: (): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      fov: Brand.nominal<FOV>()(SettingsConstraints.fov.cinematic),
      sensitivity: Brand.nominal<Sensitivity>()(SettingsConstraints.sensitivity.lowSensitivity),
      smoothing: Brand.nominal<Smoothing>()(0.3), // 高いスムージング
      aspectRatio: Brand.nominal<AspectRatio>()(SettingsConstraints.aspectRatio.widescreen),
      nearPlane: Brand.nominal<NearPlane>()(0.1),
      farPlane: Brand.nominal<FarPlane>()(2000), // 遠くまで見える
      frameRate: Brand.nominal<FrameRate>()(60),
      renderDistance: Brand.nominal<RenderDistance>()(SettingsConstraints.renderDistance.quality),
      qualityLevel: Brand.nominal<QualityLevel>()(5), // 最高品質
    }),

  /**
   * 設定の妥当性チェック
   */
  validate: (settings: CameraSettings): Effect.Effect<CameraSettings, SettingsError> =>
    pipe(
      Schema.decodeUnknown(CameraSettingsSchema)(settings),
      Effect.mapError(() =>
        SettingsError.LimitsValidationFailed({
          field: 'cameraSettings',
          reason: 'Settings validation failed',
        })
      )
    ),

  /**
   * 設定の部分更新
   */
  updateFOV: (settings: CameraSettings, newFOV: FOV): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      ...settings,
      fov: newFOV,
    }),

  updateSensitivity: (settings: CameraSettings, newSensitivity: Sensitivity): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      ...settings,
      sensitivity: newSensitivity,
    }),

  updateSmoothing: (settings: CameraSettings, newSmoothing: Smoothing): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      ...settings,
      smoothing: newSmoothing,
    }),

  /**
   * パフォーマンス最適化
   */
  optimizeForPerformance: (settings: CameraSettings): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      ...settings,
      renderDistance: Brand.nominal<RenderDistance>()(SettingsConstraints.renderDistance.performance),
      qualityLevel: Brand.nominal<QualityLevel>()(2),
      farPlane: Brand.nominal<FarPlane>()(500),
    }),

  /**
   * 品質最適化
   */
  optimizeForQuality: (settings: CameraSettings): CameraSettings =>
    Brand.nominal<CameraSettings>()({
      ...settings,
      renderDistance: Brand.nominal<RenderDistance>()(SettingsConstraints.renderDistance.quality),
      qualityLevel: Brand.nominal<QualityLevel>()(5),
      farPlane: Brand.nominal<FarPlane>()(2000),
    }),
}

/**
 * 品質プリセット管理
 */
export const QualityPresets = {
  /**
   * プリセットから設定を取得
   */
  getSettingsFromPreset: (preset: QualityPreset): Effect.Effect<CameraSettings, SettingsError> =>
    pipe(
      preset,
      Match.value,
      Match.when('low', () =>
        Effect.succeed(
          Brand.nominal<CameraSettings>()({
            ...CameraSettingsOps.getDefault(),
            renderDistance: Brand.nominal<RenderDistance>()(2),
            qualityLevel: Brand.nominal<QualityLevel>()(1),
            frameRate: Brand.nominal<FrameRate>()(30),
          })
        )
      ),
      Match.when('medium', () => Effect.succeed(CameraSettingsOps.getDefault())),
      Match.when('high', () =>
        Effect.succeed(
          Brand.nominal<CameraSettings>()({
            ...CameraSettingsOps.getDefault(),
            renderDistance: Brand.nominal<RenderDistance>()(16),
            qualityLevel: Brand.nominal<QualityLevel>()(4),
            frameRate: Brand.nominal<FrameRate>()(60),
          })
        )
      ),
      Match.when('ultra', () => Effect.succeed(CameraSettingsOps.getCinematic())),
      Match.when('custom', () => Effect.succeed(CameraSettingsOps.getDefault())),
      Match.orElse(() =>
        Effect.fail(
          SettingsError.InvalidQualityLevel({
            value: 0,
            available: [1, 2, 3, 4, 5],
          })
        )
      )
    ),

  /**
   * 設定からプリセットを推定
   */
  detectPreset: (settings: CameraSettings): QualityPreset =>
    Match.value(settings).pipe(
      Match.when(
        (s) => s.qualityLevel <= 1 && s.renderDistance <= 4,
        () => 'low' as const
      ),
      Match.when(
        (s) => s.qualityLevel <= 3 && s.renderDistance <= 8,
        () => 'medium' as const
      ),
      Match.when(
        (s) => s.qualityLevel <= 4 && s.renderDistance <= 16,
        () => 'high' as const
      ),
      Match.when(
        (s) => s.qualityLevel >= 5 && s.renderDistance >= 16,
        () => 'ultra' as const
      ),
      Match.orElse(() => 'custom' as const)
    ),
}

/**
 * 設定の検証ヘルパー
 */
export const SettingsValidation = {
  /**
   * FOVの妥当性チェック
   */
  isValidFOV: (value: unknown): value is FOV => typeof value === 'number' && value >= 30 && value <= 120,

  /**
   * 感度の妥当性チェック
   */
  isValidSensitivity: (value: unknown): value is Sensitivity =>
    typeof value === 'number' && value >= 0.1 && value <= 5.0,

  /**
   * フレームレートの妥当性チェック
   */
  isValidFrameRate: (value: unknown): value is FrameRate =>
    typeof value === 'number' && Number.isInteger(value) && value >= 30 && value <= 240,

  /**
   * 設定間の互換性チェック
   */
  checkCompatibility: (settings: CameraSettings): Effect.Effect<void, SettingsError> =>
    pipe(
      Match.value(settings.nearPlane < settings.farPlane),
      Match.when(
        (isValid) => isValid,
        () => Effect.void
      ),
      Match.orElse(() =>
        Effect.fail(
          SettingsError.SettingsConflict({
            setting1: 'nearPlane',
            setting2: 'farPlane',
            reason: 'Near plane must be less than far plane',
          })
        )
      )
    ),
}
