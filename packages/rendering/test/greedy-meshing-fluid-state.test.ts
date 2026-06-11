import { describe, it, expect } from 'vitest'
import { blockTypeToIndex } from '@ts-minecraft/core'
import {
  isFluidBlockId,
  isFluidFaceOccluder,
  decodeFaceLighting,
} from '../infrastructure/meshing/greedy-meshing-fluid-state'

const WATER_ID = blockTypeToIndex('WATER')
const LAVA_ID = blockTypeToIndex('LAVA')
const AIR_ID = blockTypeToIndex('AIR')
const STONE_ID = blockTypeToIndex('STONE')
const GLASS_ID = blockTypeToIndex('GLASS')

describe('isFluidBlockId', () => {
  it('returns true for WATER block id', () => {
    expect(isFluidBlockId(WATER_ID)).toBe(true)
  })

  it('returns true for LAVA block id', () => {
    expect(isFluidBlockId(LAVA_ID)).toBe(true)
  })

  it('returns false for AIR', () => {
    expect(isFluidBlockId(AIR_ID)).toBe(false)
  })

  it('returns false for STONE', () => {
    expect(isFluidBlockId(STONE_ID)).toBe(false)
  })

  it('returns false for an unknown large id', () => {
    expect(isFluidBlockId(999)).toBe(false)
  })
})

describe('isFluidFaceOccluder', () => {
  const makeTransparentLookup = (...transparentIds: number[]): Uint8Array => {
    const lookup = new Uint8Array(256)
    for (const id of transparentIds) lookup[id] = 1
    return lookup
  }

  it('returns false for AIR (never occludes)', () => {
    const lookup = makeTransparentLookup()
    expect(isFluidFaceOccluder(AIR_ID, lookup)).toBe(false)
  })

  it('returns false for another fluid block', () => {
    const lookup = makeTransparentLookup()
    expect(isFluidFaceOccluder(WATER_ID, lookup)).toBe(false)
    expect(isFluidFaceOccluder(LAVA_ID, lookup)).toBe(false)
  })

  it('returns true for an opaque non-fluid block (transparentSolidLookup[id]=0)', () => {
    const lookup = makeTransparentLookup()
    expect(isFluidFaceOccluder(STONE_ID, lookup)).toBe(true)
  })

  it('returns false for a transparent-solid (GLASS) block', () => {
    const lookup = makeTransparentLookup(GLASS_ID)
    expect(isFluidFaceOccluder(GLASS_ID, lookup)).toBe(false)
  })
})

// decodeFaceLighting extracts sky and block light from 4 packed color bytes.
// Each byte: bits[7:6] = sky-light quantized (0-3), bits[3:2] = block-light quantized (0-3).
// dequantLight(q) = q * 5 → range 0,5,10,15.
describe('decodeFaceLighting', () => {
  const pack = (sky: number, block: number): number =>
    ((sky & 0x3) << 6) | ((block & 0x3) << 2)

  it('extracts sky light level 3 → dequantLight(3) = 15 for all corners', () => {
    const c = pack(3, 0)
    const result = decodeFaceLighting(c, c, c, c)
    expect(result.sky).toEqual([15, 15, 15, 15])
  })

  it('extracts block light level 3 → 15 for all corners', () => {
    const c = pack(0, 3)
    const result = decodeFaceLighting(c, c, c, c)
    expect(result.block).toEqual([15, 15, 15, 15])
  })

  it('extracts level 1 → 5 for sky', () => {
    const c = pack(1, 0)
    const result = decodeFaceLighting(c, c, c, c)
    expect(result.sky).toEqual([5, 5, 5, 5])
  })

  it('extracts level 2 → 10 for block', () => {
    const c = pack(0, 2)
    const result = decodeFaceLighting(c, c, c, c)
    expect(result.block).toEqual([10, 10, 10, 10])
  })

  it('handles all-zero inputs (full darkness)', () => {
    const result = decodeFaceLighting(0, 0, 0, 0)
    expect(result.sky).toEqual([0, 0, 0, 0])
    expect(result.block).toEqual([0, 0, 0, 0])
  })

  it('handles independent per-corner values', () => {
    const result = decodeFaceLighting(pack(3, 0), pack(2, 1), pack(1, 2), pack(0, 3))
    expect(result.sky).toEqual([15, 10, 5, 0])
    expect(result.block).toEqual([0, 5, 10, 15])
  })
})
