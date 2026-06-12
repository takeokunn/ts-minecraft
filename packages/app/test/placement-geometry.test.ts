import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { adjacentToHit, buildTntBreakPositions } from '../application/frame/stages/placement-geometry'

// ─── adjacentToHit ────────────────────────────────────────────────────────────

describe('adjacentToHit', () => {
  const hit = (blockX: number, blockY: number, blockZ: number, nx: number, ny: number, nz: number) => ({
    blockX, blockY, blockZ, distance: 2,
    normal: { x: nx, y: ny, z: nz },
  })

  it('top face (+Y normal) places one block above the hit', () => {
    const result = adjacentToHit(hit(5, 64, 3, 0, 1, 0))
    expect(result).toEqual({ x: 5, y: 65, z: 3 })
  })

  it('bottom face (-Y normal) places one block below the hit', () => {
    const result = adjacentToHit(hit(5, 64, 3, 0, -1, 0))
    expect(result).toEqual({ x: 5, y: 63, z: 3 })
  })

  it('+X normal places one block to the right', () => {
    const result = adjacentToHit(hit(0, 64, 0, 1, 0, 0))
    expect(result).toEqual({ x: 1, y: 64, z: 0 })
  })

  it('-X normal places one block to the left', () => {
    const result = adjacentToHit(hit(0, 64, 0, -1, 0, 0))
    expect(result).toEqual({ x: -1, y: 64, z: 0 })
  })

  it('+Z normal places one block forward', () => {
    const result = adjacentToHit(hit(3, 64, 7, 0, 0, 1))
    expect(result).toEqual({ x: 3, y: 64, z: 8 })
  })

  it('-Z normal places one block backward', () => {
    const result = adjacentToHit(hit(3, 64, 7, 0, 0, -1))
    expect(result).toEqual({ x: 3, y: 64, z: 6 })
  })

  it('floating-point normals round to nearest integer offset', () => {
    // e.g. normal.x=0.9999 should round to 1
    const result = adjacentToHit(hit(2, 64, 5, 0.9999, 0, 0))
    expect(result).toEqual({ x: 3, y: 64, z: 5 })
  })
})

// ─── buildTntBreakPositions ───────────────────────────────────────────────────

describe('buildTntBreakPositions', () => {
  const center = { x: 0, y: 64, z: 0 }

  it('radius=0 returns only the center block', () => {
    const positions = buildTntBreakPositions(center, 0)
    expect(positions).toHaveLength(1)
    expect(positions[0]).toEqual(center)
  })

  it('all returned positions are within the given Euclidean radius', () => {
    const radius = 3
    const positions = buildTntBreakPositions(center, radius)
    for (const p of positions) {
      const dx = p.x - center.x
      const dy = p.y - center.y
      const dz = p.z - center.z
      expect(dx * dx + dy * dy + dz * dz).toBeLessThanOrEqual(radius * radius)
    }
  })

  it('does not include positions strictly outside the radius', () => {
    const radius = 2
    const positions = buildTntBreakPositions(center, radius)
    for (const p of positions) {
      const dx = p.x - center.x
      const dy = p.y - center.y
      const dz = p.z - center.z
      const distSq = dx * dx + dy * dy + dz * dz
      expect(distSq).toBeLessThanOrEqual(radius * radius)
    }
  })

  it('center block is always included', () => {
    const positions = buildTntBreakPositions(center, 3)
    expect(positions.some((p) => p.x === center.x && p.y === center.y && p.z === center.z)).toBe(true)
  })

  it('count grows with radius (radius=4 has more blocks than radius=2)', () => {
    const small = buildTntBreakPositions(center, 2)
    const large = buildTntBreakPositions(center, 4)
    expect(large.length).toBeGreaterThan(small.length)
  })

  it('works with non-origin center', () => {
    const offset = { x: 10, y: 64, z: -5 }
    const positions = buildTntBreakPositions(offset, 2)
    expect(positions.some((p) => p.x === 10 && p.y === 64 && p.z === -5)).toBe(true)
    for (const p of positions) {
      const dx = p.x - offset.x
      const dy = p.y - offset.y
      const dz = p.z - offset.z
      expect(dx * dx + dy * dy + dz * dz).toBeLessThanOrEqual(4)
    }
  })

  it('radius=4 (TNT_BREAK_RADIUS) produces expected approximate sphere count', () => {
    // A sphere of radius 4 in discrete integer coordinates has ~257 voxels.
    const positions = buildTntBreakPositions(center, 4)
    // Allow ±5 voxels for integer rounding at the shell boundary.
    expect(positions.length).toBeGreaterThan(250)
    expect(positions.length).toBeLessThan(270)
  })
})
