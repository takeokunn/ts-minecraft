// 統合Layer（本番用）
import { Layer } from 'effect'
import { FirstPersonCameraLive } from './FirstPersonCamera'
import { ThirdPersonCameraLive } from './ThirdPersonCamera'

export const CameraSystemLive = Layer.mergeAll(FirstPersonCameraLive, ThirdPersonCameraLive)
