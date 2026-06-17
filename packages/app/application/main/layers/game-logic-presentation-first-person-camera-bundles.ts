import { Layer } from 'effect'

import { FirstPersonCameraService } from '@ts-minecraft/entity'

import { CameraStateLayer } from './game-logic-player-camera-state-bundles'
import { PlayerInputLayer } from './game-logic-player-input-bundles'

export const FirstPersonCameraLayer = FirstPersonCameraService.Default.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(CameraStateLayer),
)
