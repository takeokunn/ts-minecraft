import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  worldToBlockIndex,
  chunkCoordToKey,
  chunkCoordToWorldKey,
  getChunkLoadOffsets,
  countChunksInRadius,
  getChunksInRenderDistance,
} from '@ts-minecraft/world'

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

describe('chunkCoordToKey', () => {
  it('serializes to the standard "x,z" string format', () => {
    expect(chunkCoordToKey({ x: 0, z: 0 })).toBe('0,0')
    expect(chunkCoordToKey({ x: 5, z: -3 })).toBe('5,-3')
    expect(chunkCoordToKey({ x: -10, z: 7 })).toBe('-10,7')
  })

  it('produces a unique key for different coordinates', () => {
    expect(chunkCoordToKey({ x: 1, z: 2 })).not.toBe(chunkCoordToKey({ x: 2, z: 1 }))
  })

  it('is deterministic for the same input', () => {
    const coord = { x: 3, z: -7 }
    expect(chunkCoordToKey(coord)).toBe(chunkCoordToKey(coord))
  })
})

describe('chunkCoordToWorldKey', () => {
  it('prefixes the world id before the chunk coordinates', () => {
    expect(chunkCoordToWorldKey({ x: 0, z: 0 }, 'world-1')).toBe('world-1:0,0')
    expect(chunkCoordToWorldKey({ x: -2, z: 4 }, 'nether')).toBe('nether:-2,4')
  })

  it('produces different keys for the same coord in different worlds', () => {
    const coord = { x: 5, z: 5 }
    expect(chunkCoordToWorldKey(coord, 'world-1')).not.toBe(chunkCoordToWorldKey(coord, 'world-2'))
  })
})

describe('worldToBlockIndex', () => {
  it('maps (0,0,0) to chunk (0,0) with local coords (0,0,0) and flatIdx 0', () => {
    const r = worldToBlockIndex({ x: 0, y: 0, z: 0 })
    expect(r.chunkCoord).toEqual({ x: 0, z: 0 })
    expect(r.lx).toBe(0)
    expect(r.lz).toBe(0)
    expect(r.ly).toBe(0)
    expect(r.flatIdx).toBe(0)
    expect(r.coordKey).toBe('0,0')
  })

  it('computes local coords correctly for a positive world position', () => {
    // World (20, 64, 20): cx=floor(20/16)=1, lx=20%16=4; cz=1, lz=4
    const r = worldToBlockIndex({ x: 20, y: 64, z: 20 })
    expect(r.chunkCoord).toEqual({ x: 1, z: 1 })
    expect(r.lx).toBe(4)
    expect(r.lz).toBe(4)
    expect(r.ly).toBe(64)
  })

  it('wraps negative x/z correctly (no negative local coords)', () => {
    // World (-1, 0, -1): cx=floor(-1/16)=-1, lx=((-1%16)+16)%16=15; same for z
    const r = worldToBlockIndex({ x: -1, y: 0, z: -1 })
    expect(r.chunkCoord).toEqual({ x: -1, z: -1 })
    expect(r.lx).toBe(15)
    expect(r.lz).toBe(15)
    expect(r.coordKey).toBe('-1,-1')
  })
})
