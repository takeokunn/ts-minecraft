import { describe, it } from '@effect/vitest'
import { HashSet, Option } from 'effect'
import { expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'
import {
  blockKey,
  blockTypeFor,
  blockIndexFor,
  chunkCoordsForPosition,
  enqueue,
  floorMod,
  getBlockIndex,
  localX,
  localY,
  localZ,
  maxLevelFor,
  parseKey,
  positionFromChunk,
} from './fluid-position-utils'
import { LAVA_INDEX, LAVA_MAX_LEVEL, WATER_INDEX, WATER_MAX_LEVEL } from './fluid-model'

describe('floorMod', () => {
  it('positive value, positive modulo', () => {
    expect(floorMod(7, 3)).toBe(1)
  })

  it('negative value always returns positive result', () => {
    expect(floorMod(-1, 16)).toBe(15)
  })

  it('zero value returns zero', () => {
    expect(floorMod(0, 16)).toBe(0)
  })

  it('value equals modulo returns zero', () => {
    expect(floorMod(16, 16)).toBe(0)
  })
})

describe('localX / localY / localZ', () => {
  it('localX wraps at chunk boundary: position.x=16 → 0', () => {
    expect(localX({ x: 16, y: 0, z: 0 })).toBe(0)
  })

  it('localX with negative: position.x=-1 → 15', () => {
    expect(localX({ x: -1, y: 0, z: 0 })).toBe(15)
  })

  it('localY floors fractional y', () => {
    expect(localY({ x: 0, y: 10.9, z: 0 })).toBe(10)
  })

  it('localZ wraps at chunk boundary: position.z=16 → 0', () => {
    expect(localZ({ x: 0, y: 0, z: 16 })).toBe(0)
  })

  it('localZ with negative: position.z=-1 → 15', () => {
    expect(localZ({ x: 0, y: 0, z: -1 })).toBe(15)
  })
})

describe('blockKey / parseKey roundtrip', () => {
  it('roundtrip preserves integer coordinates', () => {
    const p = { x: 3, y: 64, z: 7 }
    const parsed = parseKey(blockKey(p))
    expect(parsed.x).toBe(p.x)
    expect(parsed.y).toBe(p.y)
    expect(parsed.z).toBe(p.z)
  })

  it('distinct integer positions produce distinct keys', () => {
    const k1 = blockKey({ x: 0, y: 0, z: 0 })
    const k2 = blockKey({ x: 1, y: 0, z: 0 })
    const k3 = blockKey({ x: 0, y: 1, z: 0 })
    const k4 = blockKey({ x: 0, y: 0, z: 1 })
    expect(k1).not.toBe(k2)
    expect(k1).not.toBe(k3)
    expect(k1).not.toBe(k4)
  })

  it('negative coordinates roundtrip correctly', () => {
    const p = { x: -5, y: 64, z: -3 }
    const parsed = parseKey(blockKey(p))
    expect(parsed.x).toBe(p.x)
    expect(parsed.y).toBe(p.y)
    expect(parsed.z).toBe(p.z)
  })
})

describe('enqueue', () => {
  it('adds the position itself to frontier', () => {
    const pos = { x: 5, y: 10, z: 5 }
    const result = enqueue(HashSet.empty(), pos)
    expect(HashSet.has(result, blockKey(pos))).toBe(true)
  })

  it('adds all 6 neighbors plus the position itself (7 total from empty)', () => {
    const pos = { x: 5, y: 10, z: 5 }
    const result = enqueue(HashSet.empty(), pos)
    expect(HashSet.size(result)).toBe(7)
  })

  it('adding same position twice does not duplicate (HashSet deduplication)', () => {
    const pos = { x: 5, y: 10, z: 5 }
    const once = enqueue(HashSet.empty(), pos)
    const twice = enqueue(once, pos)
    expect(HashSet.size(twice)).toBe(HashSet.size(once))
  })
})

describe('chunkCoordsForPosition', () => {
  it('origin maps to chunk {x:0, z:0}', () => {
    expect(chunkCoordsForPosition({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, z: 0 })
  })

  it('position at x=16 maps to chunk {x:1, z:0}', () => {
    expect(chunkCoordsForPosition({ x: 16, y: 0, z: 0 })).toEqual({ x: 1, z: 0 })
  })

  it('negative position maps to correct negative chunk coords', () => {
    expect(chunkCoordsForPosition({ x: -1, y: 0, z: -1 })).toEqual({ x: -1, z: -1 })
  })
})

describe('positionFromChunk', () => {
  const makeChunk = (cx: number, cz: number) => ({
    coord: { x: cx, z: cz },
    blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
    fluid: Option.none<Uint8Array>(),
  })

  it('idx=0 maps to {x: chunkX*16, y:0, z: chunkZ*16}', () => {
    const chunk = makeChunk(2, 3)
    const pos = positionFromChunk(chunk, 0)
    expect(pos).toEqual({ x: 2 * CHUNK_SIZE, y: 0, z: 3 * CHUNK_SIZE })
  })

  it('idx=1 maps to y=1 (y is innermost dimension)', () => {
    const chunk = makeChunk(0, 0)
    const pos = positionFromChunk(chunk, 1)
    expect(pos.y).toBe(1)
    expect(pos.x).toBe(0)
    expect(pos.z).toBe(0)
  })

  it('idx=CHUNK_HEIGHT maps to z=1 (z is second dimension)', () => {
    const chunk = makeChunk(0, 0)
    const pos = positionFromChunk(chunk, CHUNK_HEIGHT)
    expect(pos.z).toBe(1)
    expect(pos.y).toBe(0)
    expect(pos.x).toBe(0)
  })

  it('positionFromChunk round-trip: position encodes back to the same idx', () => {
    const chunk = makeChunk(0, 0)
    const testIdx = 5 + 3 * CHUNK_HEIGHT + 2 * CHUNK_HEIGHT * CHUNK_SIZE
    const pos = positionFromChunk(chunk, testIdx)
    // localX/localY/localZ then compute index from domain formula: y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE
    const lx = localX(pos)
    const ly = localY(pos)
    const lz = localZ(pos)
    const recomputed = ly + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    expect(recomputed).toBe(testIdx)
  })
})

describe('getBlockIndex', () => {
  it('valid in-chunk position returns non-negative index', () => {
    const idx = getBlockIndex({ x: 4, y: 10, z: 4 })
    expect(idx).toBeGreaterThanOrEqual(0)
  })

  it('position at local chunk origin (localX=0,localY=0,localZ=0) returns 0', () => {
    expect(getBlockIndex({ x: 0, y: 0, z: 0 })).toBe(0)
  })

  it('returns -1 for out-of-bounds y below 0', () => {
    expect(getBlockIndex({ x: 0, y: -1, z: 0 })).toBe(-1)
  })

  it('returns -1 for out-of-bounds y >= CHUNK_HEIGHT', () => {
    expect(getBlockIndex({ x: 0, y: CHUNK_HEIGHT, z: 0 })).toBe(-1)
  })
})

describe('maxLevelFor', () => {
  it('water returns WATER_MAX_LEVEL (7)', () => {
    expect(maxLevelFor('water')).toBe(WATER_MAX_LEVEL)
    expect(maxLevelFor('water')).toBe(7)
  })

  it('lava returns LAVA_MAX_LEVEL (3)', () => {
    expect(maxLevelFor('lava')).toBe(LAVA_MAX_LEVEL)
    expect(maxLevelFor('lava')).toBe(3)
  })
})

describe('blockTypeFor', () => {
  it('lava → LAVA', () => {
    expect(blockTypeFor('lava')).toBe('LAVA')
  })

  it('water → WATER', () => {
    expect(blockTypeFor('water')).toBe('WATER')
  })
})

describe('blockIndexFor', () => {
  it('lava returns LAVA_INDEX (non-negative)', () => {
    expect(blockIndexFor('lava')).toBe(LAVA_INDEX)
    expect(blockIndexFor('lava')).toBeGreaterThanOrEqual(0)
  })

  it('water returns WATER_INDEX (non-negative)', () => {
    expect(blockIndexFor('water')).toBe(WATER_INDEX)
    expect(blockIndexFor('water')).toBeGreaterThanOrEqual(0)
  })

  it('lava and water indices are different', () => {
    expect(blockIndexFor('lava')).not.toBe(blockIndexFor('water'))
  })
})
