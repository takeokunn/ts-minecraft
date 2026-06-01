import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { computeMaxY } from './chunk'

const writeBlockUnsafe = (
  blocks: Uint8Array,
  localX: number,
  y: number,
  localZ: number,
  blockIdx: number,
): void => {
  blocks[y + localZ * CHUNK_HEIGHT + localX * CHUNK_HEIGHT * CHUNK_SIZE] = blockIdx
}

describe('FR-3.3 computeMaxY', () => {
  it('returns -1 for an entirely AIR chunk', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(computeMaxY(blocks)).toBe(-1)
  })

  it('returns 0 when only y=0 has a non-AIR block', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    writeBlockUnsafe(blocks, 0, 0, 0, 1)
    expect(computeMaxY(blocks)).toBe(0)
  })

  it('returns the highest Y when multiple blocks exist at different heights', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    writeBlockUnsafe(blocks, 0, 5, 0, 1)
    writeBlockUnsafe(blocks, 5, 80, 5, 2)
    writeBlockUnsafe(blocks, 0, 30, 0, 1)
    expect(computeMaxY(blocks)).toBe(80)
  })

  it('finds maxY at boundaries and mountain-like profiles', () => {
    const top = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    writeBlockUnsafe(top, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1, 1)
    expect(computeMaxY(top)).toBe(CHUNK_HEIGHT - 1)

    const mountain = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 0; y <= 110; y++) writeBlockUnsafe(mountain, x, y, z, 2)
      }
    }
    expect(computeMaxY(mountain)).toBe(110)
  })
})
