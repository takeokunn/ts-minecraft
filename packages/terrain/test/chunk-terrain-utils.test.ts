import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  getChunkLoadOffsets,
  countChunksInRadius,
  getChunksInRenderDistance,
} from '@ts-minecraft/terrain'

describe('chunkDistanceSquared', () => {
  it('returns 0 for identical coordinates', () => {
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(0)
    expect(chunkDistanceSquared({ x: 5, z: -3 }, { x: 5, z: -3 })).toBe(0)
  })

  it('returns squared distance along x axis', () => {
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 3, z: 0 })).toBe(9)
    expect(chunkDistanceSquared({ x: -2, z: 0 }, { x: 1, z: 0 })).toBe(9)
  })

  it('returns squared distance along z axis', () => {
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 0, z: 4 })).toBe(16)
  })

  it('returns squared distance on both axes (Pythagorean)', () => {
    // 3² + 4² = 25
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(25)
  })

  it('is symmetric — order of arguments does not matter', () => {
    const a = { x: 2, z: -5 }
    const b = { x: -3, z: 1 }
    expect(chunkDistanceSquared(a, b)).toBe(chunkDistanceSquared(b, a))
  })

  it('handles negative coordinates correctly', () => {
    expect(chunkDistanceSquared({ x: -1, z: -1 }, { x: 1, z: 1 })).toBe(8)
    expect(chunkDistanceSquared({ x: -5, z: 3 }, { x: 2, z: -4 })).toBe(98)
  })
})

