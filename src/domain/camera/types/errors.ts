import { Data, Option } from 'effect'
import { toErrorCause, type ErrorCause } from '@shared/schema/error'
import { toJsonValue, toJsonValueOption, type JsonSerializable, type JsonValue } from '@shared/schema/json'

// ========================================
// Camera Domain Core Errors (Data.taggedEnum)
// ========================================

/**
 * カメラドメインのコアエラー型（Data.taggedEnum ADT）
 */
export const CameraError = Data.taggedEnum<{
  InitializationFailed: { message: string; cause: Option.Option<ErrorCause> }
  CameraNotInitialized: { operation: string; message: string }
  InvalidConfiguration: { message: string; config: Option.Option<JsonValue> }
  InvalidMode: { message: string; mode: string; validModes: readonly string[] }
  InvalidParameter: { message: string; parameter: string; value: JsonValue; expected: Option.Option<string> }
  ResourceError: { message: string; cause: Option.Option<ErrorCause> }
  AnimationError: { message: string; context: Option.Option<JsonValue> }
  CollisionError: { message: string; details: Option.Option<JsonValue> }
}>()

export type CameraError = Data.TaggedEnum.Type<typeof CameraError>

// ========================================
// Value Object Errors (Data.taggedEnum)
// ========================================

/**
 * 位置関連エラー型
 */
export const PositionError = Data.taggedEnum<{
  InvalidPosition: {
    message: string
    axis: Option.Option<'x' | 'y' | 'z'>
    value: Option.Option<number>
    reason: Option.Option<string>
  }
  PositionOutOfBounds: {
    message: string
    position: Option.Option<{ x: number; y: number; z: number }>
    bounds: Option.Option<{
      min: { x: number; y: number; z: number }
      max: { x: number; y: number; z: number }
    }>
  }
}>()

export type PositionError = Data.TaggedEnum.Type<typeof PositionError>

/**
 * 回転関連エラー型
 */
export const RotationError = Data.taggedEnum<{
  InvalidRotation: {
    message: string
    axis: Option.Option<'pitch' | 'yaw' | 'roll'>
    value: Option.Option<number>
    min: Option.Option<number>
    max: Option.Option<number>
  }
  RotationLimitExceeded: {
    message: string
    rotation: Option.Option<{ pitch: number; yaw: number }>
    limits: Option.Option<{
      pitch: { min: number; max: number }
      yaw: { min: number; max: number }
    }>
  }
}>()

export type RotationError = Data.TaggedEnum.Type<typeof RotationError>

/**
 * 設定関連エラー型
 */
export const SettingsError = Data.taggedEnum<{
  InvalidFOV: { message: string; value: number; min: number; max: number }
  InvalidSensitivity: { message: string; value: number; min: number; max: number }
  InvalidDistance: { message: string; value: number; min: number; max: number }
}>()

export type SettingsError = Data.TaggedEnum.Type<typeof SettingsError>

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
 * カメラエラーファクトリー（Data.taggedEnum パターン）
 */
const mapErrorCauseOption = (value: unknown): Option.Option<ErrorCause> =>
  Option.fromNullable(toErrorCause(value))

const mapJsonValueOption = (value: JsonSerializable | undefined): Option.Option<JsonValue> =>
  Option.fromNullable(toJsonValueOption(value))

export const createCameraError = {
  initializationFailed: (message: string, cause?: unknown) =>
    CameraError.InitializationFailed({ message, cause: mapErrorCauseOption(cause) }),

  notInitialized: (operation: string) =>
    CameraError.CameraNotInitialized({
      operation,
      message: `Operation '${operation}' called before camera initialization`,
    }),

  invalidConfiguration: (message: string, config?: JsonSerializable) =>
    CameraError.InvalidConfiguration({ message, config: mapJsonValueOption(config) }),

  invalidMode: (mode: string, validModes: readonly string[]) =>
    CameraError.InvalidMode({
      message: `Invalid camera mode '${mode}'. Valid modes: ${validModes.join(', ')}`,
      mode,
      validModes,
    }),

  invalidParameter: (parameter: string, value: JsonSerializable, expected?: string) =>
    CameraError.InvalidParameter({
      message: `Invalid parameter '${parameter}'${expected ? `: ${expected}` : ''}`,
      parameter,
      value: toJsonValue(value),
      expected: Option.fromNullable(expected),
    }),

  resourceError: (message: string, cause?: unknown) =>
    CameraError.ResourceError({ message, cause: mapErrorCauseOption(cause) }),

  animationError: (message: string, context?: JsonSerializable) =>
    CameraError.AnimationError({ message, context: mapJsonValueOption(context) }),

  collisionError: (message: string, details?: JsonSerializable) =>
    CameraError.CollisionError({ message, details: mapJsonValueOption(details) }),
} as const

/**
 * 位置エラーファクトリー
 */
export const createPositionError = {
  invalidCoordinate: (axis: 'x' | 'y' | 'z', value: number, reason: string) =>
    PositionError.InvalidPosition({
      message: `Invalid ${axis} coordinate: ${value} (${reason})`,
      axis: Option.some(axis),
      value: Option.some(value),
      reason: Option.some(reason),
    }),

  outOfBounds: (
    position: { x: number; y: number; z: number },
    bounds: {
      min: { x: number; y: number; z: number }
      max: { x: number; y: number; z: number }
    }
  ) =>
    PositionError.PositionOutOfBounds({
      message: `Position out of bounds: (${position.x}, ${position.y}, ${position.z})`,
      position: Option.some(position),
      bounds: Option.some(bounds),
    }),
} as const

/**
 * 回転エラーファクトリー
 */
export const createRotationError = {
  invalidAngle: (axis: 'pitch' | 'yaw' | 'roll', value: number, min: number, max: number) =>
    RotationError.InvalidRotation({
      message: `Invalid ${axis} angle: ${value} (expected ${min} to ${max})`,
      axis: Option.some(axis),
      value: Option.some(value),
      min: Option.some(min),
      max: Option.some(max),
    }),

  limitExceeded: (
    rotation: { pitch: number; yaw: number },
    limits: {
      pitch: { min: number; max: number }
      yaw: { min: number; max: number }
    }
  ) =>
    RotationError.RotationLimitExceeded({
      message: `Rotation limit exceeded: pitch=${rotation.pitch}, yaw=${rotation.yaw}`,
      rotation: Option.some(rotation),
      limits: Option.some(limits),
    }),
} as const

/**
 * 設定エラーファクトリー
 */
export const createSettingsError = {
  invalidFOV: (value: number, min: number, max: number) =>
    SettingsError.InvalidFOV({
      message: `Invalid FOV: ${value} (expected ${min} to ${max})`,
      value,
      min,
      max,
    }),

  invalidSensitivity: (value: number, min: number, max: number) =>
    SettingsError.InvalidSensitivity({
      message: `Invalid sensitivity: ${value} (expected ${min} to ${max})`,
      value,
      min,
      max,
    }),

  invalidDistance: (value: number, min: number, max: number) =>
    SettingsError.InvalidDistance({
      message: `Invalid distance: ${value} (expected ${min} to ${max})`,
      value,
      min,
      max,
    }),
} as const

// ========================================
// Data.taggedEnum Pattern - Factory Functions
// ========================================
// Note: With Data.taggedEnum, errors are created using:
// 1. Direct constructors (e.g., CameraError.InitializationFailed({ ... }))
// 2. Factory functions (e.g., createCameraError.initializationFailed(...))
// Factory functions provide convenience and consistent error creation
