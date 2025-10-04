import { Data, Option } from 'effect'

// ========================================
// Camera Domain Core Errors (Data.TaggedEnum)
// ========================================

/**
 * カメラドメインのコアエラー型（Data.TaggedEnum ADT）
 */
export type CameraError = Data.TaggedEnum<{
  InitializationFailed: {
    readonly message: string
    readonly cause: Option.Option<unknown>
  }
  CameraNotInitialized: {
    readonly operation: string
  }
  InvalidConfiguration: {
    readonly message: string
    readonly config: Option.Option<unknown>
  }
  InvalidMode: {
    readonly mode: string
    readonly validModes: readonly string[]
  }
  InvalidParameter: {
    readonly parameter: string
    readonly value: unknown
    readonly expected: Option.Option<string>
  }
  ResourceError: {
    readonly message: string
    readonly cause: Option.Option<unknown>
  }
  AnimationError: {
    readonly message: string
    readonly context: Option.Option<unknown>
  }
  CollisionError: {
    readonly message: string
    readonly details: Option.Option<unknown>
  }
}>

// ADTコンストラクタ生成
const {
  InitializationFailed,
  CameraNotInitialized,
  InvalidConfiguration,
  InvalidMode,
  InvalidParameter,
  ResourceError,
  AnimationError,
  CollisionError,
} = Data.taggedEnum<CameraError>()

// ========================================
// Value Object Errors (Data.TaggedEnum)
// ========================================

/**
 * 位置関連エラー型
 */
export type PositionError = Data.TaggedEnum<{
  InvalidPosition: {
    readonly axis: 'x' | 'y' | 'z'
    readonly value: number
    readonly reason: string
  }
  PositionOutOfBounds: {
    readonly position: { readonly x: number; readonly y: number; readonly z: number }
    readonly bounds: {
      readonly min: { readonly x: number; readonly y: number; readonly z: number }
      readonly max: { readonly x: number; readonly y: number; readonly z: number }
    }
  }
}>

const PositionErrorConstructors = Data.taggedEnum<PositionError>()
const { InvalidPosition, PositionOutOfBounds } = PositionErrorConstructors

/**
 * 回転関連エラー型
 */
export type RotationError = Data.TaggedEnum<{
  InvalidRotation: {
    readonly axis: 'pitch' | 'yaw' | 'roll'
    readonly value: number
    readonly min: number
    readonly max: number
  }
  RotationLimitExceeded: {
    readonly rotation: { readonly pitch: number; readonly yaw: number }
    readonly limits: {
      readonly pitch: { readonly min: number; readonly max: number }
      readonly yaw: { readonly min: number; readonly max: number }
    }
  }
}>

const RotationErrorConstructors = Data.taggedEnum<RotationError>()
const { InvalidRotation, RotationLimitExceeded } = RotationErrorConstructors

/**
 * 設定関連エラー型
 */
export type SettingsError = Data.TaggedEnum<{
  InvalidFOV: {
    readonly value: number
    readonly min: number
    readonly max: number
  }
  InvalidSensitivity: {
    readonly value: number
    readonly min: number
    readonly max: number
  }
  InvalidDistance: {
    readonly value: number
    readonly min: number
    readonly max: number
  }
}>

const SettingsErrorConstructors = Data.taggedEnum<SettingsError>()
const { InvalidFOV, InvalidSensitivity, InvalidDistance } = SettingsErrorConstructors

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
 * カメラエラーファクトリー（ADTコンストラクタベース）
 */
export const createCameraError = {
  initializationFailed: (message: string, cause?: unknown) =>
    InitializationFailed({ message, cause: Option.fromNullable(cause) }),

  notInitialized: (operation: string) =>
    CameraNotInitialized({ operation }),

  invalidConfiguration: (message: string, config?: unknown) =>
    InvalidConfiguration({ message, config: Option.fromNullable(config) }),

  invalidMode: (mode: string, validModes: readonly string[]) =>
    InvalidMode({ mode, validModes }),

  invalidParameter: (parameter: string, value: unknown, expected?: string) =>
    InvalidParameter({ parameter, value, expected: Option.fromNullable(expected) }),

  resourceError: (message: string, cause?: unknown) =>
    ResourceError({ message, cause: Option.fromNullable(cause) }),

  animationError: (message: string, context?: unknown) =>
    AnimationError({ message, context: Option.fromNullable(context) }),

  collisionError: (message: string, details?: unknown) =>
    CollisionError({ message, details: Option.fromNullable(details) }),
} as const

/**
 * 位置エラーファクトリー
 */
export const createPositionError = {
  invalidCoordinate: (axis: 'x' | 'y' | 'z', value: number, reason: string) =>
    InvalidPosition({ axis, value, reason }),

  outOfBounds: (
    position: { x: number; y: number; z: number },
    bounds: {
      min: { x: number; y: number; z: number }
      max: { x: number; y: number; z: number }
    }
  ) => PositionOutOfBounds({ position, bounds }),
} as const

/**
 * 回転エラーファクトリー
 */
export const createRotationError = {
  invalidAngle: (axis: 'pitch' | 'yaw' | 'roll', value: number, min: number, max: number) =>
    InvalidRotation({ axis, value, min, max }),

  limitExceeded: (
    rotation: { pitch: number; yaw: number },
    limits: {
      pitch: { min: number; max: number }
      yaw: { min: number; max: number }
    }
  ) => RotationLimitExceeded({ rotation, limits }),
} as const

/**
 * 設定エラーファクトリー
 */
export const createSettingsError = {
  invalidFOV: (value: number, min: number, max: number) =>
    InvalidFOV({ value, min, max }),

  invalidSensitivity: (value: number, min: number, max: number) =>
    InvalidSensitivity({ value, min, max }),

  invalidDistance: (value: number, min: number, max: number) =>
    InvalidDistance({ value, min, max }),
} as const

// ========================================
// ADT Export for External Use
// ========================================

/**
 * カメラエラーADTコンストラクタ（外部用エクスポート）
 */
export {
  InitializationFailed,
  CameraNotInitialized,
  InvalidConfiguration,
  InvalidMode,
  InvalidParameter,
  ResourceError,
  AnimationError,
  CollisionError,
}

/**
 * 位置エラーADTコンストラクタ（外部用エクスポート）
 */
export { InvalidPosition, PositionOutOfBounds }

/**
 * 回転エラーADTコンストラクタ（外部用エクスポート）
 */
export { InvalidRotation, RotationLimitExceeded }

/**
 * 設定エラーADTコンストラクタ（外部用エクスポート）
 */
export { InvalidFOV, InvalidSensitivity, InvalidDistance }

// ========================================
// Backward Compatibility Aliases
// ========================================

/**
 * 既存コードとの後方互換性のためのエイリアス
 * @deprecated - 新しいADTパターンを使用してください
 */
export const CameraInitializationError = InitializationFailed
export const CameraNotInitializedError = CameraNotInitialized
export const InvalidConfigurationError = InvalidConfiguration
export const InvalidCameraModeError = InvalidMode
export const InvalidParameterError = InvalidParameter
export const CameraResourceError = ResourceError
export const CameraAnimationError = AnimationError
export const CameraCollisionError = CollisionError

export const InvalidPositionError = InvalidPosition
export const PositionOutOfBoundsError = PositionOutOfBounds
export const InvalidRotationError = InvalidRotation
export const RotationLimitExceededError = RotationLimitExceeded
export const InvalidFOVError = InvalidFOV
export const InvalidSensitivityError = InvalidSensitivity
export const InvalidDistanceError = InvalidDistance