import { Layer } from 'effect'

import { ThirdPersonCameraService } from '@ts-minecraft/entity/application/third-person-camera-service'

import { CameraStateLayer } from './game-logic-player-camera-state-bundles'

export const ThirdPersonCameraLayer = ThirdPersonCameraService.Default.pipe(
  Layer.provide(CameraStateLayer),
)
