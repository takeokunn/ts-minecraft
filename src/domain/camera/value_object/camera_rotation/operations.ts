import { Brand, Effect, Match, pipe, Schema } from 'effect'
import {
  CameraRotation,
  Degrees,
  DegreesSchema,
  MouseDelta,
  MouseDeltaSchema,
  MouseSensitivity,
  MouseSensitivitySchema,
  Pitch,
  PitchSchema,
  Quaternion,
  Radians,
  RadiansSchema,
  Roll,
  RollSchema,
  RotationError,
  RotationLerpFactor,
  RotationLimits,
  Yaw,
  YawSchema,
} from './index'

/**
 * 角度ファクトリー関数群
 */
export const AngleFactory = {
  /**
   * Pitch作成
   */
  createPitch: (degrees: number): Effect.Effect<Pitch, RotationError> =>
    pipe(
      Schema.decodeUnknown(PitchSchema)(degrees),
      Effect.mapError(() =>
        RotationError.InvalidAngle({
          axis: 'pitch',
          value: degrees,
          min: -90,
          max: 90,
        })
      )
    ),

  /**
   * Yaw作成
   */
  createYaw: (degrees: number): Effect.Effect<Yaw, RotationError> =>
    pipe(
      Schema.decodeUnknown(YawSchema)(degrees),
      Effect.mapError(() =>
        RotationError.InvalidAngle({
          axis: 'yaw',
          value: degrees,
          min: -180,
          max: 180,
        })
      )
    ),

  /**
   * Roll作成
   */
  createRoll: (degrees: number): Effect.Effect<Roll, RotationError> =>
    pipe(
      Schema.decodeUnknown(RollSchema)(degrees),
      Effect.mapError(() =>
        RotationError.InvalidAngle({
          axis: 'roll',
          value: degrees,
          min: -180,
          max: 180,
        })
      )
    ),

  /**
   * Radians作成
   */
  createRadians: (value: number): Effect.Effect<Radians, RotationError> =>
    pipe(
      Schema.decodeUnknown(RadiansSchema)(value),
      Effect.mapError(() =>
        RotationError.AngleNormalizationFailed({
          angle: value,
          reason: 'Invalid radian value',
        })
      )
    ),

  /**
   * Degrees作成
   */
  createDegrees: (value: number): Effect.Effect<Degrees, RotationError> =>
    pipe(
      Schema.decodeUnknown(DegreesSchema)(value),
      Effect.mapError(() =>
        RotationError.AngleNormalizationFailed({
          angle: value,
          reason: 'Invalid degree value',
        })
      )
    ),
}

/**
 * CameraRotation ファクトリー関数
 */
export const createCameraRotation = (
  pitch: number,
  yaw: number,
  roll: number = 0
): Effect.Effect<CameraRotation, RotationError> =>
  Effect.gen(function* () {
    const validatedPitch = yield* AngleFactory.createPitch(pitch)
    const validatedYaw = yield* AngleFactory.createYaw(yaw)
    const validatedRoll = yield* AngleFactory.createRoll(roll)

    return Brand.nominal<CameraRotation>()({
      pitch: validatedPitch,
      yaw: validatedYaw,
      roll: validatedRoll,
    })
  })

/**
 * MouseSensitivity ファクトリー関数
 */
export const createMouseSensitivity = (sensitivity: number): Effect.Effect<MouseSensitivity, RotationError> =>
  pipe(
    Schema.decodeUnknown(MouseSensitivitySchema)(sensitivity),
    Effect.mapError(() =>
      RotationError.InvalidSensitivity({
        sensitivity,
        min: 0.1,
        max: 5.0,
      })
    )
  )

/**
 * MouseDelta ファクトリー関数
 */
export const createMouseDelta = (deltaX: number, deltaY: number): Effect.Effect<MouseDelta, RotationError> =>
  pipe(
    Schema.decodeUnknown(MouseDeltaSchema)({ deltaX, deltaY }),
    Effect.mapError((parseError) =>
      RotationError.InvalidDelta({
        field: parseError.message.includes('deltaX') ? 'deltaX' : 'deltaY',
        value: parseError.message.includes('deltaX') ? deltaX : deltaY,
        expected: 'finite number',
      })
    )
  )

