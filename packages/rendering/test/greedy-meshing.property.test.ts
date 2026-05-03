import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Arbitrary, Option, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const makeChunkFromBlocks = (blocks: Uint8Array, coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks,
  fluid: Option.none(),
})

const makeEmptyChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks: new Uint8Array(TOTAL_BLOCKS),
  fluid: Option.none(),
})

const makeSolidChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  blocks.fill(2) // STONE
  return { coord, blocks, fluid: Option.none() }
}

// Block type = layer[lx*16+lz] % 12 at y=0; all other blocks are AIR.
const makeLayerChunk = (layer: Uint8Array, coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), lx => {
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => {
      const blockType = layer[lx * CHUNK_SIZE + lz]! % 12
      // y=0: index = 0 + lz*CHUNK_HEIGHT + lx*CHUNK_HEIGHT*CHUNK_SIZE
      const idx = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      blocks[idx] = blockType
    })
  })
  return { coord, blocks, fluid: Option.none() }
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
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

        const vertexCount = meshed.opaque.positions.length / 3
        Arr.forEach(Arr.makeBy(meshed.opaque.indices.length, i => i), i => {
          const idx = meshed.opaque.indices[i]!
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(vertexCount)
        })
      },
      { fastCheck: { numRuns: 20 } }
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
        Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), lx => {
          Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => {
            const base = lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            blocks[base + 0] = layer0[lx * CHUNK_SIZE + lz]! % 12
            blocks[base + 1] = layer1[lx * CHUNK_SIZE + lz]! % 12
          })
        })
        const chunk = makeChunkFromBlocks(blocks)
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

        const vertexCount = meshed.opaque.positions.length / 3
        Arr.forEach(Arr.makeBy(meshed.opaque.indices.length, i => i), i => {
          const idx = meshed.opaque.indices[i]!
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(vertexCount)
        })
      },
      { fastCheck: { numRuns: 12 } }
    )

    it.prop(
      'index count is always a multiple of 3 (complete triangles)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()
        expect(meshed.opaque.indices.length % 3).toBe(0)
      },
      { fastCheck: { numRuns: 20 } }
    )

    it.prop(
      'vertex count is always a multiple of 4 (complete quads)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()
        const vertexCount = meshed.opaque.positions.length / 3
        expect(vertexCount % 4).toBe(0)
      },
      { fastCheck: { numRuns: 20 } }
    )
  })

  describe('array length consistency', () => {
    it.prop(
      'positions, normals, and colors always have equal lengths',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

        expect(meshed.opaque.positions.length).toBe(meshed.opaque.normals.length)
        expect(meshed.opaque.positions.length).toBe(meshed.opaque.colors.length)
      },
      { fastCheck: { numRuns: 20 } }
    )

    it.prop(
      'uvs length is always 2/3 of positions length (2 UV coords per vertex)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

        const vertexCount = meshed.opaque.positions.length / 3
        expect(meshed.opaque.uvs.length).toBe(vertexCount * 2)
      },
      { fastCheck: { numRuns: 20 } }
    )

    it.prop(
      'index count is always (quadCount * 6) and vertex count is (quadCount * 4)',
      { layer: fc.uint8Array({ minLength: CHUNK_SIZE * CHUNK_SIZE, maxLength: CHUNK_SIZE * CHUNK_SIZE }) },
      ({ layer }) => {
        const chunk = makeLayerChunk(layer)
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

        const quadCount = meshed.opaque.indices.length / 6
        expect(meshed.opaque.indices.length).toBe(quadCount * 6)
        expect(meshed.opaque.positions.length / 3).toBe(quadCount * 4)
      },
      { fastCheck: { numRuns: 20 } }
    )
  })

  describe('all-air chunk', () => {
    it('produces 0 faces (positions.length === 0)', () => {
      const chunk = makeEmptyChunk()
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

      expect(meshed.opaque.positions.length).toBe(0)
      expect(meshed.opaque.normals.length).toBe(0)
      expect(meshed.opaque.colors.length).toBe(0)
      expect(meshed.opaque.indices.length).toBe(0)
      expect(meshed.opaque.indices.length / 6).toBe(0)
    })

    it.prop(
      'empty chunk always produces zero geometry regardless of chunk coordinate offset',
      { cx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))), cz: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))) },
      ({ cx, cz }) => {
        const chunk = makeEmptyChunk({ x: cx, z: cz })
        const meshed = greedyMeshChunk(chunk, { wx: cx * CHUNK_SIZE, wz: cz * CHUNK_SIZE }).toMeshed()
        expect(meshed.opaque.positions.length).toBe(0)
      },
      { fastCheck: { numRuns: 20 } }
    )
  })

  describe('solid chunk', () => {
    it('produces > 0 faces for a fully solid chunk', () => {
      const chunk = makeSolidChunk()
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

      // Only the outermost shell faces are visible
      expect(meshed.opaque.positions.length).toBeGreaterThan(0)
      expect(meshed.opaque.indices.length / 6).toBeGreaterThan(0)
    })

    it('fully solid chunk has all indices within vertex range', () => {
      const chunk = makeSolidChunk()
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

      const vertexCount = meshed.opaque.positions.length / 3
      Arr.forEach(Arr.makeBy(meshed.opaque.indices.length, i => i), i => {
        const idx = meshed.opaque.indices[i]!
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(vertexCount)
      })
    })

    it('fully solid chunk indices are multiples of 3 and vertices multiples of 4', () => {
      const chunk = makeSolidChunk()
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

      expect(meshed.opaque.indices.length % 3).toBe(0)
      expect((meshed.opaque.positions.length / 3) % 4).toBe(0)
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
        const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

        expect(meshed.opaque.positions).toBeInstanceOf(Float32Array)
        expect(meshed.opaque.normals).toBeInstanceOf(Int8Array)
        expect(meshed.opaque.colors).toBeInstanceOf(Uint8Array)
        expect(meshed.opaque.uvs).toBeInstanceOf(Float32Array)
        expect(meshed.opaque.indices).toBeInstanceOf(Uint32Array)
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
        const meshed = greedyMeshChunk(chunk, { wx: cx * CHUNK_SIZE, wz: 0 }).toMeshed()

        if (meshed.opaque.positions.length === 0) return // all-air after mod — skip

        for (let i = 0; i < meshed.opaque.positions.length; i += 3) {
          expect(meshed.opaque.positions[i]!).toBeGreaterThanOrEqual(cx * CHUNK_SIZE)
        }
      },
      { fastCheck: { numRuns: 20 } }
    )
  })
})
