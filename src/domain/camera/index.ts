// カメラシステムのメインエクスポート
export {
  // CameraService
  CameraService,
  CameraMode,
  CameraConfig,
  CameraState,
  CameraError,
  DEFAULT_CAMERA_CONFIG,
} from './CameraService'

export {
  // FirstPersonCamera
  FirstPersonCameraLive,
} from './FirstPersonCamera'

export {
  // ThirdPersonCamera
  ThirdPersonCameraLive,
} from './ThirdPersonCamera'

// 統合Layer（本番用）
import { Layer } from 'effect'
import { FirstPersonCameraLive } from './FirstPersonCamera'
import { ThirdPersonCameraLive } from './ThirdPersonCamera'

export const CameraSystemLive = Layer.mergeAll(FirstPersonCameraLive, ThirdPersonCameraLive)

