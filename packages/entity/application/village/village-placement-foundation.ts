import { type VillageBlockPlacement, type VillageFoundationFootprintCell } from './village-placement-foundation-types'

const VILLAGE_FOUNDATION_MAX_DEPTH = 12

export const buildFoundationPlacementsFromFootprint = (
  footprintCells: ReadonlyArray<VillageFoundationFootprintCell>,
  floorY: number,
): ReadonlyArray<VillageBlockPlacement> => {
  const foundationPlacements: VillageBlockPlacement[] = []
  for (const cell of footprintCells) {
    if (cell.surfaceY < 0) continue
    const fillBottom = Math.max(cell.surfaceY + 1, floorY - VILLAGE_FOUNDATION_MAX_DEPTH)
    for (let y = fillBottom; y < floorY; y++) {
      foundationPlacements.push({
        position: { x: cell.x, y, z: cell.z },
        blockType: 'COBBLESTONE',
      })
    }
  }
  return foundationPlacements
}
