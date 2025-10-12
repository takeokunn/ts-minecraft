import type { CameraConfig } from '@domain/camera/types'

/**
 * デフォルトのカメラ設定 - Schema検証済み
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  mode: 'first-person',
  fov: 75,
  aspect: 16 / 9,
  near: 0.1,
  far: 1000,
  sensitivity: 1.0,
  smoothing: 0.15,
  thirdPersonDistance: 5,
  thirdPersonHeight: 2,
  thirdPersonAngle: 0,
}
