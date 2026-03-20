import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { greedyMeshChunk } from './greedy-meshing'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import type { Chunk, ChunkCoord } from '@/domain/chunk'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const makeChunkFromBlocks = (blocks: Uint8Array, coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks,
})

const makeEmptyChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks: new Uint8Array(TOTAL_BLOCKS),
})

/** Build a fully-solid chunk: every block set to STONE (index 2) */
const makeSolidChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  blocks.fill(2) // STONE
  return { coord, blocks }
}

/**
 * Build a chunk with a single horizontal layer at y=0.
 * Each column in the 16x16 footprint gets block type = layer[lx*16+lz] % 12.
 * All other blocks stay AIR (0).
 */
const makeLayerChunk = (layer: Uint8Array, coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const blockType = layer[lx * CHUNK_SIZE + lz]! % 12
      // y=0: index = 0 + lz*CHUNK_HEIGHT + lx*CHUNK_HEIGHT*CHUNK_SIZE
      const idx = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      blocks[idx] = blockType
    }
  }
  return { coord, blocks }
}

const ZERO_OFFSET = { wx: 0, wz: 0 }

// ─── Property tests ───────────────────────────────────────────────────────────

describe('greedyMeshChunk — property-based', () => {
  describe('indices are always within valid vertex range', () => {
    it.prop(
      'every index references an existing vertex for single-layer patterns',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        const vertexCount = result.opaque.positions.length / 3
        for (let i = 0; i < result.opaque.indices.length; i++) {
          const idx = result.opaque.indices[i]!
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(vertexCount)
        }
      },
      { fastCheck: { numRuns: 50 } }
    )

    it.prop(
      'every index references an existing vertex for two-layer patterns',
      {
        layer0: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }),
        layer1: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }),
      },
      ({ layer0, layer1 }) => {
        // Two layers at y=0 and y=1 — tests hidden-face culling between stacked blocks
        const blocks = new Uint8Array(TOTAL_BLOCKS)
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const base = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            blocks[base + 0] = layer0[lx * CHUNK_SIZE + lz]! % 12
            blocks[base + 1] = layer1[lx * CHUNK_SIZE + lz]! % 12
          }
        }
        const chunk = makeChunkFromBlocks(blocks)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        const vertexCount = result.opaque.positions.length / 3
        for (let i = 0; i < result.opaque.indices.length; i++) {
          const idx = result.opaque.indices[i]!
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(vertexCount)
        }
      },
      { fastCheck: { numRuns: 30 } }
    )

    it.prop(
      'index count is always a multiple of 3 (complete triangles)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)
        expect(result.opaque.indices.length % 3).toBe(0)
      },
      { fastCheck: { numRuns: 50 } }
    )

    it.prop(
      'vertex count is always a multiple of 4 (complete quads)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)
        const vertexCount = result.opaque.positions.length / 3
        expect(vertexCount % 4).toBe(0)
      },
      { fastCheck: { numRuns: 50 } }
    )
  })

  describe('array length consistency', () => {
    it.prop(
      'positions, normals, and colors always have equal lengths',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        expect(result.opaque.positions.length).toBe(result.opaque.normals.length)
        expect(result.opaque.positions.length).toBe(result.opaque.colors.length)
      },
      { fastCheck: { numRuns: 50 } }
    )

    it.prop(
      'uvs length is always 2/3 of positions length (2 UV coords per vertex)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        const vertexCount = result.opaque.positions.length / 3
        expect(result.opaque.uvs.length).toBe(vertexCount * 2)
      },
      { fastCheck: { numRuns: 50 } }
    )

    it.prop(
      'index count is always (quadCount * 6) and vertex count is (quadCount * 4)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        const quadCount = result.opaque.blockPositions.length
        expect(result.opaque.indices.length).toBe(quadCount * 6)
        expect(result.opaque.positions.length / 3).toBe(quadCount * 4)
      },
      { fastCheck: { numRuns: 50 } }
    )
  })

  describe('all-air chunk', () => {
    it('produces 0 faces (positions.length === 0)', () => {
      const chunk = makeEmptyChunk()
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.positions.length).toBe(0)
      expect(result.opaque.normals.length).toBe(0)
      expect(result.opaque.colors.length).toBe(0)
      expect(result.opaque.indices.length).toBe(0)
      expect(result.opaque.blockPositions.length).toBe(0)
    })

    it.prop(
      'empty chunk always produces zero geometry regardless of chunk coordinate offset',
      { cx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))), cz: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))) },
      ({ cx, cz }) => {
        const chunk = makeEmptyChunk({ x: cx, z: cz })
        const result = greedyMeshChunk(chunk, { wx: cx * CHUNK_SIZE, wz: cz * CHUNK_SIZE })
        expect(result.opaque.positions.length).toBe(0)
      },
      { fastCheck: { numRuns: 20 } }
    )
  })

  describe('solid chunk', () => {
    it('produces > 0 faces for a fully solid chunk', () => {
      const chunk = makeSolidChunk()
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Only the outermost shell faces are visible
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      expect(result.opaque.blockPositions.length).toBeGreaterThan(0)
    })

    it('fully solid chunk has all indices within vertex range', () => {
      const chunk = makeSolidChunk()
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const vertexCount = result.opaque.positions.length / 3
      for (let i = 0; i < result.opaque.indices.length; i++) {
        const idx = result.opaque.indices[i]!
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(vertexCount)
      }
    })

    it('fully solid chunk indices are multiples of 3 and vertices multiples of 4', () => {
      const chunk = makeSolidChunk()
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.indices.length % 3).toBe(0)
      expect((result.opaque.positions.length / 3) % 4).toBe(0)
    })
  })

  describe('output typed arrays', () => {
    it.prop(
      'always returns Float32Array for positions/normals/colors/uvs and Uint32Array for indices',
      { isEmpty: Arbitrary.make(Schema.Boolean) },
      ({ isEmpty }) => {
        const blocks = new Uint8Array(TOTAL_BLOCKS)
        if (!isEmpty) {
          // Single DIRT block at (5,0,5)
          blocks[0 + 5 * CHUNK_HEIGHT + 5 * CHUNK_HEIGHT * CHUNK_SIZE] = 1
        }
        const chunk = makeChunkFromBlocks(blocks)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        expect(result.opaque.positions).toBeInstanceOf(Float32Array)
        expect(result.opaque.normals).toBeInstanceOf(Float32Array)
        expect(result.opaque.colors).toBeInstanceOf(Float32Array)
        expect(result.opaque.uvs).toBeInstanceOf(Float32Array)
        expect(result.opaque.indices).toBeInstanceOf(Uint32Array)
      },
      { fastCheck: { numRuns: 10 } }
    )
  })

  describe('world offset applied to vertex positions', () => {
    it.prop(
      'all X-coords are >= wx for any positive chunk coordinate',
      {
        cx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(1, 20))),
        layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }),
      },
      ({ cx, layer }) => {
        // Ensure at least one non-air block so we get geometry
        layer[0] = 1
        const coord: ChunkCoord = { x: cx, z: 0 }
        const chunk = makeLayerChunk(layer, coord)
        const result = greedyMeshChunk(chunk, { wx: cx * CHUNK_SIZE, wz: 0 })

        if (result.opaque.positions.length === 0) return // all-air after mod — skip

        for (let i = 0; i < result.opaque.positions.length; i += 3) {
          expect(result.opaque.positions[i]!).toBeGreaterThanOrEqual(cx * CHUNK_SIZE)
        }
      },
      { fastCheck: { numRuns: 20 } }
    )
  })
})

