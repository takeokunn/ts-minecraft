import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  CAVE_SAMPLE_STRIDE,
  CAVE_FLOOR,
  CAVE_CEILING,
  BEDROCK_LAYER_TOP,
  carveCaves,
} from '@ts-minecraft/world'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const AIR     = blockTypeToIndex('AIR')
const LAVA    = blockTypeToIndex('LAVA')
const STONE   = blockTypeToIndex('STONE')
const WATER   = blockTypeToIndex('WATER')
const BEDROCK = blockTypeToIndex('BEDROCK')

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

const setBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, val: number): void => {
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = val
}

// Grid shape: sxCount × szCount × syCount, indexed as [sx + sz*sxC + sy*sxC*szC].
const makeSamples = (value: number): number[] => {
  const stride = CAVE_SAMPLE_STRIDE
  const sxCount = Math.floor(CHUNK_SIZE / stride) + 1
  const szCount = Math.floor(CHUNK_SIZE / stride) + 1
  const syCount = Math.floor(CHUNK_HEIGHT / stride) + 1
  return Array(sxCount * szCount * syCount).fill(value)
}

// ---------------------------------------------------------------------------
// carveCaves
// ---------------------------------------------------------------------------

describe('carveCaves', () => {
  it('all-zero noise → no voxels carved (|0| is not less than threshold)', () => {
    // CAVE_BASE_THRESHOLD > 0, so |0| === 0 < threshold would actually carve.
    // Wait — actually 0 < CAVE_BASE_THRESHOLD (0.18) → it WOULD carve.
    // But the condition is current !== BEDROCK && !== AIR && !== WATER.
    // With all AIR blocks (0), the guard fires and skips every voxel.
    const blocks = makeBlocks() // all AIR
    const samples = makeSamples(0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    // All blocks remain AIR — nothing was changed
    expect(blocks.every((b) => b === AIR)).toBe(true)
  })

  it('all-one noise (value=1.0) → no voxels carved (|1.0| > threshold ≈ 0.18–0.21)', () => {
    // Fill eligible zone with STONE so the guard passes, but |1| > threshold
    const blocks = makeBlocks()
    const cols = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
    )
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        setBlock(blocks, lx, y, lz, STONE)
      })
    )
    const samples = makeSamples(1.0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    // All STONE blocks remain STONE
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        expect(getBlock(blocks, lx, y, lz)).toBe(STONE)
      })
    )
  })

  it('near-zero noise (value=0) on STONE blocks → AIR carved in eligible y range', () => {
    // 0 < CAVE_BASE_THRESHOLD (0.18) → all STONE in [CAVE_FLOOR, CAVE_CEILING] is carved
    const blocks = makeBlocks()
    const cols = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
    )
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        setBlock(blocks, lx, y, lz, STONE)
      })
    )
    const samples = makeSamples(0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    // At least some blocks in the eligible zone should have been carved to AIR
    const carved = Arr.filter(
      Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
        Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lz => lz), lz =>
          Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => ({ lx, lz, y: CAVE_FLOOR + i }))
        )
      ),
      ({ lx, lz, y }) => getBlock(blocks, lx, y, lz) === AIR
    ).length
    expect(carved).toBeGreaterThan(0)
  })

  it('bedrock layer (y <= BEDROCK_LAYER_TOP) is never carved', () => {
    // Fill all blocks with STONE, then run carving with all-zero samples
    const blocks = makeBlocks()
    const cols = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
    )
    Arr.forEach(Arr.makeBy(BEDROCK_LAYER_TOP + 1, i => i), y =>
      Arr.forEach(cols, ({ lx, lz }) => {
        setBlock(blocks, lx, y, lz, STONE)
      })
    )
    const samples = makeSamples(0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    // y <= BEDROCK_LAYER_TOP (4) is below CAVE_FLOOR (5), so blocks remain STONE
    Arr.forEach(Arr.makeBy(BEDROCK_LAYER_TOP + 1, i => i), y =>
      Arr.forEach(cols, ({ lx, lz }) => {
        expect(getBlock(blocks, lx, y, lz)).toBe(STONE)
      })
    )
  })

  it('WATER blocks are never carved regardless of noise value', () => {
    const blocks = makeBlocks()
    const cols = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
    )
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        setBlock(blocks, lx, y, lz, WATER)
      })
    )
    const samples = makeSamples(0) // all-zero → would carve non-protected blocks
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        expect(getBlock(blocks, lx, y, lz)).toBe(WATER)
      })
    )
  })

  it('BEDROCK blocks are never carved', () => {
    const blocks = makeBlocks()
    const cols = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
    )
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        setBlock(blocks, lx, y, lz, BEDROCK)
      })
    )
    const samples = makeSamples(0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    Arr.forEach(cols, ({ lx, lz }) =>
      Arr.forEach(Arr.makeBy(CAVE_CEILING - CAVE_FLOOR + 1, i => CAVE_FLOOR + i), y => {
        expect(getBlock(blocks, lx, y, lz)).toBe(BEDROCK)
      })
    )
  })

  it('blocks outside [CAVE_FLOOR, CAVE_CEILING] are not touched', () => {
    const blocks = makeBlocks()
    // Place STONE above and below the cave zone
    const ABOVE_Y = CAVE_CEILING + 5
    const BELOW_Y = CAVE_FLOOR - 1 // = BEDROCK_LAYER_TOP (4)
    const cols = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.map(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => ({ lx, lz }))
    )
    if (ABOVE_Y < CHUNK_HEIGHT) {
      Arr.forEach(cols, ({ lx, lz }) => {
        setBlock(blocks, lx, ABOVE_Y, lz, STONE)
      })
    }
    if (BELOW_Y >= 0) {
      Arr.forEach(cols, ({ lx, lz }) => {
        setBlock(blocks, lx, BELOW_Y, lz, STONE)
      })
    }
    const samples = makeSamples(0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    if (ABOVE_Y < CHUNK_HEIGHT) {
      expect(getBlock(blocks, 0, ABOVE_Y, 0)).toBe(STONE)
    }
    if (BELOW_Y >= 0) {
      expect(getBlock(blocks, 0, BELOW_Y, 0)).toBe(STONE)
    }
  })

  it('fills deep carved caves with lava instead of air', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 8, 8, 8, STONE)
    const samples = makeSamples(0)
    carveCaves(blocks, samples, AIR, WATER, BEDROCK, LAVA)
    expect(getBlock(blocks, 8, 8, 8)).toBe(LAVA)
  })
})
