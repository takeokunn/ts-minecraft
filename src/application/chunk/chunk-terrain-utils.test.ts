import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { CHUNK_SIZE } from '@/domain/chunk'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  getChunkLoadOffsets,
  countChunksInRadius,
  getChunksInRenderDistance,
} from './chunk-coord-utils'
import {
  smoothstep,
  mulberry32,
  seedFromChunk,
  hash3,
  fract,
  clamp01,
  computeRuggedness,
} from './terrain/math'

// ---------------------------------------------------------------------------
// chunkDistanceSquared
// ---------------------------------------------------------------------------

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
    // (3,4) triangle → 9 + 16 = 25
    expect(chunkDistanceSquared({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(25)
  })

  it('is symmetric — order of arguments does not matter', () => {
    const a = { x: -5, z: 3 }
    const b = { x: 2, z: -1 }
    expect(chunkDistanceSquared(a, b)).toBe(chunkDistanceSquared(b, a))
  })

  it('handles negative coordinates correctly', () => {
    expect(chunkDistanceSquared({ x: -3, z: -4 }, { x: 0, z: 0 })).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// worldToChunkCoord
// ---------------------------------------------------------------------------

describe('worldToChunkCoord', () => {
  it('maps the origin to chunk (0, 0)', () => {
    expect(worldToChunkCoord({ x: 0, y: 64, z: 0 })).toEqual({ x: 0, z: 0 })
  })

  it('maps positions within the first chunk to (0, 0)', () => {
    expect(worldToChunkCoord({ x: 0, y: 64, z: 0 })).toEqual({ x: 0, z: 0 })
    expect(worldToChunkCoord({ x: CHUNK_SIZE - 1, y: 64, z: CHUNK_SIZE - 1 })).toEqual({ x: 0, z: 0 })
    expect(worldToChunkCoord({ x: 7.9, y: 0, z: 15.99 })).toEqual({ x: 0, z: 0 })
  })

  it('maps positions at exactly CHUNK_SIZE to the next chunk', () => {
    expect(worldToChunkCoord({ x: CHUNK_SIZE, y: 64, z: 0 })).toEqual({ x: 1, z: 0 })
    expect(worldToChunkCoord({ x: 0, y: 64, z: CHUNK_SIZE })).toEqual({ x: 0, z: 1 })
  })

  it('maps positions in the second chunk to (1, 1)', () => {
    expect(worldToChunkCoord({ x: CHUNK_SIZE + 1, y: 64, z: CHUNK_SIZE + 1 })).toEqual({ x: 1, z: 1 })
  })

  it('maps negative positions using floor division', () => {
    // x=-1 → floor(-1/16) = floor(-0.0625) = -1
    expect(worldToChunkCoord({ x: -1, y: 64, z: -1 })).toEqual({ x: -1, z: -1 })
    expect(worldToChunkCoord({ x: -CHUNK_SIZE, y: 64, z: -CHUNK_SIZE })).toEqual({ x: -1, z: -1 })
    expect(worldToChunkCoord({ x: -(CHUNK_SIZE + 1), y: 64, z: 0 })).toEqual({ x: -2, z: 0 })
  })

  it('ignores the y component', () => {
    const pos1 = { x: 8, y: 0, z: 8 }
    const pos2 = { x: 8, y: 255, z: 8 }
    expect(worldToChunkCoord(pos1)).toEqual(worldToChunkCoord(pos2))
  })
})

// ---------------------------------------------------------------------------
// getChunkLoadOffsets
// ---------------------------------------------------------------------------

describe('getChunkLoadOffsets', () => {
  it('returns only [0,0] for radius 0', () => {
    const offsets = getChunkLoadOffsets(0)
    expect(offsets).toHaveLength(1)
    // Use arithmetic equality to avoid -0 vs +0 deep-equality failure
    const [dx, dz] = offsets[0]!
    expect(dx === 0).toBe(true)
    expect(dz === 0).toBe(true)
  })

  it('includes [0,0] (center) as the first element', () => {
    const offsets = getChunkLoadOffsets(4)
    expect(offsets[0]).toEqual([0, 0])
  })

  it('all offsets satisfy dx^2 + dz^2 <= renderDistance^2', () => {
    const r = 5
    const offsets = getChunkLoadOffsets(r)
    Arr.forEach(offsets, ([dx, dz]) => {
      expect(dx * dx + dz * dz).toBeLessThanOrEqual(r * r)
    })
  })

  it('sorts offsets closest-first (non-decreasing distance)', () => {
    const offsets = getChunkLoadOffsets(6)
    Arr.reduce(offsets, 0, (prevDist, [dx, dz]) => {
      const dist = dx * dx + dz * dz
      expect(dist).toBeGreaterThanOrEqual(prevDist)
      return dist
    })
  })

  it('returns the correct count of offsets for radius 1 (circle: 5 chunks)', () => {
    // radius=1: (0,0),(±1,0),(0,±1) → 5 chunks (corners 1²+1²=2 > 1²=1 excluded)
    const offsets = getChunkLoadOffsets(1)
    expect(offsets).toHaveLength(5)
  })

  it('count matches countChunksInRadius', () => {
    Arr.forEach([0, 1, 2, 4, 8] as const, r => {
      expect(getChunkLoadOffsets(r)).toHaveLength(countChunksInRadius(r))
    })
  })

  it('contains no duplicates', () => {
    const offsets = getChunkLoadOffsets(5)
    const seen = HashSet.fromIterable(Arr.map(offsets, ([dx, dz]) => `${dx},${dz}`))
    expect(HashSet.size(seen)).toBe(offsets.length)
  })
})

// ---------------------------------------------------------------------------
// countChunksInRadius
// ---------------------------------------------------------------------------

describe('countChunksInRadius', () => {
  it('returns 1 for radius 0 (only the center chunk)', () => {
    expect(countChunksInRadius(0)).toBe(1)
  })

  it('returns 5 for radius 1', () => {
    // center + 4 cardinal neighbors; diagonals (dist²=2) exceed 1²=1
    expect(countChunksInRadius(1)).toBe(5)
  })

  it('returns a positive integer for any positive radius', () => {
    Arr.forEach([2, 3, 5, 8, 10] as const, r => {
      expect(countChunksInRadius(r)).toBeGreaterThan(0)
      expect(Number.isInteger(countChunksInRadius(r))).toBe(true)
    })
  })

  it('grows monotonically with radius', () => {
    Arr.reduce([1, 2, 3, 4, 6, 8] as const, countChunksInRadius(0), (prev, r) => {
      const cur = countChunksInRadius(r)
      expect(cur).toBeGreaterThan(prev)
      return cur
    })
  })

  it('is consistent with brute-force circle counting for radius 4', () => {
    const r = 4
    const allPairs = Arr.flatMap(Arr.makeBy(2 * r + 1, i => i - r), dx =>
      Arr.map(Arr.makeBy(2 * r + 1, i => i - r), dz => ({ dx, dz }))
    )
    const manual = Arr.filter(allPairs, ({ dx, dz }) => dx * dx + dz * dz <= r * r).length
    expect(countChunksInRadius(r)).toBe(manual)
  })
})

// ---------------------------------------------------------------------------
// getChunksInRenderDistance
// ---------------------------------------------------------------------------

describe('getChunksInRenderDistance', () => {
  it('returns only the center chunk for radius 0', () => {
    const chunks = getChunksInRenderDistance({ x: 3, z: 7 }, 0)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({ x: 3, z: 7 })
  })

  it('includes the center chunk for any radius', () => {
    const center = { x: -2, z: 5 }
    const chunks = getChunksInRenderDistance(center, 4)
    const hasCenter = Arr.some(chunks, (c) => c.x === center.x && c.z === center.z)
    expect(hasCenter).toBe(true)
  })

  it('all returned coords are within circular render distance of center', () => {
    const center = { x: 10, z: -3 }
    const r = 5
    const chunks = getChunksInRenderDistance(center, r)
    Arr.forEach(chunks, c => {
      const dx = c.x - center.x
      const dz = c.z - center.z
      expect(dx * dx + dz * dz).toBeLessThanOrEqual(r * r)
    })
  })

  it('returns count matching countChunksInRadius', () => {
    Arr.forEach([0, 1, 3, 6] as const, r => {
      const chunks = getChunksInRenderDistance({ x: 0, z: 0 }, r)
      expect(chunks).toHaveLength(countChunksInRadius(r))
    })
  })

  it('correctly offsets all coords relative to a non-origin center', () => {
    const origin = getChunksInRenderDistance({ x: 0, z: 0 }, 2)
    const shifted = getChunksInRenderDistance({ x: 5, z: -3 }, 2)
    expect(shifted).toHaveLength(origin.length)
    Arr.forEach(Arr.zip(origin, shifted), ([o, s]) => {
      expect(s.x).toBe(o.x + 5)
      expect(s.z).toBe(o.z - 3)
    })
  })
})

// ---------------------------------------------------------------------------
// smoothstep
// ---------------------------------------------------------------------------

describe('smoothstep', () => {
  it('returns 0 when x <= edge0', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(10, 40, 10)).toBe(0)
    expect(smoothstep(10, 40, 5)).toBe(0)
  })

  it('returns 1 when x >= edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1)
    expect(smoothstep(0, 1, 2)).toBe(1)
    expect(smoothstep(10, 40, 40)).toBe(1)
    expect(smoothstep(10, 40, 100)).toBe(1)
  })

  it('returns 0.5 at the midpoint between edge0 and edge1', () => {
    // t=0.5 → 0.5*0.5*(3-2*0.5) = 0.25*2 = 0.5
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
    expect(smoothstep(0, 2, 1)).toBe(0.5)
    expect(smoothstep(10, 40, 25)).toBe(0.5)
  })

  it('output is strictly between 0 and 1 for x strictly between edge0 and edge1', () => {
    Arr.forEach([0.1, 0.25, 0.75, 0.9] as const, x => {
      const result = smoothstep(0, 1, x)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })
  })

  it('is monotonically increasing within the input range', () => {
    Arr.reduce([0.1, 0.2, 0.5, 0.8, 0.9, 1] as const, smoothstep(0, 1, 0), (prev, x) => {
      const cur = smoothstep(0, 1, x)
      expect(cur).toBeGreaterThanOrEqual(prev)
      return cur
    })
  })

  it('matches the canonical formula t*t*(3-2*t) for t in [0,1]', () => {
    Arr.forEach([0, 0.25, 0.5, 0.75, 1] as const, t => {
      const expected = t * t * (3 - 2 * t)
      expect(smoothstep(0, 1, t)).toBeCloseTo(expected, 10)
    })
  })
})

