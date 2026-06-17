// Application layer composition — wires all services into a single Effect Layer graph.
// Re-exports per-tier bundles (Infrastructure, GameLogic, Presentation) and composes
// them in dependency order. `Layer.mergeAll` is parallel; use `Layer.provideMerge`
// when the provided layer's output must remain in scope for downstream consumers.
import { Layer } from 'effect'

import { InfrastructureLayers } from './infrastructure-bundles'
import { GameLogicLayers } from './game-logic-bundles'
import { PresentationLayers } from './presentation-bundles'

export * from './infrastructure-bundles'
export * from './game-logic-bundles'
export * from './presentation-bundles'

const GameLogicProvided = GameLogicLayers.pipe(
  Layer.provideMerge(InfrastructureLayers),
)

export const MainLayers = PresentationLayers.pipe(
  Layer.provideMerge(GameLogicProvided),
)
