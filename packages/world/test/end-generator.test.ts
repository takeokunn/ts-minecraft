import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import { buildTerrainLayer, buildEndProgram, toChunkBlocks } from '@ts-minecraft/world'

const END_STONE    = blockTypeToIndex('END_STONE')
const OBSIDIAN     = blockTypeToIndex('OBSIDIAN')
const END_PORTAL   = blockTypeToIndex('END_PORTAL')
const AIR          = blockTypeToIndex('AIR')

// Builds the full end chunk at coord (0,0) — static island, no seed needed.
const buildEndChunk = (coord: { x: number; z: number } = { x: 0, z: 0 }) =>
  Effect.runSync(
    buildEndProgram(coord).pipe(
      Effect.provide(buildTerrainLayer(0)),
    ),
  )

const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

describe('end terrain generator', () => {
  it('generates chunk blocks with correct buffer length', () => {
    const chunk = buildEndChunk()
    expect(chunk.blocks.byteLength).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  })

  it('chunk at origin (0,0) has END_STONE surface at y=64 within island radius', () => {
    const chunk = buildEndChunk()
    // Origin is within island radius, so center should have END_STONE at y=64
    expect(blockAt(chunk.blocks, 8, 64, 8)).toBe(END_STONE)
    // Also just below surface
    expect(blockAt(chunk.blocks, 8, 63, 8)).toBe(END_STONE)
    // And at the bottom of the fill
    expect(blockAt(chunk.blocks, 8, 60, 8)).toBe(END_STONE)
  })

  it('chunk far from origin has no END_STONE (outside island radius)', () => {
    const chunk = buildEndChunk({ x: 10, z: 10 })
    // Chunk at (160, 160) in world coords → way outside the 55-block radius
    expect(blockAt(chunk.blocks, 0, 64, 0)).toBe(AIR)
    expect(blockAt(chunk.blocks, 8, 64, 8)).toBe(AIR)
  })

  it('island center has END_PORTAL blocks at y=64', () => {
    // Chunk at origin — the 3×3 portal is at world (0,0) which is chunk-local (0,0)
    const chunk = buildEndChunk({ x: 0, z: 0 })
    expect(blockAt(chunk.blocks, 0, 64, 0)).toBe(END_PORTAL)
    expect(blockAt(chunk.blocks, 1, 64, 0)).toBe(END_PORTAL)
    expect(blockAt(chunk.blocks, 0, 64, 1)).toBe(END_PORTAL)
    expect(blockAt(chunk.blocks, 1, 64, 1)).toBe(END_PORTAL)
  })

  it('contains obsidian pillars at their expected positions', () => {
    // Pillar at world (43, 0) is in chunk (2,0); local x = 43 % 16 = 11
    const chunk = buildEndChunk({ x: 2, z: 0 })
    let obsidianFound = false
    for (let y = 64; y <= 76 && !obsidianFound; y++) {
      for (let lx = 0; lx < CHUNK_SIZE && !obsidianFound; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          if (blockAt(chunk.blocks, lx, y, lz) === OBSIDIAN) {
            obsidianFound = true
            break
          }
        }
      }
    }
    expect(obsidianFound).toBe(true)
  })

  it('toChunkBlocks produces light buffers of correct length', () => {
    const chunk = buildEndChunk()
    const { skyLight, blockLight } = toChunkBlocks(chunk)
    const expectedLength = Math.ceil((CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) / 2)
    expect(skyLight.byteLength).toBe(expectedLength)
    expect(blockLight.byteLength).toBe(expectedLength)
  })

  it('produces deterministic terrain (no seed dependency)', () => {
    const a = buildEndChunk({ x: 0, z: 0 })
    const b = buildEndChunk({ x: 0, z: 0 })
    expect(a.blocks).toEqual(b.blocks)
  })

  it('different chunks produce different results', () => {
    const a = buildEndChunk({ x: 0, z: 0 })
    const b = buildEndChunk({ x: 2, z: 2 })
    // Chunk at (32,32) in world coords is partially inside island radius
    // won't be identical to the origin chunk
    expect(a.blocks).not.toEqual(b.blocks)
  })
})
