/**
 * Application layer composition — wires all services into a single Effect Layer graph.
 *
 * Re-exports the per-tier bundles (Infrastructure, GameLogic, Presentation) and
 * aggregates them into `MainLive`, the full layer graph consumed by `mainProgram`.
 *
 * Dependency order: Infrastructure → Application/Game-Logic → Presentation.
 */
import { Layer } from 'effect'

import { InfrastructureLayers } from './infrastructure'
import { GameLogicLayers } from './game-logic'
import { PresentationLayers } from './presentation'

export * from './infrastructure'
export * from './game-logic'
export * from './presentation'

/** Full application layer: provides every service to mainProgram. */
export const MainLive = Layer.mergeAll(
  InfrastructureLayers,
  GameLogicLayers,
  PresentationLayers,
)
