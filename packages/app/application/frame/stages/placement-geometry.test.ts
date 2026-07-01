import { describe, expect, it } from 'vitest'
import {
  adjacentToHit,
  buildExplosionBreakPositions,
  buildTntBreakPositions,
} from './placement-geometry'

const hit = (bx: number, by: number, bz: number, nx: number, ny: number, nz: number) => ({
  blockX: bx, blockY: by, blockZ: bz,
  distance: 3,
  normal: { x: nx, y: ny, z: nz },
})

// ─── adjacentToHit ────────────────────────────────────────────────────────────
describe('adjacentToHit', () => {
  it('returns y+1 for a top-face hit (normal 0,1,0)', () => {
    expect(adjacentToHit(hit(5, 64, 3, 0, 1, 0))).toEqual({ x: 5, y: 65, z: 3 })
  })

  it('returns y-1 for a bottom-face hit (normal 0,-1,0)', () => {
    expect(adjacentToHit(hit(5, 64, 3, 0, -1, 0))).toEqual({ x: 5, y: 63, z: 3 })
  })

  it('returns x+1 for a +X-face hit (normal 1,0,0)', () => {
    expect(adjacentToHit(hit(5, 64, 3, 1, 0, 0))).toEqual({ x: 6, y: 64, z: 3 })
  })

  it('returns x-1 for a -X-face hit (normal -1,0,0)', () => {
    expect(adjacentToHit(hit(5, 64, 3, -1, 0, 0))).toEqual({ x: 4, y: 64, z: 3 })
  })

  it('returns z+1 for a +Z-face hit (normal 0,0,1)', () => {
    expect(adjacentToHit(hit(5, 64, 3, 0, 0, 1))).toEqual({ x: 5, y: 64, z: 4 })
  })

  it('returns z-1 for a -Z-face hit (normal 0,0,-1)', () => {
    expect(adjacentToHit(hit(5, 64, 3, 0, 0, -1))).toEqual({ x: 5, y: 64, z: 2 })
  })

  it('rounds non-integer normal components to the nearest axis direction', () => {
    // A slightly off-axis top-face normal should still resolve to y+1
    expect(adjacentToHit(hit(0, 64, 0, 0.05, 0.99, 0.03))).toEqual({ x: 0, y: 65, z: 0 })
  })

  it('returns zero offset when the normal is the zero vector', () => {
    // Degenerate hit — no offset applied
    expect(adjacentToHit(hit(2, 10, 2, 0, 0, 0))).toEqual({ x: 2, y: 10, z: 2 })
  })
})

// ─── buildExplosionBreakPositions ─────────────────────────────────────────────
describe('buildExplosionBreakPositions', () => {
  it('returns only the center block for radius 0', () => {
    const result = buildExplosionBreakPositions({ x: 5, y: 64, z: 3 }, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 5, y: 64, z: 3 })
  })

  it('includes the 6 immediate face-adjacent blocks for radius 1', () => {
    const result = buildExplosionBreakPositions({ x: 0, y: 0, z: 0 }, 1)
    // (0,0,0) + 6 axis-aligned neighbors = 7 positions
    expect(result).toHaveLength(7)
  })

  it('always includes the center position', () => {
    const center = { x: 10, y: 50, z: -5 }
    const result = buildExplosionBreakPositions(center, 3)
    expect(result.some((p) => p.x === center.x && p.y === center.y && p.z === center.z)).toBe(true)
  })

  it('every returned position lies within the Euclidean sphere (distSq ≤ radius²)', () => {
    const center = { x: 0, y: 0, z: 0 }
    const radius = 4
    const result = buildExplosionBreakPositions(center, radius)
    for (const p of result) {
      const distSq = (p.x - center.x) ** 2 + (p.y - center.y) ** 2 + (p.z - center.z) ** 2
      expect(distSq).toBeLessThanOrEqual(radius * radius)
    }
  })

  it('all returned positions are offset relative to the center', () => {
    const center = { x: 7, y: 20, z: -3 }
    const atOrigin = buildExplosionBreakPositions({ x: 0, y: 0, z: 0 }, 2)
    const atCenter = buildExplosionBreakPositions(center, 2)
    expect(atCenter).toHaveLength(atOrigin.length)
    for (let i = 0; i < atOrigin.length; i++) {
      expect(atCenter[i]!.x).toBe(atOrigin[i]!.x + center.x)
      expect(atCenter[i]!.y).toBe(atOrigin[i]!.y + center.y)
      expect(atCenter[i]!.z).toBe(atOrigin[i]!.z + center.z)
    }
  })

  it('excludes the diagonal corners for radius 1 (Euclidean sphere vs box)', () => {
    const result = buildExplosionBreakPositions({ x: 0, y: 0, z: 0 }, 1)
    // A pure box would include corners like (1,1,0) — dist²=2 > 1 → excluded
    const hasCorner = result.some((p) => Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z) > 1)
    expect(hasCorner).toBe(false)
  })
})

// ─── buildTntBreakPositions ───────────────────────────────────────────────────
describe('buildTntBreakPositions', () => {
  it('is an alias for buildExplosionBreakPositions — same reference', () => {
    expect(buildTntBreakPositions).toBe(buildExplosionBreakPositions)
  })
})
