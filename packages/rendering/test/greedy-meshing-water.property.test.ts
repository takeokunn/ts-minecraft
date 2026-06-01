import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const makeChunkFromBlocks = (blocks: Uint8Array, coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks,
  fluid: Option.none(),
})

const makeSolidChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  blocks.fill(2) // STONE
  return { coord, blocks, fluid: Option.none() }
}

const ZERO_OFFSET = { wx: 0, wz: 0 }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('water/opaque mesh split', () => {
  const WATER_BLOCK_ID = 6
  const TRANSPARENT_IDS = new Set([WATER_BLOCK_ID])

  it.prop(
    'water mesh indices are multiples of 3',
    { rawBlocks: fc.uint8Array({ minLength: TOTAL_BLOCKS, maxLength: TOTAL_BLOCKS }) },
    ({ rawBlocks }) => {
      const blocks = new Uint8Array(rawBlocks)
      const chunk = makeChunkFromBlocks(blocks)
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()
      expect(meshed.water.indices.length % 3).toBe(0)
    },
    { fastCheck: { numRuns: 8 } }
  )

  it.prop(
    'water mesh vertex arrays have consistent lengths',
    { rawBlocks: fc.uint8Array({ minLength: TOTAL_BLOCKS, maxLength: TOTAL_BLOCKS }) },
    ({ rawBlocks }) => {
      const blocks = new Uint8Array(rawBlocks)
      const chunk = makeChunkFromBlocks(blocks)
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()
      const vertexCount = meshed.water.positions.length / 3
      expect(meshed.water.normals.length).toBe(vertexCount * 3)
      expect(meshed.water.colors.length).toBe(vertexCount * 3)
      expect(meshed.water.uvs.length).toBe(vertexCount * 2)
    },
    { fastCheck: { numRuns: 8 } }
  )

  it('all-water chunk: opaque mesh is empty, water mesh is non-empty', () => {
    const blocks = new Uint8Array(TOTAL_BLOCKS)
    // Fill bottom layer with WATER blocks
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), lx => {
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => {
        const idx = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        blocks[idx] = WATER_BLOCK_ID
      })
    })
    const chunk = makeChunkFromBlocks(blocks)
    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()
    expect(meshed.opaque.positions.length).toBe(0)
    expect(meshed.water.positions.length).toBeGreaterThan(0)
  })

  it('empty transparentBlockIds: water block goes to opaque mesh', () => {
    const blocks = new Uint8Array(TOTAL_BLOCKS)
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), lx => {
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => {
        const idx = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        blocks[idx] = WATER_BLOCK_ID
      })
    })
    const chunk = makeChunkFromBlocks(blocks)
    // No transparent IDs — water treated as opaque
    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, new Set()).toMeshed()
    expect(meshed.opaque.positions.length).toBeGreaterThan(0)
    expect(meshed.water.positions.length).toBe(0)
  })

  it('all-stone chunk: water mesh is empty regardless of transparentBlockIds', () => {
    const chunk = makeSolidChunk()
    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()
    expect(meshed.water.positions.length).toBe(0)
  })
})
