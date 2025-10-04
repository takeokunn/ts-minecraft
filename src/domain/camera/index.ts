// Camera Domain Services
export * from './first_person'
export * from './live'
export * from './service'
export * from './third_person'

// New Types System (main exports)
export * from './types/index'

// Helper functions
export * from './helper'

// Player Camera specific exports (explicit to avoid conflicts)
export {
  DEFAULT_CAMERA_SETTINGS as DefaultPlayerCameraSettings,
  PlayerCameraService,
  PlayerCameraServiceLive,
} from './player'

// Value Object specific exports (explicit to avoid conflicts)
export {
  createCameraDistance as createCameraDistanceVO,
  createCameraRotation as createCameraRotationVO,
  createPosition3D as createPosition3DVO,
} from './value_object'

// Legacy exports for backward compatibility (explicit re-exports to avoid conflicts)
export {
  CameraParameterSchemas,
  CameraConfig as LegacyCameraConfig,
  LegacyCameraError,
  CameraMode as LegacyCameraMode,
  CameraState as LegacyCameraState,
  Vector3Schema,
} from './types'

// Constants
export * from './constant'
