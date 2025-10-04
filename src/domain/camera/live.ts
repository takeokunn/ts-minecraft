// 統合Layer（本番用）
import { Layer } from 'effect'
import { FirstPersonCameraLive } from './first-person'
import { ThirdPersonCameraLive } from './third-person'

export const CameraSystemLive = Layer.mergeAll(FirstPersonCameraLive, ThirdPersonCameraLive)