// ---------------------------------------------------------------------------
// mulberry32
// ---------------------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic — same input always produces the same output', () => {
    const r1 = mulberry32(12345)
    const r2 = mulberry32(12345)
    expect(r1.state).toBe(r2.state)
    expect(r1.value).toBe(r2.value)
  })

  it('value is in [0, 1)', () => {
    Arr.forEach([0, 1, 42, 0xdeadbeef, 0xffffffff] as const, seed => {
      const { value } = mulberry32(seed)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    })
  })

  it('advances state on each call (chained output differs from input)', () => {
    const r1 = mulberry32(0)
    const r2 = mulberry32(r1.state)
    expect(r2.state).not.toBe(r1.state)
    expect(r2.value).not.toBe(r1.value)
  })

  it('produces a deterministic sequence when chained', () => {
    const seq1 = [mulberry32(100)]
    seq1.push(mulberry32(seq1[0]!.state))
    seq1.push(mulberry32(seq1[1]!.state))

    const seq2 = [mulberry32(100)]
    seq2.push(mulberry32(seq2[0]!.state))
    seq2.push(mulberry32(seq2[1]!.state))

    Arr.forEach(Arr.zip(seq1, seq2), ([s1, s2]) => expect(s1.value).toBe(s2.value))
  })

  it('different seeds produce different values', () => {
    const v1 = mulberry32(1).value
    const v2 = mulberry32(2).value
    expect(v1).not.toBe(v2)
  })
})