/**
 * 角度変換ユーティリティ
 */
export const AngleConversion = {
  /**
   * 度からラジアンに変換
   */
  degreesToRadians: (degrees: Degrees): Radians => Brand.nominal<Radians>()((degrees * Math.PI) / 180),

  /**
   * ラジアンから度に変換
   */
  radiansToDegrees: (radians: Radians): Degrees => Brand.nominal<Degrees>()((radians * 180) / Math.PI),

  /**
   * 角度の正規化（-180～180度）
   */
  normalizeDegrees: (degrees: number): Degrees => {
    const normalized = degrees % 360
    return Brand.nominal<Degrees>()(
      Match.value(normalized).pipe(
        Match.when(
          (n) => n > 180,
          (n) => n - 360
        ),
        Match.when(
          (n) => n < -180,
          (n) => n + 360
        ),
        Match.orElse((n) => n)
      )
    )
  },

  /**
   * ラジアンの正規化（-π～π）
   */
  normalizeRadians: (radians: number): Radians => {
    const normalized = radians % (2 * Math.PI)
    return Brand.nominal<Radians>()(
      Match.value(normalized).pipe(
        Match.when(
          (n) => n > Math.PI,
          (n) => n - 2 * Math.PI
        ),
        Match.when(
          (n) => n < -Math.PI,
          (n) => n + 2 * Math.PI
        ),
        Match.orElse((n) => n)
      )
    )
  },
}

/**
 * CameraRotation 操作関数群
 */
