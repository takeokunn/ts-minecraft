import { describe, it, expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/block'
import {
  inLightBounds,
  lightBufferOrFresh,
  packPosLevel,
  unpackX,
  unpackZ,
  unpackY,
  unpackLevel,
  FULL_RECOMPUTE_THRESHOLD,
} from './light-engine-utils'

describe('inLightBounds', () => {
  it('origin (0,0,0) is in bounds', () => {
    expect(inLightBounds(0, 0, 0)).toBe(true)
  })
  it('max valid coords are in bounds', () => {
    expect(inLightBounds(CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)).toBe(true)
  })
  it('negative lx is out of bounds', () => {
    expect(inLightBounds(-1, 0, 0)).toBe(false)
  })
  it('negative y is out of bounds', () => {
    expect(inLightBounds(0, -1, 0)).toBe(false)
  })
  it('negative lz is out of bounds', () => {
    expect(inLightBounds(0, 0, -1)).toBe(false)
  })
  it('lx = CHUNK_SIZE is out of bounds', () => {
    expect(inLightBounds(CHUNK_SIZE, 0, 0)).toBe(false)
  })
  it('y = CHUNK_HEIGHT is out of bounds', () => {
    expect(inLightBounds(0, CHUNK_HEIGHT, 0)).toBe(false)
  })
  it('lz = CHUNK_SIZE is out of bounds', () => {
    expect(inLightBounds(0, 0, CHUNK_SIZE)).toBe(false)
  })
})

describe('lightBufferOrFresh', () => {
  it('returns a new buffer when given undefined', () => {
    const buf = lightBufferOrFresh(undefined)
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf.byteLength).toBe(LIGHT_BYTE_LENGTH)
  })
  it('returns the same buffer when it has correct size', () => {
    const existing = new Uint8Array(LIGHT_BYTE_LENGTH)
    expect(lightBufferOrFresh(existing)).toBe(existing)
  })
  it('returns a fresh buffer when size is wrong', () => {
    const wrong = new Uint8Array(LIGHT_BYTE_LENGTH + 1)
    const result = lightBufferOrFresh(wrong)
    expect(result).not.toBe(wrong)
    expect(result.byteLength).toBe(LIGHT_BYTE_LENGTH)
  })
  it('fresh buffer contains only zeros', () => {
    const buf = lightBufferOrFresh(undefined)
    expect(buf.every((b) => b === 0)).toBe(true)
  })
})

describe('packPosLevel / unpack round-trips', () => {
  const cases: Array<[number, number, number, number]> = [
    [0, 0, 0, 0],
    [15, 255, 15, 15],
    [7, 128, 8, 10],
    [0, 1, 0, 15],
    [15, 0, 15, 0],
    [1, 63, 1, 1],
  ]

  for (const [x, y, z, lvl] of cases) {
    it(`round-trips (x=${x}, y=${y}, z=${z}, lvl=${lvl})`, () => {
      const packed = packPosLevel(x, y, z, lvl)
      expect(unpackX(packed)).toBe(x)
      expect(unpackY(packed)).toBe(y)
      expect(unpackZ(packed)).toBe(z)
      expect(unpackLevel(packed)).toBe(lvl)
    })
  }

  it('all chunk coords round-trip with max level', () => {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const p = packPosLevel(x, 0, z, 15)
        expect(unpackX(p)).toBe(x)
        expect(unpackZ(p)).toBe(z)
        expect(unpackLevel(p)).toBe(15)
      }
    }
  })

  it('y range 0–255 round-trips', () => {
    for (let y = 0; y < 256; y++) {
      const p = packPosLevel(0, y, 0, 0)
      expect(unpackY(p)).toBe(y)
    }
  })
})

describe('FULL_RECOMPUTE_THRESHOLD constant', () => {
  it('is a positive integer', () => {
    expect(FULL_RECOMPUTE_THRESHOLD).toBeGreaterThan(0)
    expect(Number.isInteger(FULL_RECOMPUTE_THRESHOLD)).toBe(true)
  })
})