describe('worldToChunkCoord', () => {
  it('maps the origin to chunk (0, 0)', () => {
    expect(worldToChunkCoord({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, z: 0 })
  })

  it('maps positions within the first chunk to (0, 0)', () => {
    expect(worldToChunkCoord({ x: 1, y: 0, z: 1 })).toEqual({ x: 0, z: 0 })
    expect(worldToChunkCoord({ x: CHUNK_SIZE - 1, y: 0, z: CHUNK_SIZE - 1 })).toEqual({ x: 0, z: 0 })
  })

  it('maps positions at exactly CHUNK_SIZE to the next chunk', () => {
    expect(worldToChunkCoord({ x: CHUNK_SIZE, y: 0, z: 0 })).toEqual({ x: 1, z: 0 })
    expect(worldToChunkCoord({ x: 0, y: 0, z: CHUNK_SIZE })).toEqual({ x: 0, z: 1 })
  })

  it('maps positions in the second chunk to (1, 1)', () => {
    expect(worldToChunkCoord({ x: CHUNK_SIZE + 5, y: 0, z: CHUNK_SIZE + 3 })).toEqual({ x: 1, z: 1 })
  })

  it('maps negative positions using floor division', () => {
    // x=-1 → floor(-1/16) = -1
    expect(worldToChunkCoord({ x: -1, y: 0, z: 0 })).toEqual({ x: -1, z: 0 })
    expect(worldToChunkCoord({ x: -CHUNK_SIZE, y: 0, z: -CHUNK_SIZE })).toEqual({ x: -1, z: -1 })
    expect(worldToChunkCoord({ x: -(CHUNK_SIZE + 1), y: 0, z: 0 })).toEqual({ x: -2, z: 0 })
  })

  it('ignores the y component', () => {
    expect(worldToChunkCoord({ x: 5, y: 100, z: 5 })).toEqual(worldToChunkCoord({ x: 5, y: 0, z: 5 }))
    expect(worldToChunkCoord({ x: 5, y: -50, z: 5 })).toEqual(worldToChunkCoord({ x: 5, y: 0, z: 5 }))
  })
})

describe('getChunkLoadOffsets', () => {
  it('returns only [0,0] for radius 0', () => {
    const offsets = getChunkLoadOffsets(0)
    expect(offsets).toHaveLength(1)
    expect(offsets[0]).toEqual([0, 0])
  })

  it('includes [0,0] (center) as the first element', () => {
    const offsets = getChunkLoadOffsets(2)
    expect(offsets[0]).toEqual([0, 0])
  })

  it('all offsets satisfy dx^2 + dz^2 <= renderDistance^2', () => {
    const radius = 3
    const offsets = getChunkLoadOffsets(radius)
    Arr.forEach(offsets, ([dx, dz]) => {
      expect(dx * dx + dz * dz).toBeLessThanOrEqual(radius * radius)
    })
  })

  it('sorts offsets closest-first (non-decreasing distance)', () => {
    const offsets = getChunkLoadOffsets(4)
    Arr.reduce(offsets, 0, (prevDist, [dx, dz]) => {
      const dist = dx * dx + dz * dz
      expect(dist).toBeGreaterThanOrEqual(prevDist)
      return dist
    })
  })

  it('returns the correct count of offsets for radius 1 (circle: 5 chunks)', () => {
    // radius=1: (0,0),(±1,0),(0,±1) = 5 chunks
    expect(getChunkLoadOffsets(1)).toHaveLength(5)
  })

  it('count matches countChunksInRadius', () => {
    Arr.forEach([0, 1, 2, 3, 5] as const, r => {
      expect(getChunkLoadOffsets(r)).toHaveLength(countChunksInRadius(r))
    })
  })

  it('contains no duplicates', () => {
    const offsets = getChunkLoadOffsets(3)
    const keys = HashSet.fromIterable(Arr.map(offsets, ([dx, dz]) => `${dx},${dz}`))
    expect(HashSet.size(keys)).toBe(offsets.length)
  })
})

describe('countChunksInRadius', () => {
  it('returns 1 for radius 0 (only the center chunk)', () => {
    expect(countChunksInRadius(0)).toBe(1)
  })

  it('returns 5 for radius 1', () => {
    expect(countChunksInRadius(1)).toBe(5)
  })

  it('returns a positive integer for any positive radius', () => {
    Arr.forEach([1, 2, 3, 5, 10] as const, r => {
      const count = countChunksInRadius(r)
      expect(count).toBeGreaterThan(0)
      expect(Number.isInteger(count)).toBe(true)
    })
  })

  it('grows monotonically with radius', () => {
    Arr.reduce([1, 2, 3, 4, 5] as const, countChunksInRadius(0), (prev, r) => {
      const cur = countChunksInRadius(r)
      expect(cur).toBeGreaterThan(prev)
      return cur
    })
  })

  it('is consistent with brute-force circle counting for radius 4', () => {
    const r = 4
    const allDeltas = Arr.flatMap(Arr.makeBy(2 * r + 1, (i) => i - r), (dx) =>
      Arr.makeBy(2 * r + 1, (i) => ({ dx, dz: i - r })),
    )
    const bruteForce = Arr.filter(allDeltas, ({ dx, dz }) => dx * dx + dz * dz <= r * r).length
    expect(countChunksInRadius(r)).toBe(bruteForce)
  })
})

describe('getChunksInRenderDistance', () => {
  it('returns only the center chunk for radius 0', () => {
    const chunks = getChunksInRenderDistance({ x: 0, z: 0 }, 0)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({ x: 0, z: 0 })
  })

  it('includes the center chunk for any radius', () => {
    Arr.forEach([0, 1, 3, 5] as const, r => {
      const chunks = getChunksInRenderDistance({ x: 2, z: -3 }, r)
      const hasCenter = Arr.some(chunks, (c) => c.x === 2 && c.z === -3)
      expect(hasCenter).toBe(true)
    })
  })

  it('all returned coords are within circular render distance of center', () => {
    const center = { x: 5, z: -2 }
    const r = 3
    const chunks = getChunksInRenderDistance(center, r)
    Arr.forEach(chunks, (c) => {
      const dx = c.x - center.x
      const dz = c.z - center.z
      expect(dx * dx + dz * dz).toBeLessThanOrEqual(r * r)
    })
  })

  it('returns count matching countChunksInRadius', () => {
    Arr.forEach([0, 1, 2, 4] as const, r => {
      expect(getChunksInRenderDistance({ x: 0, z: 0 }, r)).toHaveLength(countChunksInRadius(r))
    })
  })

  it('correctly offsets all coords relative to a non-origin center', () => {
    const center = { x: 10, z: -5 }
    const chunks = getChunksInRenderDistance(center, 1)
    // Every chunk in the result should shift by center compared to origin-centered result
    const originChunks = getChunksInRenderDistance({ x: 0, z: 0 }, 1)
    const shiftedOrigin = Arr.map(originChunks, (c) => ({ x: c.x + center.x, z: c.z + center.z }))
    Arr.forEach(shiftedOrigin, (expected) => {
      expect(Arr.some(chunks, (c) => c.x === expected.x && c.z === expected.z)).toBe(true)
    })
  })
})
