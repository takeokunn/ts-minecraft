import { describe, it, expect } from 'vitest'
import { buildingBlocksForStructure, buildingBlocksForVillage } from '@ts-minecraft/entity/domain/village/village-builder-placements'
import { makeTestVillageStructure } from './test-utils'
import {
  expectAllPlacementsToMatch,
  expectBlockTypes,
  expectNoPlacementAt,
  expectPlacementAt,
  expectPlacementCount,
  placementsOfType,
} from './village-builder-assertions'

describe('village-builder / well', () => {
  it('places STONE ring at y=anchor.y and anchor.y+1, WATER at center+1, STONE cap at anchor.y+2', () => {
    const structure = makeTestVillageStructure({ type: 'well', size: { x: 3, y: 4, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    // 3×3 ring minus center = 8 stones per level
    expectPlacementCount(placements.filter(placement => placement.position.y === 64), 'STONE', 8)
    expectPlacementCount(placements.filter(placement => placement.position.y === 65), 'STONE', 8)
    expectPlacementCount(placements.filter(placement => placement.position.y === 66), 'STONE', 8)

    // WATER at (anchor.x+1, anchor.y+1, anchor.z+1) = (1, 65, 1)
    expectPlacementAt(placements, 'WATER', { x: 1, y: 65, z: 1 })

    // No center block at any STONE level
    expectNoPlacementAt(placements, 'STONE', { x: 1, y: 64, z: 1 })
    expectNoPlacementAt(placements, 'STONE', { x: 1, y: 65, z: 1 })
    expectNoPlacementAt(placements, 'STONE', { x: 1, y: 66, z: 1 })
  })

  it('places blocks only with STONE and WATER block types', () => {
    const structure = makeTestVillageStructure({ type: 'well', size: { x: 3, y: 4, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    expectBlockTypes(placements, ['STONE', 'WATER'])
  })

  it('respects a non-zero anchor position', () => {
    const structure = makeTestVillageStructure({ type: 'well', size: { x: 3, y: 4, z: 3 }, anchor: { x: 10, y: 70, z: 20 } })
    const placements = buildingBlocksForStructure(structure)

    expectPlacementAt(placements, 'WATER', { x: 11, y: 71, z: 21 })

    const allX = placements.map(p => p.position.x)
    expect(Math.min(...allX)).toBe(10)
    expect(Math.max(...allX)).toBe(12)
  })
})

describe('village-builder / house', () => {
  it('places PLANKS floor at anchor.y for all sizeX×sizeZ tiles', () => {
    const structure = makeTestVillageStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    expectPlacementCount(placements.filter(p => p.position.y === 64), 'PLANKS', 6 * 6)
  })

  it('places WOOD roof at anchor.y+sizeY-1 for all sizeX×sizeZ tiles', () => {
    const structure = makeTestVillageStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    expectPlacementCount(placements.filter(p => p.position.y === 64 + 5 - 1), 'WOOD', 6 * 6)
  })

  it('places COBBLESTONE walls only on perimeter from anchor.y+1 to anchor.y+sizeY-2', () => {
    const structure = makeTestVillageStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    expectAllPlacementsToMatch(placementsOfType(placements, 'COBBLESTONE'), placement => {
      const dx = placement.position.x
      const dz = placement.position.z
      return dx === 0 || dx === 5 || dz === 0 || dz === 5
    })
  })

  it('leaves door gap in south wall (dz===0) at doorX, y=anchor.y+1 and anchor.y+2', () => {
    const structure = makeTestVillageStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const doorX = Math.floor(6 / 2) // 3
    expectNoPlacementAt(placements, 'COBBLESTONE', { x: doorX, y: 65, z: 0 })
    expectNoPlacementAt(placements, 'COBBLESTONE', { x: doorX, y: 66, z: 0 })
  })

  it('does not place AIR blocks (interior is left implicit)', () => {
    const structure = makeTestVillageStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    expect(placementsOfType(placements, 'AIR')).toHaveLength(0)
  })

  it('places exactly PLANKS, COBBLESTONE, and WOOD block types', () => {
    const structure = makeTestVillageStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    expectBlockTypes(placements, ['PLANKS', 'COBBLESTONE', 'WOOD'])
  })
})

describe('village-builder / farm', () => {
  it('places FARMLAND at anchor.y for all sizeX×sizeZ tiles', () => {
    const structure = makeTestVillageStructure({ type: 'farm', size: { x: 8, y: 1, z: 8 } })
    const placements = buildingBlocksForStructure(structure)

    expectPlacementCount(placements.filter(p => p.position.y === 64), 'FARMLAND', 8 * 8)
  })

  it('places WHEAT_CROP at anchor.y+1 for rows where dz % 2 === 0', () => {
    const structure = makeTestVillageStructure({ type: 'farm', size: { x: 8, y: 1, z: 8 } })
    const placements = buildingBlocksForStructure(structure)

    const wheat = placementsOfType(placements, 'WHEAT_CROP')
    // Rows dz=0,2,4,6 → 4 rows × 8 columns = 32
    expect(wheat).toHaveLength(4 * 8)
    expectAllPlacementsToMatch(wheat, placement => placement.position.y === 65)
    expectAllPlacementsToMatch(wheat, placement => placement.position.z % 2 === 0)
  })

  it('places only FARMLAND and WHEAT_CROP block types', () => {
    const structure = makeTestVillageStructure({ type: 'farm', size: { x: 8, y: 1, z: 8 } })
    const placements = buildingBlocksForStructure(structure)

    expectBlockTypes(placements, ['FARMLAND', 'WHEAT_CROP'])
  })
})

describe('village-builder / road', () => {
  it('places GRAVEL at anchor.y for all sizeX×sizeZ tiles', () => {
    const structure = makeTestVillageStructure({ type: 'road', size: { x: 24, y: 1, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    expect(placements).toHaveLength(24 * 3)
    expectAllPlacementsToMatch(placements, placement => placement.blockType === 'GRAVEL')
    expectAllPlacementsToMatch(placements, placement => placement.position.y === 64)
  })

  it('places only GRAVEL block type', () => {
    const structure = makeTestVillageStructure({ type: 'road', size: { x: 24, y: 1, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    expectBlockTypes(placements, ['GRAVEL'])
  })
})

describe('village-builder / buildingBlocksForVillage', () => {
  it('flattens blocks from multiple structures', () => {
    const well = makeTestVillageStructure({ type: 'well', size: { x: 3, y: 4, z: 3 } })
    const road = makeTestVillageStructure({ type: 'road', size: { x: 24, y: 1, z: 3 }, anchor: { x: 0, y: 64, z: 10 } })

    const wellBlocks = buildingBlocksForStructure(well)
    const roadBlocks = buildingBlocksForStructure(road)
    const combined = buildingBlocksForVillage([well, road])

    expect(combined).toHaveLength(wellBlocks.length + roadBlocks.length)
  })

  it('returns empty array for empty structure list', () => {
    const result = buildingBlocksForVillage([])
    expect(result).toHaveLength(0)
  })
})
