// Camera Domain Services

// New Types System (main exports)
export * from '@domain/camera/types'

// Helper functions

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
} from '@domain/camera/types'

// Constants
export * from './constant'
export * from './helper'
export * from './service'
