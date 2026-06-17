import { Layer } from 'effect'

import { FirstPersonCameraLayer } from './game-logic-presentation-first-person-camera-bundles'
import { ThirdPersonCameraLayer } from './game-logic-presentation-third-person-camera-bundles'

export const CameraPresentationLayers = FirstPersonCameraLayer.pipe(
  Layer.provideMerge(ThirdPersonCameraLayer),
)
