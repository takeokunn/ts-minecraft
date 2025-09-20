// カメラシステムのメインエクスポート
export {
  // CameraService
  CameraService,
  CameraServiceLive,
  CameraServiceTest,
  CameraMode,
  CameraState,
  CameraUpdateParams,
  CameraError,
  defaultCameraState,
} from './CameraService'

export {
  // FirstPersonCamera
  FirstPersonCamera,
  FirstPersonCameraLive,
  FirstPersonCameraTest,
  FirstPersonConfig,
  PlayerState,
  defaultFirstPersonConfig,
} from './FirstPersonCamera'

export {
  // ThirdPersonCamera
  ThirdPersonCamera,
  ThirdPersonCameraLive,
  ThirdPersonCameraTest,
  ThirdPersonConfig,
  TargetState,
  CollisionInfo,
  defaultThirdPersonConfig,
} from './ThirdPersonCamera'

// 統合Layer（本番用）
import { Layer } from 'effect'
import { CameraServiceLive } from './CameraService'
import { FirstPersonCameraLive } from './FirstPersonCamera'
import { ThirdPersonCameraLive } from './ThirdPersonCamera'

export const CameraSystemLive = Layer.mergeAll(
  CameraServiceLive,
  FirstPersonCameraLive,
  ThirdPersonCameraLive
)

// 統合Layer（テスト用）
import { CameraServiceTest } from './CameraService'
import { FirstPersonCameraTest } from './FirstPersonCamera'
import { ThirdPersonCameraTest } from './ThirdPersonCamera'

export const CameraSystemTest = Layer.mergeAll(
  CameraServiceTest,
  FirstPersonCameraTest,
  ThirdPersonCameraTest
)