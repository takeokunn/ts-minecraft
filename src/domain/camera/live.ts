// 統合Layer（本番用）
import { Layer } from 'effect'
import { FirstPersonCameraLive } from './first_person'
import { ThirdPersonCameraLive } from './third_person'

export const CameraSystemLive = Layer.mergeAll(FirstPersonCameraLive, ThirdPersonCameraLive)
