import { describe, it, expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/world'
import {
  FULL_RECOMPUTE_THRESHOLD,
  inLightBounds,
  lightBufferOrFresh,
  trackTouched,
  packPosLevel,
  unpackX,
  unpackY,
  unpackZ,
  unpackLevel,
  NEIGHBOR_DX,
  NEIGHBOR_DY,
  NEIGHBOR_DZ,
} from '../domain/light-engine-utils'

describe('FULL_RECOMPUTE_THRESHOLD', () => {
  it('is 256', () => {
    expect(FULL_RECOMPUTE_THRESHOLD).toBe(256)
  })
})

describe('inLightBounds', () => {
  it('returns true for valid chunk-local coordinates', () => {
    expect(inLightBounds(0, 0, 0)).toBe(true)
    expect(inLightBounds(CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)).toBe(true)
    expect(inLightBounds(8, 128, 8)).toBe(true)
  })

  it('returns false when lx is out of range', () => {
    expect(inLightBounds(-1, 0, 0)).toBe(false)
    expect(inLightBounds(CHUNK_SIZE, 0, 0)).toBe(false)
  })

  it('returns false when y is out of range', () => {
    expect(inLightBounds(0, -1, 0)).toBe(false)
    expect(inLightBounds(0, CHUNK_HEIGHT, 0)).toBe(false)
  })

  it('returns false when lz is out of range', () => {
    expect(inLightBounds(0, 0, -1)).toBe(false)
    expect(inLightBounds(0, 0, CHUNK_SIZE)).toBe(false)
  })
})

describe('packPosLevel / unpack round-trip', () => {
  it('round-trips (0,0,0,0)', () => {
    const p = packPosLevel(0, 0, 0, 0)
    expect(unpackX(p)).toBe(0)
    expect(unpackY(p)).toBe(0)
    expect(unpackZ(p)).toBe(0)
    expect(unpackLevel(p)).toBe(0)
  })

  it('round-trips max chunk-local coords with max light level', () => {
    const x = CHUNK_SIZE - 1  // 15
    const y = CHUNK_HEIGHT - 1  // 255
    const z = CHUNK_SIZE - 1  // 15
    const lvl = 15
    const p = packPosLevel(x, y, z, lvl)
    expect(unpackX(p)).toBe(x)
    expect(unpackY(p)).toBe(y)
    expect(unpackZ(p)).toBe(z)
    expect(unpackLevel(p)).toBe(lvl)
  })

  it('round-trips arbitrary interior coordinates', () => {
    const cases: [number, number, number, number][] = [
      [0, 64, 0, 15],
      [7, 100, 3, 8],
      [15, 255, 15, 1],
      [4, 0, 12, 0],
    ]
    for (const [x, y, z, lvl] of cases) {
      const p = packPosLevel(x, y, z, lvl)
      expect(unpackX(p)).toBe(x)
      expect(unpackY(p)).toBe(y)
      expect(unpackZ(p)).toBe(z)
      expect(unpackLevel(p)).toBe(lvl)
    }
  })

  it('each field is independent — changing x does not affect y/z/level', () => {
    const p1 = packPosLevel(0, 64, 8, 10)
    const p2 = packPosLevel(5, 64, 8, 10)
    expect(unpackY(p1)).toBe(unpackY(p2))
    expect(unpackZ(p1)).toBe(unpackZ(p2))
    expect(unpackLevel(p1)).toBe(unpackLevel(p2))
    expect(unpackX(p1)).toBe(0)
    expect(unpackX(p2)).toBe(5)
  })
})

describe('lightBufferOrFresh', () => {
  it('returns a fresh zero-filled buffer when given undefined', () => {
    const buf = lightBufferOrFresh(undefined)
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf.byteLength).toBe(LIGHT_BYTE_LENGTH)
    expect(buf.every((v) => v === 0)).toBe(true)
  })

  it('returns the same buffer reference when given a valid-length buffer', () => {
    const existing = new Uint8Array(LIGHT_BYTE_LENGTH)
    existing[0] = 42
    const result = lightBufferOrFresh(existing)
    expect(result).toBe(existing)
    expect(result[0]).toBe(42)
  })

  it('returns a new buffer when given a buffer with the wrong length', () => {
    const wrongLength = new Uint8Array(4)
    const result = lightBufferOrFresh(wrongLength)
    expect(result).not.toBe(wrongLength)
    expect(result.byteLength).toBe(LIGHT_BYTE_LENGTH)
  })
})

describe('trackTouched', () => {
  it('sets acc.aabb from null to the single-voxel AABB on first call', () => {
    const acc = { aabb: null }
    trackTouched(acc, 4, 64, 8)
    expect(acc.aabb).not.toBeNull()
    expect(acc.aabb!.minX).toBe(4)
    expect(acc.aabb!.maxX).toBe(4)
    expect(acc.aabb!.minY).toBe(64)
    expect(acc.aabb!.maxY).toBe(64)
    expect(acc.aabb!.minZ).toBe(8)
    expect(acc.aabb!.maxZ).toBe(8)
  })

  it('expands the AABB to encompass a second voxel on subsequent calls', () => {
    const acc = { aabb: null }
    trackTouched(acc, 4, 64, 8)
    trackTouched(acc, 10, 70, 2)
    expect(acc.aabb!.minX).toBe(4)
    expect(acc.aabb!.maxX).toBe(10)
    expect(acc.aabb!.minY).toBe(64)
    expect(acc.aabb!.maxY).toBe(70)
    expect(acc.aabb!.minZ).toBe(2)
    expect(acc.aabb!.maxZ).toBe(8)
  })

  it('single-voxel call leaves minX === maxX (point AABB)', () => {
    const acc = { aabb: null }
    trackTouched(acc, 7, 100, 7)
    expect(acc.aabb!.minX).toBe(acc.aabb!.maxX)
    expect(acc.aabb!.minY).toBe(acc.aabb!.maxY)
    expect(acc.aabb!.minZ).toBe(acc.aabb!.maxZ)
  })
})

describe('NEIGHBOR_DX / NEIGHBOR_DY / NEIGHBOR_DZ', () => {
  it('has exactly 6 entries each', () => {
    expect(NEIGHBOR_DX.length).toBe(6)
    expect(NEIGHBOR_DY.length).toBe(6)
    expect(NEIGHBOR_DZ.length).toBe(6)
  })

  it('covers all 6 face directions (+x,-x,+y,-y,+z,-z)', () => {
    const dirs = Array.from({ length: 6 }, (_, i) => [NEIGHBOR_DX[i], NEIGHBOR_DY[i], NEIGHBOR_DZ[i]])
    const hasDir = (dx: number, dy: number, dz: number) =>
      dirs.some(([x, y, z]) => x === dx && y === dy && z === dz)
    expect(hasDir(1, 0, 0)).toBe(true)
    expect(hasDir(-1, 0, 0)).toBe(true)
    expect(hasDir(0, 1, 0)).toBe(true)
    expect(hasDir(0, -1, 0)).toBe(true)
    expect(hasDir(0, 0, 1)).toBe(true)
    expect(hasDir(0, 0, -1)).toBe(true)
  })
})
