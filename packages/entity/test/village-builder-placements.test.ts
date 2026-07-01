import { describe, expect, it } from 'vitest'
import {
  buildingBlocksForStructure,
  buildingBlocksForVillage,
} from '@ts-minecraft/entity/domain/village/village-builder-placements'
import {
  VillageStructureId,
} from '@ts-minecraft/entity/domain/village/village-model'
import type { VillageStructure } from '@ts-minecraft/entity/domain/village/village-model'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeStructure = (
  type: VillageStructure['type'],
  sx = 4,
  sy = 4,
  sz = 4,
): VillageStructure => ({
  structureId: VillageStructureId.make('s1'),
  type,
  anchor: { x: 0, y: 64, z: 0 },
  size: { x: sx, y: sy, z: sz },
})

// ─── buildingBlocksForStructure ───────────────────────────────────────────────
describe('buildingBlocksForStructure', () => {
  it('returns at least one block for a house', () => {
    const blocks = buildingBlocksForStructure(makeStructure('house'))
    expect(blocks.length).toBeGreaterThan(0)
  })

  it('house floor blocks are PLANKS', () => {
    const blocks = buildingBlocksForStructure(makeStructure('house'))
    const floor = blocks.filter(b => b.position.y === 64) // anchor.y + dy=0
    expect(floor.every(b => b.blockType === 'PLANKS')).toBe(true)
  })

  it('house roof blocks are WOOD', () => {
    const s = makeStructure('house', 4, 4, 4)
    const blocks = buildingBlocksForStructure(s)
    const roof = blocks.filter(b => b.position.y === 64 + s.size.y - 1)
    expect(roof.every(b => b.blockType === 'WOOD')).toBe(true)
    expect(roof.length).toBeGreaterThan(0)
  })

  it('returns blocks for a well', () => {
    const blocks = buildingBlocksForStructure(makeStructure('well', 3, 3, 3))
    expect(blocks.length).toBeGreaterThan(0)
    // Well always places a WATER block at its center
    const water = blocks.filter(b => b.blockType === 'WATER')
    expect(water.length).toBe(1)
  })

  it('returns farm blocks with FARMLAND', () => {
    const blocks = buildingBlocksForStructure(makeStructure('farm', 4, 2, 4))
    const farmland = blocks.filter(b => b.blockType === 'FARMLAND')
    expect(farmland.length).toBeGreaterThan(0)
  })

  it('returns road blocks with GRAVEL', () => {
    const blocks = buildingBlocksForStructure(makeStructure('road', 3, 1, 6))
    expect(blocks.every(b => b.blockType === 'GRAVEL')).toBe(true)
    expect(blocks.length).toBe(3 * 6) // sizeX * sizeZ
  })
})

// ─── buildingBlocksForVillage ─────────────────────────────────────────────────
describe('buildingBlocksForVillage', () => {
  it('returns an empty array for no structures', () => {
    expect(buildingBlocksForVillage([])).toHaveLength(0)
  })

  it('combines blocks from multiple structures', () => {
    const road = makeStructure('road', 2, 1, 4)
    const house = makeStructure('house', 4, 3, 4)
    const blocks = buildingBlocksForVillage([road, house])
    const roadBlocks = buildingBlocksForStructure(road)
    const houseBlocks = buildingBlocksForStructure(house)
    expect(blocks.length).toBe(roadBlocks.length + houseBlocks.length)
  })
})
