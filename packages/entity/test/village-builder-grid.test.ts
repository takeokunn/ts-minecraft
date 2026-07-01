import { describe, expect, it, vi } from 'vitest'
import {
  appendSquareCells,
  appendSquareLayer,
  createBlockPlacement,
} from '@ts-minecraft/entity/domain/village/village-builder-grid'

// ─── createBlockPlacement ─────────────────────────────────────────────────────
describe('createBlockPlacement', () => {
  it('adds dx/dy/dz offsets to the anchor position', () => {
    const anchor = { x: 10, y: 64, z: 20 }
    const placement = createBlockPlacement(anchor, 2, 1, 3, 'STONE')
    expect(placement.position).toEqual({ x: 12, y: 65, z: 23 })
    expect(placement.blockType).toBe('STONE')
  })

  it('handles zero offsets (placement at anchor itself)', () => {
    const anchor = { x: 5, y: 70, z: 5 }
    const placement = createBlockPlacement(anchor, 0, 0, 0, 'DIRT')
    expect(placement.position).toEqual(anchor)
  })

  it('handles negative offsets', () => {
    const anchor = { x: 0, y: 64, z: 0 }
    const placement = createBlockPlacement(anchor, -1, -2, -3, 'OAK_PLANK')
    expect(placement.position).toEqual({ x: -1, y: 62, z: -3 })
  })
})

// ─── appendSquareCells ────────────────────────────────────────────────────────
describe('appendSquareCells', () => {
  it('visits all (dx, dz) pairs for a 2×3 grid', () => {
    const visited: Array<[number, number]> = []
    appendSquareCells(2, 3, (dx, dz) => visited.push([dx, dz]))
    expect(visited).toHaveLength(6)
    expect(visited).toContainEqual([0, 0])
    expect(visited).toContainEqual([1, 2])
  })

  it('visits nothing for a 0×0 grid', () => {
    const fn = vi.fn()
    appendSquareCells(0, 0, fn)
    expect(fn).not.toHaveBeenCalled()
  })

  it('iterates dx in the outer loop (row-major)', () => {
    const first: [number, number][] = []
    appendSquareCells(2, 2, (dx, dz) => first.push([dx, dz]))
    // dx=0 should appear before dx=1
    const firstDx1 = first.findIndex(([dx]) => dx === 1)
    const lastDx0 = first.map(([dx]) => dx).lastIndexOf(0)
    expect(firstDx1).toBeGreaterThan(lastDx0)
  })
})

// ─── appendSquareLayer ────────────────────────────────────────────────────────
describe('appendSquareLayer', () => {
  it('appends sizeX * sizeZ placements with the given blockType and dy', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    const anchor = { x: 0, y: 64, z: 0 }
    appendSquareLayer(result, anchor, 2, 2, 0, 'GRASS_BLOCK')
    expect(result).toHaveLength(4)
    expect(result.every(p => p.blockType === 'GRASS_BLOCK')).toBe(true)
  })

  it('skips cells where shouldSkip returns true', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    const anchor = { x: 0, y: 64, z: 0 }
    // skip the centre cell (dx=1, dz=1) of a 3×3 layer
    appendSquareLayer(result, anchor, 3, 3, 0, 'STONE', (dx, dz) => dx === 1 && dz === 1)
    expect(result).toHaveLength(8) // 9 - 1
  })

  it('includes all cells when no shouldSkip is provided', () => {
    const result: ReturnType<typeof createBlockPlacement>[] = []
    appendSquareLayer(result, { x: 0, y: 64, z: 0 }, 1, 1, 3, 'OAK_LOG')
    expect(result).toHaveLength(1)
    expect(result[0]!.position.y).toBe(67) // 64 + dy=3
  })
})
