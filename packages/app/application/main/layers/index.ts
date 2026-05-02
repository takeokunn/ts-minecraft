// Application layer composition — wires all services into a single Effect Layer graph.
// Re-exports per-tier bundles (Infrastructure, GameLogic, Presentation) and aggregates
// them into `MainLive`. Dependency order: Infrastructure → Game-Logic → Presentation.
import { Layer } from 'effect'

import { InfrastructureLayers } from './infrastructure'
import { GameLogicLayers } from './game-logic'
import { PresentationLayers } from './presentation'

export * from './infrastructure'
export * from './game-logic'
export * from './presentation'

export const MainLive = Layer.mergeAll(
  InfrastructureLayers,
  GameLogicLayers,
  PresentationLayers,
)
