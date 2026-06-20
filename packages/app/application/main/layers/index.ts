// Application layer composition for the main app runtime.
import { Layer } from 'effect'

import { InfrastructureLayers } from './infrastructure-bundles'
import { GameLogicLayers } from './game-logic-bundles'
import { PresentationLayers } from './presentation-bundles'

const GameLogicProvided = GameLogicLayers.pipe(
  Layer.provideMerge(InfrastructureLayers),
)

export const MainLayers = PresentationLayers.pipe(
  Layer.provideMerge(GameLogicProvided),
)
