import { describe, it, expect } from 'vitest'
import { VillageStructureId } from '@ts-minecraft/entity'
import type { VillageStructure } from '@ts-minecraft/entity'
import { buildingBlocksForStructure, buildingBlocksForVillage } from './village-builder'

const makeStructure = (overrides: Partial<VillageStructure> & Pick<VillageStructure, 'type' | 'size'>): VillageStructure => ({
  structureId: VillageStructureId.make('test-structure'),
  anchor: { x: 0, y: 64, z: 0 },
  ...overrides,
})

describe('village-builder / well', () => {
  it('places STONE ring at y=anchor.y and anchor.y+1, WATER at center+1, STONE cap at anchor.y+2', () => {
    const structure = makeStructure({ type: 'well', size: { x: 3, y: 4, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    const stoneAtY64 = placements.filter(p => p.blockType === 'STONE' && p.position.y === 64)
    const stoneAtY65 = placements.filter(p => p.blockType === 'STONE' && p.position.y === 65)
    const stoneAtY66 = placements.filter(p => p.blockType === 'STONE' && p.position.y === 66)
    const water = placements.filter(p => p.blockType === 'WATER')

    // 3×3 ring minus center = 8 stones per level
    expect(stoneAtY64).toHaveLength(8)
    expect(stoneAtY65).toHaveLength(8)
    expect(stoneAtY66).toHaveLength(8)

    // WATER at (anchor.x+1, anchor.y+1, anchor.z+1) = (1, 65, 1)
    expect(water).toHaveLength(1)
    expect(water[0]!.position).toEqual({ x: 1, y: 65, z: 1 })

    // No center block at any STONE level
    const centerY64 = stoneAtY64.find(p => p.position.x === 1 && p.position.z === 1)
    const centerY65 = stoneAtY65.find(p => p.position.x === 1 && p.position.z === 1)
    const centerY66 = stoneAtY66.find(p => p.position.x === 1 && p.position.z === 1)
    expect(centerY64).toBeUndefined()
    expect(centerY65).toBeUndefined()
    expect(centerY66).toBeUndefined()
  })

  it('places blocks only with STONE and WATER block types', () => {
    const structure = makeStructure({ type: 'well', size: { x: 3, y: 4, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    const blockTypes = new Set(placements.map(p => p.blockType))
    expect(blockTypes).toEqual(new Set(['STONE', 'WATER']))
  })

  it('respects a non-zero anchor position', () => {
    const structure = makeStructure({ type: 'well', size: { x: 3, y: 4, z: 3 }, anchor: { x: 10, y: 70, z: 20 } })
    const placements = buildingBlocksForStructure(structure)

    const water = placements.find(p => p.blockType === 'WATER')
    expect(water!.position).toEqual({ x: 11, y: 71, z: 21 })

    const allX = placements.map(p => p.position.x)
    expect(Math.min(...allX)).toBe(10)
    expect(Math.max(...allX)).toBe(12)
  })
})

describe('village-builder / house', () => {
  it('places PLANKS floor at anchor.y for all sizeX×sizeZ tiles', () => {
    const structure = makeStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const floor = placements.filter(p => p.blockType === 'PLANKS' && p.position.y === 64)
    expect(floor).toHaveLength(6 * 6) // 36
  })

  it('places WOOD roof at anchor.y+sizeY-1 for all sizeX×sizeZ tiles', () => {
    const structure = makeStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const roof = placements.filter(p => p.blockType === 'WOOD' && p.position.y === 64 + 5 - 1)
    expect(roof).toHaveLength(6 * 6) // 36
  })

  it('places COBBLESTONE walls only on perimeter from anchor.y+1 to anchor.y+sizeY-2', () => {
    const structure = makeStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const walls = placements.filter(p => p.blockType === 'COBBLESTONE')

    // All wall blocks must be on the perimeter
    for (const w of walls) {
      const dx = w.position.x - 0
      const dz = w.position.z - 0
      const isPerimeter = dx === 0 || dx === 5 || dz === 0 || dz === 5
      expect(isPerimeter).toBe(true)
    }
  })

  it('leaves door gap in south wall (dz===0) at doorX, y=anchor.y+1 and anchor.y+2', () => {
    const structure = makeStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const doorX = Math.floor(6 / 2) // 3
    const doorY1 = placements.find(p => p.blockType === 'COBBLESTONE' && p.position.x === doorX && p.position.z === 0 && p.position.y === 65)
    const doorY2 = placements.find(p => p.blockType === 'COBBLESTONE' && p.position.x === doorX && p.position.z === 0 && p.position.y === 66)

    expect(doorY1).toBeUndefined()
    expect(doorY2).toBeUndefined()
  })

  it('does not place AIR blocks (interior is left implicit)', () => {
    const structure = makeStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const airBlocks = placements.filter(p => p.blockType === 'AIR')
    expect(airBlocks).toHaveLength(0)
  })

  it('places exactly PLANKS, COBBLESTONE, and WOOD block types', () => {
    const structure = makeStructure({ type: 'house', size: { x: 6, y: 5, z: 6 } })
    const placements = buildingBlocksForStructure(structure)

    const blockTypes = new Set(placements.map(p => p.blockType))
    expect(blockTypes).toEqual(new Set(['PLANKS', 'COBBLESTONE', 'WOOD']))
  })
})

describe('village-builder / farm', () => {
  it('places FARMLAND at anchor.y for all sizeX×sizeZ tiles', () => {
    const structure = makeStructure({ type: 'farm', size: { x: 8, y: 1, z: 8 } })
    const placements = buildingBlocksForStructure(structure)

    const farmland = placements.filter(p => p.blockType === 'FARMLAND' && p.position.y === 64)
    expect(farmland).toHaveLength(8 * 8) // 64
  })

  it('places WHEAT_CROP at anchor.y+1 for rows where dz % 2 === 0', () => {
    const structure = makeStructure({ type: 'farm', size: { x: 8, y: 1, z: 8 } })
    const placements = buildingBlocksForStructure(structure)

    const wheat = placements.filter(p => p.blockType === 'WHEAT_CROP')
    // Rows dz=0,2,4,6 → 4 rows × 8 columns = 32
    expect(wheat).toHaveLength(4 * 8)

    // All wheat must be at anchor.y+1=65
    for (const w of wheat) {
      expect(w.position.y).toBe(65)
    }

    // All wheat must have z offset that is even (dz % 2 === 0)
    for (const w of wheat) {
      const dz = w.position.z - 0
      expect(dz % 2).toBe(0)
    }
  })

  it('places only FARMLAND and WHEAT_CROP block types', () => {
    const structure = makeStructure({ type: 'farm', size: { x: 8, y: 1, z: 8 } })
    const placements = buildingBlocksForStructure(structure)

    const blockTypes = new Set(placements.map(p => p.blockType))
    expect(blockTypes).toEqual(new Set(['FARMLAND', 'WHEAT_CROP']))
  })
})

describe('village-builder / road', () => {
  it('places GRAVEL at anchor.y for all sizeX×sizeZ tiles', () => {
    const structure = makeStructure({ type: 'road', size: { x: 24, y: 1, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    expect(placements).toHaveLength(24 * 3) // 72
    for (const p of placements) {
      expect(p.blockType).toBe('GRAVEL')
      expect(p.position.y).toBe(64)
    }
  })

  it('places only GRAVEL block type', () => {
    const structure = makeStructure({ type: 'road', size: { x: 24, y: 1, z: 3 } })
    const placements = buildingBlocksForStructure(structure)

    const blockTypes = new Set(placements.map(p => p.blockType))
    expect(blockTypes).toEqual(new Set(['GRAVEL']))
  })
})

describe('village-builder / buildingBlocksForVillage', () => {
  it('flattens blocks from multiple structures', () => {
    const well = makeStructure({ type: 'well', size: { x: 3, y: 4, z: 3 } })
    const road = makeStructure({ type: 'road', size: { x: 24, y: 1, z: 3 }, anchor: { x: 0, y: 64, z: 10 } })

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
