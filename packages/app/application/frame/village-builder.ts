import type { BlockType, Position } from '@ts-minecraft/core'
import type { VillageStructure } from '@ts-minecraft/entity'

export type BlockPlacement = { readonly position: Position; readonly blockType: BlockType }

const buildHouseBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor, size } = structure
  const { x: sizeX, y: sizeY, z: sizeZ } = size
  const result: BlockPlacement[] = []

  // Floor at anchor.y: PLANKS for all (x, z)
  for (let dx = 0; dx < sizeX; dx++) {
    for (let dz = 0; dz < sizeZ; dz++) {
      result.push({ position: { x: anchor.x + dx, y: anchor.y, z: anchor.z + dz }, blockType: 'PLANKS' })
    }
  }

  // Walls at anchor.y+1 to anchor.y+sizeY-2: perimeter only (COBBLESTONE), door gap skipped
  const doorX = Math.floor(sizeX / 2)
  for (let dy = 1; dy <= sizeY - 2; dy++) {
    const wallY = anchor.y + dy
    for (let dx = 0; dx < sizeX; dx++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const isPerimeter = dx === 0 || dx === sizeX - 1 || dz === 0 || dz === sizeZ - 1
        if (!isPerimeter) continue
        // Door gap: south wall (dz === 0), x === doorX, y === anchor.y+1 or anchor.y+2
        if (dz === 0 && dx === doorX && (wallY === anchor.y + 1 || wallY === anchor.y + 2)) continue
        result.push({ position: { x: anchor.x + dx, y: wallY, z: anchor.z + dz }, blockType: 'COBBLESTONE' })
      }
    }
  }

  // Roof at anchor.y+sizeY-1: WOOD for all (x, z)
  const roofY = anchor.y + sizeY - 1
  for (let dx = 0; dx < sizeX; dx++) {
    for (let dz = 0; dz < sizeZ; dz++) {
      result.push({ position: { x: anchor.x + dx, y: roofY, z: anchor.z + dz }, blockType: 'WOOD' })
    }
  }

  return result
}

const buildWellBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor } = structure
  const result: BlockPlacement[] = []

  // STONE ring at y=anchor.y and anchor.y+1: all (x, z) in [0,3)×[0,3) except center (1,1)
  for (let dy = 0; dy <= 1; dy++) {
    const ringY = anchor.y + dy
    for (let dx = 0; dx < 3; dx++) {
      for (let dz = 0; dz < 3; dz++) {
        if (dx === 1 && dz === 1) continue // skip center
        result.push({ position: { x: anchor.x + dx, y: ringY, z: anchor.z + dz }, blockType: 'STONE' })
      }
    }
  }

  // WATER at center one level up (anchor.x+1, anchor.y+1, anchor.z+1)
  result.push({ position: { x: anchor.x + 1, y: anchor.y + 1, z: anchor.z + 1 }, blockType: 'WATER' })

  // STONE cap at y=anchor.y+2: same ring (no center)
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      if (dx === 1 && dz === 1) continue // skip center
      result.push({ position: { x: anchor.x + dx, y: anchor.y + 2, z: anchor.z + dz }, blockType: 'STONE' })
    }
  }

  return result
}

const buildFarmBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor, size } = structure
  const { x: sizeX, z: sizeZ } = size
  const result: BlockPlacement[] = []

  for (let dx = 0; dx < sizeX; dx++) {
    for (let dz = 0; dz < sizeZ; dz++) {
      // FARMLAND at anchor.y for all (x, z)
      result.push({ position: { x: anchor.x + dx, y: anchor.y, z: anchor.z + dz }, blockType: 'FARMLAND' })
      // WHEAT_CROP at anchor.y+1 for rows where dz % 2 === 0
      if (dz % 2 === 0) {
        result.push({ position: { x: anchor.x + dx, y: anchor.y + 1, z: anchor.z + dz }, blockType: 'WHEAT_CROP' })
      }
    }
  }

  return result
}

const buildRoadBlocks = (structure: VillageStructure): ReadonlyArray<BlockPlacement> => {
  const { anchor, size } = structure
  const { x: sizeX, z: sizeZ } = size
  const result: BlockPlacement[] = []

  for (let dx = 0; dx < sizeX; dx++) {
    for (let dz = 0; dz < sizeZ; dz++) {
      result.push({ position: { x: anchor.x + dx, y: anchor.y, z: anchor.z + dz }, blockType: 'GRAVEL' })
    }
  }

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
