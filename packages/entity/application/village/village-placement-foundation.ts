import { type BlockService } from '@ts-minecraft/world'

type VillageBlockPosition = Parameters<BlockService['forceSetBlock']>[0]
type VillageBlockType = Parameters<BlockService['forceSetBlock']>[1]

export type VillageBlockPlacement = {
  readonly position: VillageBlockPosition
  readonly blockType: VillageBlockType
}

export type VillageFoundationFootprintCell = Readonly<{
  readonly x: number
  readonly z: number
  readonly surfaceY: number
}>

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
