import { Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { overworldToNether, netherToOverworld, findNearestPortal } from './nether-link'
import { generatePortalLayout, type PortalLayout } from './portal-frame'

/**
 * Nether travel resolution (pure domain — Phase 17 capstone).
 *
 * Composes the Nether domain layer — coordinate scaling ({@link overworldToNether}/
 * {@link netherToOverworld}), portal search ({@link findNearestPortal}) and layout
 * generation ({@link generatePortalLayout}) — into the single decision made when a
 * player steps through a portal: scale their position into the opposite dimension,
 * reuse the nearest existing portal within {@link PORTAL_SEARCH_RADIUS}, or plan a
 * fresh portal at the scaled destination.
 */

export type Dimension = 'overworld' | 'nether' | 'end'

/** Vanilla search radius (blocks) for an existing portal near the scaled destination. */
export const PORTAL_SEARCH_RADIUS = 128

// Auto-generated portals use the vanilla minimum interior: 2 wide × 3 tall.
const DEFAULT_PORTAL_WIDTH = 2
const DEFAULT_PORTAL_HEIGHT = 3

export type PortalTravelPlan = {
  readonly toDimension: Dimension
  readonly destination: Position
  /** Layout to build when no portal exists near the destination; None means reuse one. */
  readonly portalToCreate: Option.Option<PortalLayout>
}

export const resolveNetherTravel = (
  from: Dimension,
  playerPos: Position,
  knownPortals: ReadonlyArray<Position>,
  searchRadius: number = PORTAL_SEARCH_RADIUS,
): PortalTravelPlan => {
  // End dimension is handled separately via End portal; nether portals only toggle overworld↔nether.
  const toDimension: Dimension = from === 'overworld' ? 'nether' : 'overworld'
  const destination = from === 'overworld' ? overworldToNether(playerPos) : netherToOverworld(playerPos)
  const nearestPortal = Option.getOrNull(findNearestPortal(knownPortals, destination, searchRadius))
  if (nearestPortal !== null) return { toDimension, destination: nearestPortal, portalToCreate: Option.none() }
  return {
    toDimension,
    destination,
    portalToCreate: Option.some(generatePortalLayout(destination, 'x', DEFAULT_PORTAL_WIDTH, DEFAULT_PORTAL_HEIGHT)),
  }
}
