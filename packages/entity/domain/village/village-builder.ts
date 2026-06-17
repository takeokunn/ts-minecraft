import type { BlockType, Position } from '@ts-minecraft/core'
import type { VillageStructure } from './village-model'

export type BlockPlacement = { readonly position: Position; readonly blockType: BlockType }

const createBlockPlacement = (
  anchor: Position,
  dx: number,
  dy: number,
  dz: number,
  blockType: BlockType,
): BlockPlacement => ({
  position: { x: anchor.x + dx, y: anchor.y + dy, z: anchor.z + dz },
  blockType,
})

const appendSquareCells = (
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

const appendSquareLayer = (
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

const isPerimeterCell = (dx: number, dz: number, sizeX: number, sizeZ: number): boolean =>
  dx === 0 || dx === sizeX - 1 || dz === 0 || dz === sizeZ - 1

const isHouseDoorGap = (dx: number, dz: number, dy: number, doorX: number): boolean =>
  dz === 0 && dx === doorX && (dy === 1 || dy === 2)

const buildHouseBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor, size } = structure
  const { x: sizeX, y: sizeY, z: sizeZ } = size
  const result: BlockPlacement[] = []

  appendSquareLayer(result, anchor, sizeX, sizeZ, 0, 'PLANKS')

  const doorX = Math.floor(sizeX / 2)
  for (let dy = 1; dy <= sizeY - 2; dy++) {
    appendSquareLayer(result, anchor, sizeX, sizeZ, dy, 'COBBLESTONE', (dx, dz, wallY) =>
      !isPerimeterCell(dx, dz, sizeX, sizeZ) || isHouseDoorGap(dx, dz, wallY, doorX),
    )
  }

  appendSquareLayer(result, anchor, sizeX, sizeZ, sizeY - 1, 'WOOD')

  return result
}

const buildWellBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor } = structure
  const result: BlockPlacement[] = []

  appendSquareLayer(result, anchor, 3, 3, 0, 'STONE', (dx, dz) => dx === 1 && dz === 1)
  appendSquareLayer(result, anchor, 3, 3, 1, 'STONE', (dx, dz) => dx === 1 && dz === 1)

  result.push(createBlockPlacement(anchor, 1, 1, 1, 'WATER'))

  appendSquareLayer(result, anchor, 3, 3, 2, 'STONE', (dx, dz) => dx === 1 && dz === 1)

  return result
}

const buildFarmBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor, size } = structure
  const { x: sizeX, z: sizeZ } = size
  const result: BlockPlacement[] = []

  appendSquareCells(sizeX, sizeZ, (dx, dz) => {
    result.push(createBlockPlacement(anchor, dx, 0, dz, 'FARMLAND'))
    if (dz % 2 === 0) {
      result.push(createBlockPlacement(anchor, dx, 1, dz, 'WHEAT_CROP'))
    }
  })

  return result
}

const buildRoadBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor, size } = structure
  const { x: sizeX, z: sizeZ } = size
  const result: BlockPlacement[] = []

  appendSquareLayer(result, anchor, sizeX, sizeZ, 0, 'GRAVEL')

  return result
}

export const buildingBlocksForStructure = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  switch (structure.type) {
    case 'house': return buildHouseBlocks(structure)
    case 'well': return buildWellBlocks(structure)
    case 'farm': return buildFarmBlocks(structure)
    case 'road': return buildRoadBlocks(structure)
  }
}

export const buildingBlocksForVillage = (structures: ReadonlyArray<VillageStructure>): ReadonlyArray<BlockPlacement> =>
  structures.flatMap(buildingBlocksForStructure)
