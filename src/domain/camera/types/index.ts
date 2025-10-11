// ========================================
// Error Types and Classes Export
// ========================================

// Error ADTs (Data.taggedEnum)
export { CameraError, PositionError, RotationError, SettingsError } from './errors.js'

// Error Union Types
export type { CameraDomainError } from './errors.js'

// Error Factory Functions
export { createCameraError, createPositionError, createRotationError, createSettingsError } from './errors.js'

// ========================================
// Camera View Types Export
// ========================================

export type { CameraOrientation, CameraProjection, CameraSnapshot, CameraTransform } from './camera_view.js'
export {
  CameraQuaternionSchema,
  CameraOrientationSchema,
  CameraProjectionSchema,
  CameraSnapshotSchema,
  CameraVector3Schema,
  CameraTransformSchema,
} from './camera_view.js'

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
export { createBrandedNumberSchema } from './constants.js'

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
// Re-export Everything as Namespace - DISABLED to avoid circular dependencies
// ========================================

/**
 * Camera Domain Types Namespace
 *
 * All exports are done explicitly above to avoid circular dependency issues.
 * Wildcard re-exports can cause module initialization order problems in Vitest.
 */
// export * from './constants'
// export * from './errors'
// export * from './events'
