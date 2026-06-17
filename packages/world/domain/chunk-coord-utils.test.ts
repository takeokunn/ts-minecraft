import { describe, it, expect } from 'vitest'
import * as chunkCoordUtils from './chunk-coord-utils'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  worldToBlockIndex,
  getChunkLoadOffsets,
  countChunksInRadius,
  getChunksInRenderDistance,
  computeChunkPriority,
  DEFAULT_PRIORITY_ALPHA,
  STATIC_VELOCITY_EPSILON_SQUARED,
} from './chunk-coord-utils'
import { CHUNK_SIZE } from '@ts-minecraft/core'

describe('chunkDistanceSquared', () => {
  it('same chunk = 0', () => {
    expect(chunkDistanceSquared({ x: 3, z: 5 }, { x: 3, z: 5 })).toBe(0)
  })
  it('one chunk apart in x = 1', () => {
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 1, z: 0 })).toBe(1)
  })
  it('diagonal = 2', () => {
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 1, z: 1 })).toBe(2)
  })
  it('is symmetric', () => {
    const a = { x: 2, z: -3 }
    const b = { x: -1, z: 4 }
    expect(chunkDistanceSquared(a, b)).toBe(chunkDistanceSquared(b, a))
  })
})

describe('worldToChunkCoord', () => {
  it('origin maps to chunk (0, 0)', () => {
    expect(worldToChunkCoord({ x: 0, y: 64, z: 0 })).toEqual({ x: 0, z: 0 })
  })
  it('position within first chunk stays in chunk (0, 0)', () => {
    expect(worldToChunkCoord({ x: 7, y: 64, z: 7 })).toEqual({ x: 0, z: 0 })
  })
  it('position at exactly CHUNK_SIZE moves to chunk (1, 0)', () => {
    expect(worldToChunkCoord({ x: CHUNK_SIZE, y: 64, z: 0 })).toEqual({ x: 1, z: 0 })
  })
  it('negative x is floor-divided into negative chunk', () => {
    expect(worldToChunkCoord({ x: -1, y: 64, z: 0 })).toEqual({ x: -1, z: 0 })
  })
  it('negative position just inside chunk (-1, 0)', () => {
    expect(worldToChunkCoord({ x: -(CHUNK_SIZE), y: 64, z: 0 })).toEqual({ x: -1, z: 0 })
  })
})

describe('worldPositionFor', () => {
  it('reconstructs world coordinates from chunk and local block position', () => {
    expect(chunkCoordUtils.worldPositionFor({ x: -2, z: 3 }, { lx: 5, y: 12, lz: 7 })).toEqual({
      x: -27,
      y: 12,
      z: 55,
    })
  })

  it('matches worldToBlockIndex for block-aligned positions', () => {
    const position = { x: 31, y: 64, z: -17 }
    const { chunkCoord, lx, ly, lz } = worldToBlockIndex(position)
    expect(chunkCoordUtils.worldPositionFor(chunkCoord, { lx, y: ly, lz })).toEqual(position)
  })
})

describe('worldToBlockIndex', () => {
  it('origin returns chunk (0,0) with local (0,0,0)', () => {
    const result = worldToBlockIndex({ x: 0, y: 64, z: 0 })
    expect(result.chunkCoord).toEqual({ x: 0, z: 0 })
    expect(result.lx).toBe(0)
    expect(result.ly).toBe(64)
    expect(result.lz).toBe(0)
  })

  it('position at CHUNK_SIZE crosses to next chunk', () => {
    const result = worldToBlockIndex({ x: CHUNK_SIZE, y: 64, z: 0 })
    expect(result.chunkCoord).toEqual({ x: 1, z: 0 })
    expect(result.lx).toBe(0)
  })

  it('negative world x wraps local coords to [0, CHUNK_SIZE)', () => {
    const result = worldToBlockIndex({ x: -1, y: 64, z: 0 })
    expect(result.chunkCoord).toEqual({ x: -1, z: 0 })
    expect(result.lx).toBe(CHUNK_SIZE - 1)
  })

  it('coordKey is formatted as "cx,cz"', () => {
    const result = worldToBlockIndex({ x: CHUNK_SIZE * 2 + 3, y: 64, z: CHUNK_SIZE + 1 })
    expect(result.coordKey).toBe(`2,1`)
  })

  it('lx is always in [0, CHUNK_SIZE)', () => {
    for (const x of [-16, -1, 0, 7, 15, 16, 100]) {
      const { lx } = worldToBlockIndex({ x, y: 64, z: 0 })
      expect(lx).toBeGreaterThanOrEqual(0)
      expect(lx).toBeLessThan(CHUNK_SIZE)
    }
  })
})

