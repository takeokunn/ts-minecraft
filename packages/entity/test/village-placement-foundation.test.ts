import { describe, expect, it } from 'vitest'
import { buildFoundationPlacementsFromFootprint } from '@ts-minecraft/entity/application/village/village-placement-foundation'
import type { VillageFoundationFootprintCell } from '@ts-minecraft/entity/application/village/village-placement-foundation-types'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const cell = (x: number, z: number, surfaceY: number): VillageFoundationFootprintCell => ({ x, z, surfaceY })

// ─── buildFoundationPlacementsFromFootprint ───────────────────────────────────

describe('buildFoundationPlacementsFromFootprint', () => {
  it('returns empty when there are no footprint cells', () => {
    expect(buildFoundationPlacementsFromFootprint([], 64)).toHaveLength(0)
  })

  it('returns empty when surface is already at floorY (no fill needed)', () => {
    // surfaceY = 63 → fillBottom = 64 = floorY → no blocks to place
    const result = buildFoundationPlacementsFromFootprint([cell(0, 0, 63)], 64)
    expect(result).toHaveLength(0)
  })

  it('fills COBBLESTONE blocks from surface+1 up to floorY-1', () => {
    // surfaceY=60, floorY=64 → fill y=61,62,63 (3 blocks)
    const result = buildFoundationPlacementsFromFootprint([cell(10, 20, 60)], 64)
    expect(result).toHaveLength(3)
    expect(result.every(b => b.blockType === 'COBBLESTONE')).toBe(true)
    expect(result.map(b => b.position.y).sort((a, b) => a - b)).toEqual([61, 62, 63])
    expect(result[0]!.position.x).toBe(10)
    expect(result[0]!.position.z).toBe(20)
  })

  it('skips cells with surfaceY < 0 (below world boundary)', () => {
    const result = buildFoundationPlacementsFromFootprint([cell(0, 0, -1)], 64)
    expect(result).toHaveLength(0)
  })

  it('combines placements from multiple cells', () => {
    const cells = [cell(0, 0, 62), cell(1, 0, 62)] // each needs 1 fill block at y=63
    const result = buildFoundationPlacementsFromFootprint(cells, 64)
    expect(result).toHaveLength(2)
  })

  it('caps fill depth at VILLAGE_FOUNDATION_MAX_DEPTH=12', () => {
    // surfaceY=10, floorY=64 → raw depth=54; capped: fillBottom = max(11, 64-12=52) = 52
    // so fill from y=52..63 = 12 blocks
    const result = buildFoundationPlacementsFromFootprint([cell(0, 0, 10)], 64)
    expect(result).toHaveLength(12)
    expect(result.map(b => b.position.y).sort((a, b) => a - b)[0]).toBe(52)
  })
})
