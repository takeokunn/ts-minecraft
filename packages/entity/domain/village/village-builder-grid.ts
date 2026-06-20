import type { BlockType, Position } from '@ts-minecraft/core'

export type BlockPlacement = { readonly position: Position; readonly blockType: BlockType }

export const createBlockPlacement = (
  anchor: Position,
  dx: number,
  dy: number,
  dz: number,
  blockType: BlockType,
): BlockPlacement => ({
  position: { x: anchor.x + dx, y: anchor.y + dy, z: anchor.z + dz },
  blockType,
})

export const appendSquareCells = (
  sizeX: number,
  sizeZ: number,
  visitCell: (dx: number, dz: number) => void,
): void => {
  for (let dx = 0; dx < sizeX; dx++) {
    for (let dz = 0; dz < sizeZ; dz++) {
      visitCell(dx, dz)
    }
  }
}

export const appendSquareLayer = (
  result: BlockPlacement[],
  anchor: Position,
  sizeX: number,
  sizeZ: number,
  dy: number,
  blockType: BlockType,
  shouldSkip: (dx: number, dz: number, dy: number) => boolean = () => false,
): void => {
  appendSquareCells(sizeX, sizeZ, (dx, dz) => {
    if (shouldSkip(dx, dz, dy)) return
    result.push(createBlockPlacement(anchor, dx, dy, dz, blockType))
  })
}
