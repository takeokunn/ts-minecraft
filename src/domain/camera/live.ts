// 統合Layer（本番用）
import { Layer } from 'effect'
import { FirstPersonCameraLive } from './index'
import { ThirdPersonCameraLive } from './index'

export const CameraSystemLive = Layer.mergeAll(FirstPersonCameraLive, ThirdPersonCameraLive)