export const CameraRotationOps = {
  /**
   * 回転の正規化
   */
  normalize: (rotation: CameraRotation): CameraRotation =>
    Brand.nominal<CameraRotation>()({
      pitch: rotation.pitch, // ピッチは既に制限内
      yaw: AngleConversion.normalizeDegrees(rotation.yaw) as Yaw,
      roll: AngleConversion.normalizeDegrees(rotation.roll) as Roll,
    }),

  /**
   * マウス移動を回転に適用
   */
  applyMouseDelta: (
    rotation: CameraRotation,
    delta: MouseDelta,
    sensitivity: MouseSensitivity
  ): Effect.Effect<CameraRotation, RotationError> =>
    Effect.gen(function* () {
      const newYaw = rotation.yaw + delta.deltaX * sensitivity
      const newPitch = rotation.pitch + delta.deltaY * sensitivity

      const validatedPitch = yield* AngleFactory.createPitch(Math.max(-90, Math.min(90, newPitch)))
      const normalizedYaw = AngleConversion.normalizeDegrees(newYaw)

      return Brand.nominal<CameraRotation>()({
        pitch: validatedPitch,
        yaw: normalizedYaw as Yaw,
        roll: rotation.roll,
      })
    }),

  /**
   * 回転の線形補間
   */
  lerp: (from: CameraRotation, to: CameraRotation, factor: RotationLerpFactor): CameraRotation => {
    const t = factor as number

    // 最短経路での補間を考慮
    const yawDiff = to.yaw - from.yaw
    const adjustedYawDiff = yawDiff > 180 ? yawDiff - 360 : yawDiff < -180 ? yawDiff + 360 : yawDiff

    return Brand.nominal<CameraRotation>()({
      pitch: Brand.nominal<Pitch>()(from.pitch + (to.pitch - from.pitch) * t),
      yaw: AngleConversion.normalizeDegrees(from.yaw + adjustedYawDiff * t) as Yaw,
      roll: Brand.nominal<Roll>()(from.roll + (to.roll - from.roll) * t),
    })
  },

  /**
   * 回転制限の適用
   */
  applyLimits: (rotation: CameraRotation, limits: RotationLimits): Effect.Effect<CameraRotation, RotationError> =>
    Effect.gen(function* () {
      const clampedPitch = Math.max(limits.minPitch, Math.min(limits.maxPitch, rotation.pitch))
      const clampedYaw = Math.max(limits.minYaw, Math.min(limits.maxYaw, rotation.yaw))
      const clampedRoll = Math.max(limits.minRoll, Math.min(limits.maxRoll, rotation.roll))

      const validatedPitch = yield* AngleFactory.createPitch(clampedPitch)
      const validatedYaw = yield* AngleFactory.createYaw(clampedYaw)
      const validatedRoll = yield* AngleFactory.createRoll(clampedRoll)

      return Brand.nominal<CameraRotation>()({
        pitch: validatedPitch,
        yaw: validatedYaw,
        roll: validatedRoll,
      })
    }),

  /**
   * オイラー角からクォータニオンに変換
   */
  toQuaternion: (rotation: CameraRotation): Effect.Effect<Quaternion, RotationError> =>
    Effect.try({
      try: () => {
        const pitchRad = (rotation.pitch * Math.PI) / 180
        const yawRad = (rotation.yaw * Math.PI) / 180
        const rollRad = (rotation.roll * Math.PI) / 180

        const c1 = Math.cos(pitchRad / 2)
        const s1 = Math.sin(pitchRad / 2)
        const c2 = Math.cos(yawRad / 2)
        const s2 = Math.sin(yawRad / 2)
        const c3 = Math.cos(rollRad / 2)
        const s3 = Math.sin(rollRad / 2)

        return Brand.nominal<Quaternion>()({
          w: c1 * c2 * c3 - s1 * s2 * s3,
          x: s1 * c2 * c3 + c1 * s2 * s3,
          y: c1 * s2 * c3 - s1 * c2 * s3,
          z: c1 * c2 * s3 + s1 * s2 * c3,
        })
      },
      catch: (error) =>
        RotationError.RotationCalculationFailed({
          operation: 'quaternion conversion',
          reason: String(error),
        }),
    }),

  /**
   * 回転の差分計算
   */
  difference: (from: CameraRotation, to: CameraRotation): CameraRotation => {
    const pitchDiff = to.pitch - from.pitch
    const yawDiff = to.yaw - from.yaw
    const rollDiff = to.roll - from.roll

    // 最短経路での差分を計算
    const adjustedYawDiff = yawDiff > 180 ? yawDiff - 360 : yawDiff < -180 ? yawDiff + 360 : yawDiff

    return Brand.nominal<CameraRotation>()({
      pitch: Brand.nominal<Pitch>()(pitchDiff),
      yaw: Brand.nominal<Yaw>()(adjustedYawDiff),
      roll: Brand.nominal<Roll>()(rollDiff),
    })
  },

  /**
   * 回転の大きさ（マグニチュード）計算
   */
  magnitude: (rotation: CameraRotation): number =>
    Math.sqrt(rotation.pitch * rotation.pitch + rotation.yaw * rotation.yaw + rotation.roll * rotation.roll),
}

/**
 * デフォルト値と定数
 */
export const RotationConstants = {
  IDENTITY: Brand.nominal<CameraRotation>()({
    pitch: Brand.nominal<Pitch>()(0),
    yaw: Brand.nominal<Yaw>()(0),
    roll: Brand.nominal<Roll>()(0),
  }),

  DEFAULT_SENSITIVITY: Brand.nominal<MouseSensitivity>()(1.0),

  DEFAULT_LIMITS: Brand.nominal<RotationLimits>()({
    maxPitch: Brand.nominal<Pitch>()(90),
    minPitch: Brand.nominal<Pitch>()(-90),
    maxYaw: Brand.nominal<Yaw>()(180),
    minYaw: Brand.nominal<Yaw>()(-180),
    maxRoll: Brand.nominal<Roll>()(180),
    minRoll: Brand.nominal<Roll>()(-180),
  }),

  // Minecraft固有の制限
  MINECRAFT_PITCH_LIMIT: {
    MAX: 90,
    MIN: -90,
  },
} as const