describe('getChunkLoadOffsets', () => {
  it('for radius 1, the first offset is (0, 0) (center chunk first)', () => {
    const offsets = getChunkLoadOffsets(1)
    expect(offsets[0]).toEqual([0, 0])
  })

  it('all offsets are within the radius circle', () => {
    const r = 3
    const offsets = getChunkLoadOffsets(r)
    for (const [dx, dz] of offsets) {
      expect(dx * dx + dz * dz).toBeLessThanOrEqual(r * r)
    }
  })

  it('returns the same reference on repeated calls (cached)', () => {
    const a = getChunkLoadOffsets(2)
    const b = getChunkLoadOffsets(2)
    expect(a).toBe(b)
  })

  it('sorted by distance from origin (non-decreasing)', () => {
    const offsets = getChunkLoadOffsets(4)
    let prevDist = 0
    for (const [dx, dz] of offsets) {
      const d = dx * dx + dz * dz
      expect(d).toBeGreaterThanOrEqual(prevDist)
      prevDist = d
    }
  })
})

describe('countChunksInRadius', () => {
  it('radius 0 = 1 chunk (just the center)', () => {
    expect(countChunksInRadius(0)).toBe(1)
  })
  it('radius 1 = 5 chunks (center + 4 cardinal)', () => {
    expect(countChunksInRadius(1)).toBe(5)
  })
  it('count matches getChunkLoadOffsets length', () => {
    for (const r of [1, 2, 3, 4]) {
      expect(countChunksInRadius(r)).toBe(getChunkLoadOffsets(r).length)
    }
  })
  it('count grows monotonically with radius', () => {
    let prev = 0
    for (let r = 0; r <= 5; r++) {
      const count = countChunksInRadius(r)
      expect(count).toBeGreaterThanOrEqual(prev)
      prev = count
    }
  })
})

describe('getChunksInRenderDistance', () => {
  it('always includes the center chunk', () => {
    const center = { x: 5, z: -3 }
    const chunks = getChunksInRenderDistance(center, 2)
    expect(chunks.some((c) => c.x === center.x && c.z === center.z)).toBe(true)
  })
  it('count matches countChunksInRadius', () => {
    expect(getChunksInRenderDistance({ x: 0, z: 0 }, 3)).toHaveLength(countChunksInRadius(3))
  })
})

describe('computeChunkPriority', () => {
  const player = { x: 0, z: 0 }
  const forward = { vx: 0, vz: 1 }

  it('chunk at player position = 0', () => {
    expect(computeChunkPriority(player, player, forward)).toBe(0)
  })

  it('falls back to pure distance when velocity is below epsilon', () => {
    const chunk = { x: 3, z: 4 }
    const noVel = { vx: 0, vz: 0 }
    expect(computeChunkPriority(chunk, player, noVel)).toBe(3 * 3 + 4 * 4)
  })

  it('chunk ahead has lower priority value than chunk behind', () => {
    const ahead = { x: 0, z: 2 }
    const behind = { x: 0, z: -2 }
    const priorityAhead = computeChunkPriority(ahead, player, forward)
    const priorityBehind = computeChunkPriority(behind, player, forward)
    expect(priorityAhead).toBeLessThan(priorityBehind)
  })

  it('perpendicular chunks have intermediate priority', () => {
    const ahead = { x: 0, z: 2 }
    const side = { x: 2, z: 0 }
    const behind = { x: 0, z: -2 }
    const pAhead = computeChunkPriority(ahead, player, forward)
    const pSide = computeChunkPriority(side, player, forward)
    const pBehind = computeChunkPriority(behind, player, forward)
    expect(pAhead).toBeLessThan(pSide)
    expect(pSide).toBeLessThan(pBehind)
  })

  it('alpha=0 gives pure distance ordering', () => {
    const chunk = { x: 3, z: 0 }
    const priority = computeChunkPriority(chunk, player, forward, 0)
    expect(priority).toBeCloseTo(chunkDistanceSquared(chunk, player))
  })

  it('DEFAULT_PRIORITY_ALPHA constant is 0.5', () => {
    expect(DEFAULT_PRIORITY_ALPHA).toBe(0.5)
  })

  it('STATIC_VELOCITY_EPSILON_SQUARED is very small', () => {
    expect(STATIC_VELOCITY_EPSILON_SQUARED).toBeLessThan(0.001)
  })
})