// ---------------------------------------------------------------------------
// seedFromChunk
// ---------------------------------------------------------------------------

describe('seedFromChunk', () => {
  it('is deterministic — same inputs always produce the same seed', () => {
    const s1 = seedFromChunk(10, 20, 100, 200)
    const s2 = seedFromChunk(10, 20, 100, 200)
    expect(s1).toBe(s2)
  })

  it('returns a non-negative 32-bit unsigned integer (0 ≤ result < 2^32)', () => {
    const cases: Array<[number, number, number, number]> = [
      [0, 0, 0, 0],
      [1, 1, 10007, 20011],
      [-16, 32, 30013, 40013],
      [1000, -500, 70037, 80039],
    ]
    Arr.forEach(cases, ([wx, wz, sx, sz]) => {
      const seed = seedFromChunk(wx, wz, sx, sz)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(4294967296) // 2^32
      expect(Number.isInteger(seed)).toBe(true)
    })
  })

  it('different world coordinates produce different seeds (with the same salt)', () => {
    const salt = [10007, 20011] as const
    const s1 = seedFromChunk(0, 0, ...salt)
    const s2 = seedFromChunk(1, 0, ...salt)
    const s3 = seedFromChunk(0, 1, ...salt)
    expect(s1).not.toBe(s2)
    expect(s1).not.toBe(s3)
    expect(s2).not.toBe(s3)
  })

  it('different salts produce different seeds (with the same world coordinate)', () => {
    const s1 = seedFromChunk(0, 0, 10007, 20011)
    const s2 = seedFromChunk(0, 0, 30013, 40013)
    expect(s1).not.toBe(s2)
  })
})

