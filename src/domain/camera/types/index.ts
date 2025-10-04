// ========================================
// Error Types and Classes Export
// ========================================

// Error Classes (Schema.TaggedError)
export {
  CameraAnimationError,
  CameraCollisionError,
  CameraInitializationError,
  CameraNotInitializedError,
  CameraResourceError,
  InvalidCameraModeError,
  InvalidConfigurationError,
  InvalidDistanceError,
  InvalidFOVError,
  InvalidParameterError,
  InvalidPositionError,
  InvalidRotationError,
  InvalidSensitivityError,
  PositionOutOfBoundsError,
  RotationLimitExceededError,
} from './errors.js'

// Error Union Types
export type { CameraDomainError, CameraError, PositionError, RotationError, SettingsError } from './errors.js'

// Error Factory Functions
export { createCameraError, createPositionError, createRotationError, createSettingsError } from './errors.js'

// Error Schemas (placeholder - implement when needed)
// export {
//   CameraDomainErrorSchema,
//   CameraErrorSchema,
//   PositionErrorSchema,
//   RotationErrorSchema,
//   SettingsErrorSchema,
// } from './errors.js'

// ========================================
// Constants and Brand Types Export
// ========================================

// Brand Types
export type {
  AnimationDuration,
  CameraDistance,
  CameraMode,
  DeltaTime,
  FOV,
  MouseDelta,
  PitchAngle,
  Position3D,
  Rotation2D,
  Sensitivity,
  YawAngle,
} from './constants.js'

// Constants
export {
  ANGLE_CONVERSION,
  CAMERA_ANGLE_DEFAULTS,
  CAMERA_ANIMATION,
  CAMERA_COMPONENT_IDS,
  CAMERA_DEFAULTS,
  CAMERA_LIMITS,
  CAMERA_MODES,
  CAMERA_PHYSICS,
  CAMERA_PHYSICS_LIMITS,
  CAMERA_PRIORITY,
  CAMERA_STATE,
  VALID_CAMERA_MODES,
} from './constants.js'

// Type Guards
export {
  isCameraMode,
  isValidAnimationDuration,
  isValidDeltaTime,
  isValidDistance,
  isValidFOV,
  isValidMouseDelta,
  isValidPitch,
  isValidPosition3D,
  isValidRotation2D,
  isValidSensitivity,
  isValidYaw,
} from './constants.js'

// Validation Schemas
export {
  AnimationDurationSchema,
  CameraDistanceSchema,
  CameraModeSchema,
  DeltaTimeSchema,
  FOVSchema,
  MouseDeltaSchema,
  PitchAngleSchema,
  Position3DSchema,
  Rotation2DSchema,
  SensitivitySchema,
  YawAngleSchema,
} from './constants.js'

// Brand Type Factory Functions
export {
  createAnimationDuration,
  createCameraDistance,
  createDeltaTime,
  createFOV,
  createMouseDelta,
  createPitchAngle,
  createPosition3D,
  createRotation2D,
  createSensitivity,
  createYawAngle,
} from './constants.js'

// Schema Factory Functions
export {
  createBrandedNumberSchema,
  // createBrandedStructSchema, // Temporarily disabled due to type constraints
} from './constants.js'

// ========================================
// Events Export
// ========================================

// Event Types
export type { AnimationState, CameraEvent, CameraId, CameraRotation, CameraSettings } from './events.js'

// Event Schemas
export {
  AnimationStateSchema,
  CameraEventSchema,
  CameraIdSchema,
  CameraRotationSchema,
  CameraSettingsSchema,
} from './events.js'

// Event Factory Functions
export { createCameraEvent } from './events.js'

// Event Type Guards
export {
  isAnimationEvent,
  isCameraInitializedEvent,
  isCollisionDetectedEvent,
  isPositionUpdatedEvent,
  isRotationUpdatedEvent,
  isSettingsChangedEvent,
  isViewModeChangedEvent,
} from './events.js'

// ========================================
// Re-export Everything as Namespace
// ========================================

/**
 * Camera Domain Types Namespace
 *
 * 使用例:
 * ```typescript
 * import { CameraTypes } from '../types/index.js'
 *
 * // エラー作成
 * const error = CameraTypes.createCameraError.invalidMode('invalid-mode', ['first-person', 'third-person'])
 *
 * // イベント作成
 * const event = CameraTypes.createCameraEvent.cameraInitialized('camera-1', 'first-person')
 *
 * // 定数使用
 * const defaultFOV = CameraTypes.CAMERA_DEFAULTS.FOV
 * ```
 */
export * as CameraTypes from './index.js'
