import { Layer } from 'effect'

import { DebugFeatureFlagsLayer } from './game-logic-foundation'
import { CameraStateLayer } from './game-logic-player-camera-state-bundles'
import { MovementLayer } from './game-logic-player-movement-bundles'
import { PlayerInputLayer } from './game-logic-player-input-bundles'
import { RaycastingLayer } from './game-logic-player-raycasting-bundles'
import {
  PlayerServicePortLayer,
  WorldBlockQueryPortLayer,
} from './game-logic-ports'
import { TimeService } from '@ts-minecraft/game'

const RuntimeCoreRuntimeLayers = PlayerInputLayer.pipe(
  Layer.provideMerge(MovementLayer),
).pipe(
  Layer.provideMerge(CameraStateLayer),
).pipe(
  Layer.provideMerge(RaycastingLayer),
)

export const RuntimeCoreLayers = PlayerServicePortLayer.pipe(
  Layer.provideMerge(WorldBlockQueryPortLayer),
  Layer.provideMerge(TimeService.Default),
  Layer.provideMerge(RuntimeCoreRuntimeLayers),
  Layer.provideMerge(DebugFeatureFlagsLayer),
)
