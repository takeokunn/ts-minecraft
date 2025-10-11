// ========================================
// Error Types and Classes Export
// ========================================

// Error ADTs (Data.taggedEnum)
export { CameraError, PositionError, RotationError, SettingsError } from './errors'

// Error Union Types
export type { CameraDomainError } from './errors'

// Error Factory Functions
export { createCameraError, createPositionError, createRotationError, createSettingsError } from './errors'

// ========================================
// CQRS Types Export
// ========================================

export type {
  CameraCommand,
  GetCameraSnapshotQuery,
  GetCameraStateQuery,
  ListActiveCamerasQuery,
  SwitchCameraModeCommand,
  UpdateCameraPositionCommand,
  UpdateCameraRotationCommand,
  UpdateCameraSettingsCommand,
} from './commands'

export {
  CameraCommandBaseSchema,
  CameraCommandMetadataSchema,
  CameraCommandSchema,
  SwitchCameraModeCommandSchema,
  UpdateCameraPositionCommandSchema,
  UpdateCameraRotationCommandSchema,
  UpdateCameraSettingsCommandSchema,
  isCameraCommand,
  validateCameraCommand,
} from './commands'

export {
  CameraQueryMetadataSchema,
  CameraQuerySchema,
  GetCameraSnapshotQuerySchema,
  GetCameraStateQuerySchema,
  ListActiveCamerasQuerySchema,
  isCameraQuery,
  validateCameraQuery,
} from './queries'

export type { CameraQuery } from './queries'

// ========================================
// Camera View Types Export
// ========================================

export type { CameraOrientation, CameraProjection, CameraSnapshot, CameraTransform } from './camera_view'
export {
  CameraQuaternionSchema,
  CameraOrientationSchema,
  CameraProjectionSchema,
  CameraSnapshotSchema,
  CameraVector3Schema,
  CameraTransformSchema,
  makeCameraSync,
} from './camera_view'
export type { CameraProjectionBrand, CameraTransformBrand } from './camera_view'

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
} from './constants'

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
} from './constants'

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
} from './constants'

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
} from './constants'

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
} from './constants'

// Schema Factory Functions
export { createBrandedNumberSchema } from './constants'

// ========================================
// Events Export
// ========================================

// Event Types
export type { AnimationState, CameraEvent, CameraId, CameraRotation, CameraSettings } from './events'

// Event Schemas
export {
  AnimationStateSchema,
  CameraEventSchema,
  CameraIdSchema,
  CameraRotationSchema,
  CameraSettingsSchema,
} from './events'

// Event Factory Functions
export { createCameraEvent } from './events'

// Event Type Guards
export {
  isAnimationEvent,
  isCameraInitializedEvent,
  isCollisionDetectedEvent,
  isPositionUpdatedEvent,
  isRotationUpdatedEvent,
  isSettingsChangedEvent,
  isViewModeChangedEvent,
} from './events'

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
