import { Brand, Schema } from 'effect'
import type {
  AngularVelocity,
  CameraRotation,
  Degrees,
  MouseDelta,
  MouseSensitivity,
  Pitch,
  Quaternion,
  Radians,
  Roll,
  RotationLerpFactor,
  RotationLimits,
  Yaw,
} from './types'

/**
 * Pitch Brand型用Schema（度単位）
 */
export const PitchSchema = Schema.Number.pipe(Schema.between(-90, 90), Schema.fromBrand(Brand.nominal<Pitch>()))

/**
 * Yaw Brand型用Schema（度単位）
 */
export const YawSchema = Schema.Number.pipe(Schema.between(-180, 180), Schema.fromBrand(Brand.nominal<Yaw>()))

/**
 * Roll Brand型用Schema（度単位）
 */
export const RollSchema = Schema.Number.pipe(Schema.between(-180, 180), Schema.fromBrand(Brand.nominal<Roll>()))

/**
 * Radians Brand型用Schema
 */
export const RadiansSchema = Schema.Number.pipe(Schema.finite(), Schema.fromBrand(Brand.nominal<Radians>()))

/**
 * Degrees Brand型用Schema
 */
export const DegreesSchema = Schema.Number.pipe(Schema.finite(), Schema.fromBrand(Brand.nominal<Degrees>()))

/**
 * CameraRotation Brand型用Schema
 */
export const CameraRotationSchema = Schema.Struct({
  pitch: PitchSchema,
  yaw: YawSchema,
  roll: RollSchema,
}).pipe(Schema.fromBrand(Brand.nominal<CameraRotation>()))

/**
 * MouseSensitivity Brand型用Schema
 */
export const MouseSensitivitySchema = Schema.Number.pipe(
  Schema.between(0.1, 5.0),
  Schema.fromBrand(Brand.nominal<MouseSensitivity>())
)

/**
 * MouseDelta Brand型用Schema
 */
export const MouseDeltaSchema = Schema.Struct({
  deltaX: Schema.Number.pipe(Schema.finite()),
  deltaY: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.fromBrand(Brand.nominal<MouseDelta>()))

/**
 * RotationLerpFactor Brand型用Schema
 */
export const RotationLerpFactorSchema = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.fromBrand(Brand.nominal<RotationLerpFactor>())
)

/**
 * AngularVelocity Brand型用Schema（度/秒）
 */
export const AngularVelocitySchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.finite()),
  yaw: Schema.Number.pipe(Schema.finite()),
  roll: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.fromBrand(Brand.nominal<AngularVelocity>()))

/**
 * RotationLimits Brand型用Schema
 */
export const RotationLimitsSchema = Schema.Struct({
  maxPitch: PitchSchema,
  minPitch: PitchSchema,
  maxYaw: YawSchema,
  minYaw: YawSchema,
  maxRoll: RollSchema,
  minRoll: RollSchema,
}).pipe(
  Schema.filter(
    (limits) => {
      return limits.minPitch <= limits.maxPitch && limits.minYaw <= limits.maxYaw && limits.minRoll <= limits.maxRoll
    },
    {
      message: () => 'Rotation limits: min values must be less than or equal to max values',
    }
  ),
  Schema.fromBrand(Brand.nominal<RotationLimits>())
)

/**
 * Quaternion Brand型用Schema（正規化チェック付き）
 */
export const QuaternionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
  w: Schema.Number.pipe(Schema.finite()),
}).pipe(
  Schema.filter(
    (q) => {
      const magnitude = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
      return Math.abs(magnitude - 1) < 0.0001 // 正規化チェック
    },
    {
      message: () => 'Quaternion must be normalized (magnitude = 1)',
    }
  ),
  Schema.fromBrand(Brand.nominal<Quaternion>())
)

/**
 * 角度変換用のSchema
 */
export const AngleConversionSchemas = {
  degreesToRadians: Schema.transform(DegreesSchema, RadiansSchema, {
    strict: false,
    decode: (degrees) => Brand.nominal<Radians>()((degrees * Math.PI) / 180),
    encode: (radians) => Brand.nominal<Degrees>()((radians * 180) / Math.PI),
  }),

  radiansToDegrees: Schema.transform(RadiansSchema, DegreesSchema, {
    strict: false,
    decode: (radians) => Brand.nominal<Degrees>()((radians * 180) / Math.PI),
    encode: (degrees) => Brand.nominal<Radians>()((degrees * Math.PI) / 180),
  }),
} as const

/**
 * 一般的な角度制約
 */
export const AngleConstraints = {
  fullRotation: Schema.Number.pipe(Schema.between(0, 360)), // 0-360度
  signedRotation: Schema.Number.pipe(Schema.between(-180, 180)), // -180~180度
  pitch: Schema.Number.pipe(Schema.between(-90, 90)), // ピッチ制限
  normalizedAngle: Schema.Number.pipe(Schema.between(-Math.PI, Math.PI)), // ラジアン正規化
} as const
