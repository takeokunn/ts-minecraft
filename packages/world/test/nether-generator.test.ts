import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import { buildTerrainLayer, buildNetherProgram, toChunkBlocks } from '@ts-minecraft/world'

const NETHERRACK = blockTypeToIndex('NETHERRACK')
const BEDROCK    = blockTypeToIndex('BEDROCK')
const LAVA       = blockTypeToIndex('LAVA')
const AIR        = blockTypeToIndex('AIR')

// Builds the full nether chunk at coord (0,0) with a fixed seed.
const buildNetherChunk = (seed = 12345) =>
  Effect.runSync(
    buildNetherProgram({ x: 0, z: 0 }).pipe(
      Effect.provide(buildTerrainLayer(seed)),
    ),
  )

const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

describe('nether terrain generator', () => {
  it('generates chunk blocks with correct buffer length', () => {
    const chunk = buildNetherChunk()
    expect(chunk.blocks.byteLength).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  })

  it('y=0 is always BEDROCK floor', () => {
    const chunk = buildNetherChunk()
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        expect(blockAt(chunk.blocks, lx, 0, lz)).toBe(BEDROCK)
      }
    }
  })

  it('y=127 is always BEDROCK ceiling', () => {
    const chunk = buildNetherChunk()
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        expect(blockAt(chunk.blocks, lx, 127, lz)).toBe(BEDROCK)
      }
    }
  })

  it('y >= 128 is all AIR (above the nether ceiling)', () => {
    const chunk = buildNetherChunk()
    for (let y = 128; y < CHUNK_HEIGHT; y++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          expect(blockAt(chunk.blocks, lx, y, lz)).toBe(AIR)
        }
      }
    }
  })

  it('contains predominantly NETHERRACK in the habitable zone y=4..118', () => {
    const chunk = buildNetherChunk()
    let netherrackCount = 0
    let total = 0
    for (let y = 4; y <= 118; y++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          total++
          if (blockAt(chunk.blocks, lx, y, lz) === NETHERRACK) netherrackCount++
        }
      }
    }
    // At least 40% NETHERRACK — vanilla nether is heavily caved so large void fractions are expected
    expect(netherrackCount / total).toBeGreaterThan(0.4)
  })

  it('has no AIR below the lava level y<=32 where caves were carved', () => {
    const chunk = buildNetherChunk()
    // Anywhere in the lava zone should be either NETHERRACK, LAVA, or BEDROCK — never raw AIR
    for (let y = 1; y <= 32; y++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const b = blockAt(chunk.blocks, lx, y, lz)
          expect(b).not.toBe(AIR)
        }
      }
    }
  })

  it('contains LAVA somewhere in the lava sea zone (y=1..32)', () => {
    const chunk = buildNetherChunk()
    let hasLava = false
    for (let y = 1; y <= 32 && !hasLava; y++) {
      for (let lx = 0; lx < CHUNK_SIZE && !hasLava; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          if (blockAt(chunk.blocks, lx, y, lz) === LAVA) { hasLava = true; break }
        }
      }
    }
    expect(hasLava).toBe(true)
  })

  it('has AIR somewhere in the cave zone (y=33..118), confirming cave carving happened', () => {
    const chunk = buildNetherChunk()
    let hasAir = false
    for (let y = 33; y <= 118 && !hasAir; y++) {
      for (let lx = 0; lx < CHUNK_SIZE && !hasAir; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          if (blockAt(chunk.blocks, lx, y, lz) === AIR) { hasAir = true; break }
        }
      }
    }
    expect(hasAir).toBe(true)
  })

  it('toChunkBlocks produces light buffers of correct length', () => {
    const chunk = buildNetherChunk()
    const { skyLight, blockLight } = toChunkBlocks(chunk)
    // Each nibble-packed light buffer holds one nibble per voxel
    const expectedLength = Math.ceil((CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) / 2)
    expect(skyLight.byteLength).toBe(expectedLength)
    expect(blockLight.byteLength).toBe(expectedLength)
  })

  it('produces deterministic terrain for the same seed', () => {
    const a = buildNetherChunk(42)
    const b = buildNetherChunk(42)
    expect(a.blocks).toEqual(b.blocks)
  })

  it('produces different terrain for different seeds', () => {
    const a = buildNetherChunk(1)
    const b = buildNetherChunk(9999)
    // Very unlikely to be identical across all 16×16×256 blocks
    expect(a.blocks).not.toEqual(b.blocks)
  })
})
