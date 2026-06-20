import { Effect } from 'effect'
import { type Village, type VillageStructure } from '../../domain/village/village-model'
import { collectStructureFootprintCells, groundVillageStructure } from '../../domain/village/village-placement-geometry'
import {
  buildFoundationPlacementsFromFootprint,
} from './village-placement-foundation'
import { type VillageBlockPlacement, type VillageFoundationFootprintCell } from './village-placement-foundation-types'
import { type VillageSurfaceResolver } from './village-placement-surface'
import { type VillagePlacementBlockReadError } from './village-placement-surface-error'

export const groundVillageStructures = (
  village: Village,
  surfaceAt: VillageSurfaceResolver,
): Effect.Effect<ReadonlyArray<VillageStructure>, VillagePlacementBlockReadError> =>
  Effect.gen(function* () {
    const groundedStructures: VillageStructure[] = []
    for (const structure of village.structures) {
      const groundY = yield* surfaceAt(structure.anchor.x, structure.anchor.z)
      groundedStructures.push(groundVillageStructure(structure, groundY))
    }
    return groundedStructures
  })

const buildFoundationPlacementsForStructure = (
  structure: VillageStructure,
  surfaceAt: VillageSurfaceResolver,
): Effect.Effect<ReadonlyArray<VillageBlockPlacement>, VillagePlacementBlockReadError> =>
  Effect.gen(function* () {
    const footprintCells: VillageFoundationFootprintCell[] = []
    const floorY = structure.anchor.y
    for (const cell of collectStructureFootprintCells(structure)) {
      const colSurface = yield* surfaceAt(cell.x, cell.z)
      footprintCells.push({ x: cell.x, z: cell.z, surfaceY: colSurface })
    }
    return buildFoundationPlacementsFromFootprint(footprintCells, floorY)
  })

export const buildVillageFoundationPlacements = (
  groundedStructures: ReadonlyArray<VillageStructure>,
  surfaceAt: VillageSurfaceResolver,
): Effect.Effect<ReadonlyArray<VillageBlockPlacement>, VillagePlacementBlockReadError> =>
  Effect.gen(function* () {
    const foundationPlacements: VillageBlockPlacement[] = []
    for (const structure of groundedStructures) {
      const structurePlacements = yield* buildFoundationPlacementsForStructure(structure, surfaceAt)
      foundationPlacements.push(...structurePlacements)
    }
    return foundationPlacements
  })
