import { Data, Option, Schema } from 'effect'

// ========================================
// Camera Domain Core Errors (Data.taggedEnum)
// ========================================

/**
 * カメラドメインのコアエラー型（Data.taggedEnum ADT）
 */
export class CameraError extends Schema.TaggedError<CameraError>()('CameraError', {
  _tag: Schema.Literal(
    'InitializationFailed',
    'CameraNotInitialized',
    'InvalidConfiguration',
    'InvalidMode',
    'InvalidParameter',
    'ResourceError',
    'AnimationError',
    'CollisionError'
  ),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  operation: Schema.optional(Schema.String),
  config: Schema.optional(Schema.Unknown),
  mode: Schema.optional(Schema.String),
  validModes: Schema.optional(Schema.Array(Schema.String)),
  parameter: Schema.optional(Schema.String),
  value: Schema.optional(Schema.Unknown),
  expected: Schema.optional(Schema.String),
  context: Schema.optional(Schema.Unknown),
  details: Schema.optional(Schema.Unknown),
}) {}

// Schema.TaggedError uses class instantiation pattern

// ========================================
// Value Object Errors (Schema.TaggedError)
// ========================================

/**
 * 位置関連エラー型
 */
export class PositionError extends Schema.TaggedError<PositionError>()('PositionError', {
  _tag: Schema.Literal('InvalidPosition', 'PositionOutOfBounds'),
  message: Schema.String,
  axis: Schema.optional(Schema.Literal('x', 'y', 'z')),
  value: Schema.optional(Schema.Number),
  reason: Schema.optional(Schema.String),
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  bounds: Schema.optional(
    Schema.Struct({
      min: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
      max: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    })
  ),
}) {}

/**
 * 回転関連エラー型
 */
export class RotationError extends Schema.TaggedError<RotationError>()('RotationError', {
  _tag: Schema.Literal('InvalidRotation', 'RotationLimitExceeded'),
  message: Schema.String,
  axis: Schema.optional(Schema.Literal('pitch', 'yaw', 'roll')),
  value: Schema.optional(Schema.Number),
  min: Schema.optional(Schema.Number),
  max: Schema.optional(Schema.Number),
  rotation: Schema.optional(
    Schema.Struct({
      pitch: Schema.Number,
      yaw: Schema.Number,
    })
  ),
  limits: Schema.optional(
    Schema.Struct({
      pitch: Schema.Struct({ min: Schema.Number, max: Schema.Number }),
      yaw: Schema.Struct({ min: Schema.Number, max: Schema.Number }),
    })
  ),
}) {}

/**
 * 設定関連エラー型
 */
export class SettingsError extends Schema.TaggedError<SettingsError>()('SettingsError', {
  _tag: Schema.Literal('InvalidFOV', 'InvalidSensitivity', 'InvalidDistance'),
  message: Schema.String,
  value: Schema.Number,
  min: Schema.Number,
  max: Schema.Number,
}) {}

// ========================================
// Error Union Types
// ========================================

/**
 * カメラドメインの全エラー統合型
 */
export type CameraDomainError = CameraError | PositionError | RotationError | SettingsError

// ========================================
// Error Factory Functions (ADT Constructors)
// ========================================

/**
 * カメラエラーファクトリー（Schema.TaggedError パターン）
 */
export const createCameraError = {
  initializationFailed: (message: string, cause?: unknown) =>
    new CameraError({
      _tag: 'InitializationFailed',
      message,
      cause,
    }),

  notInitialized: (operation: string) =>
    new CameraError({
      _tag: 'CameraNotInitialized',
      message: `Operation '${operation}' called before camera initialization`,
      operation,
    }),

  invalidConfiguration: (message: string, config?: unknown) =>
    new CameraError({
      _tag: 'InvalidConfiguration',
      message,
      config,
    }),

  invalidMode: (mode: string, validModes: readonly string[]) =>
    new CameraError({
      _tag: 'InvalidMode',
      message: `Invalid camera mode '${mode}'. Valid modes: ${validModes.join(', ')}`,
      mode,
      validModes,
    }),

  invalidParameter: (parameter: string, value: unknown, expected?: string) =>
    new CameraError({
      _tag: 'InvalidParameter',
      message: `Invalid parameter '${parameter}'${expected ? `: ${expected}` : ''}`,
      parameter,
      value,
      expected,
    }),

  resourceError: (message: string, cause?: unknown) =>
    new CameraError({
      _tag: 'ResourceError',
      message,
      cause,
    }),

  animationError: (message: string, context?: unknown) =>
    new CameraError({
      _tag: 'AnimationError',
      message,
      context,
    }),

  collisionError: (message: string, details?: unknown) =>
    new CameraError({
      _tag: 'CollisionError',
      message,
      details,
    }),
} as const

/**
 * 位置エラーファクトリー
 */
export const createPositionError = {
  invalidCoordinate: (axis: 'x' | 'y' | 'z', value: number, reason: string) =>
    new PositionError({
      _tag: 'InvalidPosition',
      message: `Invalid ${axis} coordinate: ${value} (${reason})`,
      axis,
      value,
      reason,
    }),

  outOfBounds: (
    position: { x: number; y: number; z: number },
    bounds: {
      min: { x: number; y: number; z: number }
      max: { x: number; y: number; z: number }
    }
  ) =>
    new PositionError({
      _tag: 'PositionOutOfBounds',
      message: `Position out of bounds: (${position.x}, ${position.y}, ${position.z})`,
      position,
      bounds,
    }),
} as const

/**
 * 回転エラーファクトリー
 */
export const createRotationError = {
  invalidAngle: (axis: 'pitch' | 'yaw' | 'roll', value: number, min: number, max: number) =>
    new RotationError({
      _tag: 'InvalidRotation',
      message: `Invalid ${axis} angle: ${value} (expected ${min} to ${max})`,
      axis,
      value,
      min,
      max,
    }),

  limitExceeded: (
    rotation: { pitch: number; yaw: number },
    limits: {
      pitch: { min: number; max: number }
      yaw: { min: number; max: number }
    }
  ) =>
    new RotationError({
      _tag: 'RotationLimitExceeded',
      message: `Rotation limit exceeded: pitch=${rotation.pitch}, yaw=${rotation.yaw}`,
      rotation,
      limits,
    }),
} as const

/**
 * 設定エラーファクトリー
 */
export const createSettingsError = {
  invalidFOV: (value: number, min: number, max: number) =>
    new SettingsError({
      _tag: 'InvalidFOV',
      message: `Invalid FOV: ${value} (expected ${min} to ${max})`,
      value,
      min,
      max,
    }),

  invalidSensitivity: (value: number, min: number, max: number) =>
    new SettingsError({
      _tag: 'InvalidSensitivity',
      message: `Invalid sensitivity: ${value} (expected ${min} to ${max})`,
      value,
      min,
      max,
    }),

  invalidDistance: (value: number, min: number, max: number) =>
    new SettingsError({
      _tag: 'InvalidDistance',
      message: `Invalid distance: ${value} (expected ${min} to ${max})`,
      value,
      min,
      max,
    }),
} as const

// ========================================
// Schema.TaggedError Pattern - No constructor exports needed
// ========================================
// Note: With Schema.TaggedError, errors are created using factory functions
// (createCameraError, createPositionError, etc.) instead of direct constructors