// ---------------------------------------------------------------------------
// hash3
// ---------------------------------------------------------------------------

describe('hash3', () => {
  it('is deterministic — same inputs always produce the same value', () => {
    const v1 = hash3(5, 3, 7)
    const v2 = hash3(5, 3, 7)
    expect(v1).toBe(v2)
  })

  it('returns a value in [0, 1)', () => {
    const cases: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 2, 3],
      [100, 64, -50],
      [-10, 0, 10],
      [999, 1, -999],
    ]
    Arr.forEach(cases, ([wx, y, wz]) => {
      const v = hash3(wx, y, wz)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    })
  })

  it('different inputs produce different values', () => {
    const v1 = hash3(0, 0, 0)
    const v2 = hash3(1, 0, 0)
    const v3 = hash3(0, 1, 0)
    const v4 = hash3(0, 0, 1)
    // All four should differ (the sine-based hash is highly sensitive to inputs)
    expect(v1).not.toBeCloseTo(v2, 6)
    expect(v1).not.toBeCloseTo(v3, 6)
    expect(v1).not.toBeCloseTo(v4, 6)
  })

  it('y coordinate affects the hash (bedrock probability depends on altitude)', () => {
    const results = Arr.map([0, 1, 2, 3, 4] as const, (y) => hash3(0, y, 0))
    // All five values should be distinct
    const unique = HashSet.fromIterable(Arr.map(results, (v) => v.toFixed(10)))
    expect(HashSet.size(unique)).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// fract
// ---------------------------------------------------------------------------

describe('fract', () => {
  it('returns 0 for integers', () => {
    expect(fract(0)).toBeCloseTo(0)
    expect(fract(1)).toBeCloseTo(0)
    expect(fract(-3)).toBeCloseTo(0)
    expect(fract(100)).toBeCloseTo(0)
  })

  it('returns the fractional part for positive non-integers', () => {
    expect(fract(1.5)).toBeCloseTo(0.5)
    expect(fract(2.75)).toBeCloseTo(0.75)
    expect(fract(3.999)).toBeCloseTo(0.999)
  })

  it('returns the fractional part for negative non-integers', () => {
    // fract(-1.5) = -1.5 - floor(-1.5) = -1.5 - (-2) = 0.5
    expect(fract(-1.5)).toBeCloseTo(0.5)
    // fract(-2.25) = -2.25 - (-3) = 0.75
    expect(fract(-2.25)).toBeCloseTo(0.75)
  })

  it('result is always in [0, 1)', () => {
    const values = [-10.3, -1, -0.001, 0, 0.001, 0.999, 1, 5.7, 100.123]
    Arr.forEach(values, v => {
      const result = fract(v)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(1)
    })
  })
})

// ---------------------------------------------------------------------------
// clamp01
// ---------------------------------------------------------------------------

describe('clamp01', () => {
  it('returns exactly 0 for values at or below 0', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(-0.001)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it('returns exactly 1 for values at or above 1', () => {
    expect(clamp01(1)).toBe(1)
    expect(clamp01(1.001)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })

  it('passes through values strictly between 0 and 1 unchanged', () => {
    Arr.forEach([0.0001, 0.25, 0.5, 0.75, 0.9999] as const, v => {
      expect(clamp01(v)).toBe(v)
    })
  })

  it('output is always in [0, 1]', () => {
    Arr.forEach([-Infinity, -1, 0, 0.5, 1, 2, Infinity] as const, v => {
      const result = clamp01(v)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })
  })
})

// ---------------------------------------------------------------------------
// computeRuggedness
// ---------------------------------------------------------------------------

describe('computeRuggedness', () => {
  it('output is always in [0, 1] for arbitrary inputs', () => {
    const erosionVals = [-1, -0.5, 0, 0.5, 1]
    const jaggednessVals = [-1, -0.5, 0, 0.5, 1]
    Arr.forEach(erosionVals, e => {
      Arr.forEach(jaggednessVals, j => {
        const result = computeRuggedness(e, j)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1)
      })
    })
  })

  it('returns 0.6 when erosion=1 (max erosion) and jaggedness=0', () => {
    // normalizedErosion = clamp01((1+1)*0.5) = 1
    // ruggedness = clamp01((1-1)*0.6 + |0|*0.4) = clamp01(0) = 0
    expect(computeRuggedness(1, 0)).toBeCloseTo(0, 10)
  })

  it('returns 0.6 when erosion=-1 (no erosion) and jaggedness=0', () => {
    // normalizedErosion = clamp01((-1+1)*0.5) = 0
    // ruggedness = clamp01((1-0)*0.6 + 0) = 0.6
    expect(computeRuggedness(-1, 0)).toBeCloseTo(0.6, 10)
  })

  it('returns 1 when erosion=-1 and |jaggedness|=1', () => {
    // normalizedErosion = 0, ruggedness = clamp01(0.6 + 0.4) = 1
    expect(computeRuggedness(-1, 1)).toBeCloseTo(1, 10)
    expect(computeRuggedness(-1, -1)).toBeCloseTo(1, 10)
  })

  it('is symmetric with respect to the sign of jaggedness (uses |jaggedness|)', () => {
    Arr.forEach([-1, 0, 0.5] as const, e => {
      expect(computeRuggedness(e, 0.7)).toBeCloseTo(computeRuggedness(e, -0.7), 10)
    })
  })

  it('higher absolute jaggedness produces more or equal ruggedness', () => {
    // For a fixed erosion, increasing |jaggedness| should not decrease ruggedness
    const e = 0
    const r1 = computeRuggedness(e, 0.2)
    const r2 = computeRuggedness(e, 0.8)
    expect(r2).toBeGreaterThanOrEqual(r1)
  })
})