describe('water/opaque mesh split', () => {
  const WATER_BLOCK_ID = 6
  const TRANSPARENT_IDS = new Set([WATER_BLOCK_ID])

  it.prop(
    'water mesh indices are multiples of 3',
    { rawBlocks: fc.uint8Array({ minLength: TOTAL_BLOCKS, maxLength: TOTAL_BLOCKS }) },
    ({ rawBlocks }) => {
      const blocks = new Uint8Array(rawBlocks)
      const chunk = makeChunkFromBlocks(blocks)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS)
      expect(result.water.indices.length % 3).toBe(0)
    }
  )

  it.prop(
    'water mesh vertex arrays have consistent lengths',
    { rawBlocks: fc.uint8Array({ minLength: TOTAL_BLOCKS, maxLength: TOTAL_BLOCKS }) },
    ({ rawBlocks }) => {
      const blocks = new Uint8Array(rawBlocks)
      const chunk = makeChunkFromBlocks(blocks)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS)
      const vertexCount = result.water.positions.length / 3
      expect(result.water.normals.length).toBe(vertexCount * 3)
      expect(result.water.colors.length).toBe(vertexCount * 3)
      expect(result.water.uvs.length).toBe(vertexCount * 2)
    }
  )

  it('all-water chunk: opaque mesh is empty, water mesh is non-empty', () => {
    const blocks = new Uint8Array(TOTAL_BLOCKS)
    // Fill bottom layer with WATER blocks
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const idx = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        blocks[idx] = WATER_BLOCK_ID
      }
    }
    const chunk = makeChunkFromBlocks(blocks)
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS)
    expect(result.opaque.positions.length).toBe(0)
    expect(result.water.positions.length).toBeGreaterThan(0)
  })

  it('empty transparentBlockIds: water block goes to opaque mesh', () => {
    const blocks = new Uint8Array(TOTAL_BLOCKS)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const idx = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        blocks[idx] = WATER_BLOCK_ID
      }
    }
    const chunk = makeChunkFromBlocks(blocks)
    // No transparent IDs — water treated as opaque
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set())
    expect(result.opaque.positions.length).toBeGreaterThan(0)
    expect(result.water.positions.length).toBe(0)
  })

  it('all-stone chunk: water mesh is empty regardless of transparentBlockIds', () => {
    const chunk = makeSolidChunk()
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS)
    expect(result.water.positions.length).toBe(0)
  })
})
