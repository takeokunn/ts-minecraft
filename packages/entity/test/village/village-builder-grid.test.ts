import { describe, expect, it } from 'vitest'
import {
  appendSquareCells,
  appendSquareLayer,
  createBlockPlacement,
} from '@ts-minecraft/entity/domain/village/village-builder-grid'

const anchor = (x: number, y: number, z: number) => ({ x, y, z })

// ─── createBlockPlacement ─────────────────────────────────────────────────────
describe('createBlockPlacement', () => {
  it('offsets position by dx/dy/dz from anchor', () => {
    const result = createBlockPlacement(anchor(10, 64, -5), 2, 1, 3, 'STONE')
    expect(result.position).toEqual({ x: 12, y: 65, z: -2 })
  })

  it('preserves the given blockType', () => {
    const result = createBlockPlacement(anchor(0, 0, 0), 0, 0, 0, 'PLANKS')
    expect(result.blockType).toBe('PLANKS')
  })

  it('zero deltas return the anchor position', () => {
    const result = createBlockPlacement(anchor(5, 3, 7), 0, 0, 0, 'COBBLESTONE')
    expect(result.position).toEqual({ x: 5, y: 3, z: 7 })
  })

  it('supports negative deltas', () => {
    const result = createBlockPlacement(anchor(0, 64, 0), -1, -2, -3, 'DIRT')
    expect(result.position).toEqual({ x: -1, y: 62, z: -3 })
  })
})

// ─── appendSquareCells ────────────────────────────────────────────────────────
describe('appendSquareCells', () => {
  it('calls visitCell exactly sizeX × sizeZ times', () => {
    const visited: Array<[number, number]> = []
    appendSquareCells(3, 4, (dx, dz) => visited.push([dx, dz]))
    expect(visited).toHaveLength(12)
  })

  it('covers all dx in [0, sizeX-1] and dz in [0, sizeZ-1]', () => {
    const visited = new Set<string>()
    appendSquareCells(2, 3, (dx, dz) => visited.add(`${dx},${dz}`))
    for (let dx = 0; dx < 2; dx++) {
      for (let dz = 0; dz < 3; dz++) {
        expect(visited.has(`${dx},${dz}`)).toBe(true)
      }
    }
  })

  it('produces zero calls when sizeX is 0', () => {
    const calls: number[] = []
    appendSquareCells(0, 5, () => calls.push(1))
    expect(calls).toHaveLength(0)
  })

  it('produces zero calls when sizeZ is 0', () => {
    const calls: number[] = []
    appendSquareCells(5, 0, () => calls.push(1))
    expect(calls).toHaveLength(0)
  })
})

// ─── appendSquareLayer ────────────────────────────────────────────────────────
describe('appendSquareLayer', () => {
  it('pushes sizeX × sizeZ blocks with no skip predicate', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    appendSquareLayer(result, anchor(0, 0, 0), 3, 3, 0, 'WOOD')
    expect(result).toHaveLength(9)
  })

  it('applies the anchor offset + dy to all pushed positions', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    appendSquareLayer(result, anchor(10, 5, 20), 1, 1, 3, 'STONE')
    expect(result).toHaveLength(1)
    expect(result[0]!.position).toEqual({ x: 10, y: 8, z: 20 })
  })

  it('skips cells where shouldSkip returns true', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    // 3×3 grid, skip center (dx=1, dz=1)
    appendSquareLayer(result, anchor(0, 0, 0), 3, 3, 0, 'COBBLESTONE', (dx, dz) => dx === 1 && dz === 1)
    expect(result).toHaveLength(8)
    const hasCenter = result.some((b) => b.position.x === 1 && b.position.z === 1)
    expect(hasCenter).toBe(false)
  })

  it('pushes nothing when shouldSkip always returns true', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    appendSquareLayer(result, anchor(0, 0, 0), 2, 2, 0, 'STONE', () => true)
    expect(result).toHaveLength(0)
  })

  it('sets the correct blockType for all pushed blocks', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    appendSquareLayer(result, anchor(0, 0, 0), 2, 2, 0, 'FARMLAND')
    expect(result.every((b) => b.blockType === 'FARMLAND')).toBe(true)
  })

  it('appends to an existing result array without clearing it', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    appendSquareLayer(result, anchor(0, 0, 0), 2, 2, 0, 'DIRT')
    appendSquareLayer(result, anchor(0, 0, 0), 2, 2, 1, 'GRASS')
    expect(result).toHaveLength(8)
    expect(result.filter((b) => b.blockType === 'DIRT')).toHaveLength(4)
    expect(result.filter((b) => b.blockType === 'GRASS')).toHaveLength(4)
  })
})
