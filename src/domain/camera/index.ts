// Camera Domain Services
export * from './index'
export * from './index'
export * from './index'
export * from './index'

// New Types System (main exports)
export * from '@domain/camera/types'

// Helper functions
export * from './index'

// Player Camera specific exports (explicit to avoid conflicts)
export {
  DEFAULT_CAMERA_SETTINGS as DefaultPlayerCameraSettings,
  PlayerCameraService,
  PlayerCameraServiceLive,
} from './index'

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
export * from './index'
export * from './index';
export * from './index';
export * from './index';
export * from './index';
export * from './index';
export * from './service';
export * from './helper';
export * from './constant';
