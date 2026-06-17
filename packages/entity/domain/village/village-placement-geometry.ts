import type { Position } from '@ts-minecraft/core'
import type { VillageStructure } from './village-model'

export const groundVillageStructure = (
  structure: VillageStructure,
  groundY: number,
): VillageStructure =>
  groundY < 0 ? structure : { ...structure, anchor: { ...structure.anchor, y: groundY + 1 } }

export const snapVillageCenter = (position: Position): Position => ({
  x: Math.floor(position.x / 96) * 96 + 48,
  y: Math.max(64, Math.round(position.y)),
  z: Math.floor(position.z / 96) * 96 + 48,
})

export const collectStructureFootprintCells = (
  structure: VillageStructure,
): ReadonlyArray<Readonly<{ x: number; z: number }>> => {
  const cells: Array<{ x: number; z: number }> = []
  for (let dx = 0; dx < structure.size.x; dx++) {
    for (let dz = 0; dz < structure.size.z; dz++) {
      cells.push({ x: structure.anchor.x + dx, z: structure.anchor.z + dz })
    }
  }
  return cells
}
