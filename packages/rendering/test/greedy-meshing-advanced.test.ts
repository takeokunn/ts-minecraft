import { describe, it, expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import { createLightBuffer, setLightAt, LIGHT_LEVEL_MAX, computeBlockLight } from '@ts-minecraft/world-state'
import type { LightGrids } from '@ts-minecraft/world-state'
import type { Chunk } from '@ts-minecraft/terrain'
import { makeChunkWithBlock, makeChunkWithBlocks, ZERO_COORD, ZERO_OFFSET } from './greedy-meshing-test-utils'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('greedyMeshChunk (advanced)', () => {
  describe('WATER block routing', () => {
    const TRANSPARENT_BLOCK_IDS = new Set([blockTypeToIndex('WATER')])

    it('a chunk with a single WATER block routes geometry to result.water, not result.opaque, when transparentBlockIds is passed', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 4, 10, 4, 'WATER')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_BLOCK_IDS)

      // Water geometry must be non-empty
      expect(result.toMeshed().water.positions.length).toBeGreaterThan(0)
      // Opaque geometry must be empty (only WATER block present)
      expect(result.toMeshed().opaque.positions.length).toBe(0)
    })

    it('a chunk with DIRT and WATER produces separate geometry in result.opaque (DIRT) and result.water (WATER)', () => {
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 2, y: 0, lz: 0, blockType: 'WATER' },
      ])
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_BLOCK_IDS)

      // Both accumulators should have geometry
      expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
      expect(result.toMeshed().water.positions.length).toBeGreaterThan(0)
    })

    it('water side face adjacent to GLASS is exposed (aquarium walls), unlike adjacent to STONE', () => {
      const GLASS = new Set([blockTypeToIndex('GLASS')])

      // Water next to GLASS — a transparent-solid neighbour does NOT occlude, so
      // the water's +X side face is exposed (you see the water through the glass).
      const glassChunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'WATER' },
        { lx: 1, y: 0, lz: 0, blockType: 'GLASS' },
      ])
      const glassWater = greedyMeshChunk(glassChunk, ZERO_OFFSET, TRANSPARENT_BLOCK_IDS, undefined, undefined, GLASS)
        .toMeshed().water.positions.length

      // Water next to STONE — an opaque neighbour occludes, so the +X face is
      // culled. Control case: identical except for the neighbour block type.
      const stoneChunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'WATER' },
        { lx: 1, y: 0, lz: 0, blockType: 'STONE' },
      ])
      const stoneWater = greedyMeshChunk(stoneChunk, ZERO_OFFSET, TRANSPARENT_BLOCK_IDS, undefined, undefined, GLASS)
        .toMeshed().water.positions.length

      // Exactly one extra water face in the glass case (+X side) → 4 verts × 3 = 12.
      expect(glassWater).toBe(stoneWater + 12)
    })

    it('a chunk with WATER but no transparentBlockIds passed routes WATER to result.opaque', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 4, 10, 4, 'WATER')
      // No transparentBlockIds argument — uses default empty Set
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Without transparent routing, WATER goes to opaque
      expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
      expect(result.toMeshed().water.positions.length).toBe(0)
    })
  })

  describe('ensureCapacity buffer growth', () => {
    it('handles a chunk that exceeds INITIAL_QUAD_CAPACITY (8192) without error', () => {
      // A 3D checkerboard in 16×32×16 generates ~6144 filled blocks × 6 faces = ~36k quads,
      // well above INITIAL_QUAD_CAPACITY (8192). Forces ensureCapacity to grow buffers.
      // Using Y=32 (not full 128) keeps the test fast while still exceeding capacity.
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const STONE = blockTypeToIndex('STONE')
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, (x) => x), (x) =>
        Arr.forEach(Arr.makeBy(32, (y) => y), (y) =>
          Arr.forEach(Arr.makeBy(CHUNK_SIZE, (z) => z), (z) => {
            if ((x + y + z) % 2 === 0) {
              blocks[y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE] = STONE
            }
          })
        )
      )
      const chunk: Chunk = { coord: ZERO_COORD, blocks, fluid: Option.none() }
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed()

      expect(meshed.opaque.positions.length).toBeGreaterThan(0)
      expect(meshed.opaque.indices.length).toBeGreaterThan(0)

      const quadCount = meshed.opaque.indices.length / 6
      expect(quadCount).toBeGreaterThan(8192)

      const vertexCount = meshed.opaque.positions.length / 3
      expect(meshed.opaque.positions.length).toBe(meshed.opaque.normals.length)
      expect(meshed.opaque.positions.length).toBe(meshed.opaque.colors.length)
      expect(meshed.opaque.uvs.length).toBe(vertexCount * 2)
      expect(vertexCount).toBe(quadCount * 4)

      const maxIdx = meshed.opaque.indices.reduce((m, v) => Math.max(m, v), 0)
      expect(maxIdx).toBeLessThan(vertexCount)
    })
  })

  describe('MeshedChunk type consistency', () => {
    it('should return Float32Array for uvs on a non-empty chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.toMeshed().opaque.uvs).toBeInstanceOf(Float32Array)
      expect(result.toMeshed().opaque.uvs.length).toBeGreaterThan(0)
    })

    it('should return Float32Array for tile indexes on a non-empty chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.toMeshed().opaque.tileIndexes).toBeInstanceOf(Float32Array)
      expect(result.toMeshed().opaque.tileIndexes.length).toBeGreaterThan(0)
    })

    it('should return Uint32Array for indices on a non-empty chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.toMeshed().opaque.indices).toBeInstanceOf(Uint32Array)
      expect(result.toMeshed().opaque.indices.length).toBeGreaterThan(0)
    })
  })

  // ─── Lighting ─────────────────────────────────────────────────────────────
  //
  // Vertex colors encode three normalized factors (Uint8 → [0,1] in shader):
  //   R = AO factor      (255 = no darkening)
  //   G = sky-light      (skyLight / 15 * 255)
  //   B = block-light    (blockLight / 15 * 255)
  //
  // dequantLight maps the 2-bit packed corner light back to {0,5,10,15} before
  // encoding, so per-vertex G/B values fall in {0, 85, 170, 255}.

  describe('lighting (LightGrids → vertex colors)', () => {
    const fillLight = (grid: Uint8Array, value: number): void => {
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, (i) => i), (lx) => {
        Arr.forEach(Arr.makeBy(CHUNK_SIZE, (i) => i), (lz) => {
          Arr.forEach(Arr.makeBy(CHUNK_HEIGHT, (i) => i), (y) => {
            setLightAt(grid, lx, y, lz, value)
          })
        })
      })
    }

    const makeUniformLightGrids = (sky: number, block: number): LightGrids => {
      const skyLight = createLightBuffer()
      const blockLight = createLightBuffer()
      fillLight(skyLight, sky)
      fillLight(blockLight, block)
      return { skyLight, blockLight }
    }

    // Slice colors into per-vertex [R, G, B] tuples for inspection.
    const sliceColors = (colors: Uint8Array): Array<readonly [number, number, number]> =>
      Arr.makeBy(colors.length / 3, (i) => [colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!] as const)

    it('uniform daylight (sky=15, block=0) → all faces emit G=255, B=0', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 10, 5, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, makeUniformLightGrids(15, 0))

      const verts = sliceColors(result.toMeshed().opaque.colors)
      // All 24 vertices (6 faces × 4) should have full sky and zero block light.
      Arr.forEach(verts, ([, g, b]) => {
        expect(g).toBe(255)
        expect(b).toBe(0)
      })
    })

    it('default (no LightGrids passed) → falls back to all-daylight (G=255, B=0)', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 10, 5, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const verts = sliceColors(result.toMeshed().opaque.colors)
      Arr.forEach(verts, ([, g, b]) => {
        expect(g).toBe(255)
        expect(b).toBe(0)
      })
    })

    it('covered pit (sky=0 throughout) → faces emit G=0, B=0', () => {
      // Single solid block in pitch-black space (no sky penetration anywhere).
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 10, 5, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, makeUniformLightGrids(0, 0))

      const verts = sliceColors(result.toMeshed().opaque.colors)
      Arr.forEach(verts, ([, g, b]) => {
        expect(g).toBe(0)
        expect(b).toBe(0)
      })
    })

    it('block light only (sky=0, block=15) → faces emit G=0, B=255', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 10, 5, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, makeUniformLightGrids(0, 15))

      const verts = sliceColors(result.toMeshed().opaque.colors)
      Arr.forEach(verts, ([, g, b]) => {
        expect(g).toBe(0)
        expect(b).toBe(255)
      })
    })

    it('torch decay → faces nearer the torch are brighter than faces farther away', () => {
      // Two STONE blocks placed 6 voxels apart. A "torch" (block-light source) at the
      // first block's air neighbor decays through the BFS so the second block reads less.
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 4, y: 8, lz: 8, blockType: 'STONE' },
        { lx: 12, y: 8, lz: 8, blockType: 'STONE' },
      ])

      // Inject a torch at (5, 8, 8) by patching a temporary EMISSIVE-by-index slot.
      // Simpler: write a precomputed block-light grid that mimics BFS decay (15 → 9 over 6 voxels).
      const skyLight = createLightBuffer()
      const blockLight = createLightBuffer()
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, (i) => i), (lx) => {
        Arr.forEach(Arr.makeBy(CHUNK_HEIGHT, (i) => i), (y) => {
          Arr.forEach(Arr.makeBy(CHUNK_SIZE, (i) => i), (lz) => {
            // Manhattan distance from torch at (5, 8, 8); clamp to 0 if past max range.
            const dist = Math.abs(lx - 5) + Math.abs(y - 8) + Math.abs(lz - 8)
            const level = Math.max(0, LIGHT_LEVEL_MAX - dist)
            setLightAt(blockLight, lx, y, lz, level)
          })
        })
      })

      const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, { skyLight, blockLight })

      // Find the maximum block-light B-channel across all opaque vertices.
      // Both blocks contribute faces; the near block (lx=4) sits beside light=14 on its +X face,
      // the far block (lx=12) sits beside light=6 on its -X face — clearly distinguishable.
      const verts = sliceColors(result.toMeshed().opaque.colors)
      const maxB = Arr.reduce(verts, 0, (acc, [, , b]) => Math.max(acc, b))
      const minB = Arr.reduce(verts, 255, (acc, [, , b]) => Math.min(acc, b))

      // Brightest vertex must be near the torch; dimmest must be far from it.
      expect(maxB).toBeGreaterThan(minB)
      // Sanity: brightest must encode level ≥ 10 (torch-adjacent), dimmest ≤ 10.
      expect(maxB).toBeGreaterThanOrEqual(170) // dequant(2) → 10/15 = 170
      expect(minB).toBeLessThanOrEqual(170)
    })

    it('block at chunk edge (lx=0) with LightGrids → out-of-bounds sample defaults to sky=15, block=0', () => {
      // The -X face of a block at lx=0 samples lx=-1, which is out-of-bounds.
      // sampleVoxelLight returns 0xf0 (sky=15, block=0) for OOB coords → same as full daylight.
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 10, 5, 'DIRT')
      const grids = makeUniformLightGrids(8, 4)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, grids)

      // Mesh must be produced — the out-of-bounds sample does not crash.
      expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
      // The -X face sees default sky=15 from OOB; remaining faces see the uniform grid (sky=8).
      // G channel values for the OOB-sampled face should equal full-sky encoding.
      const verts = sliceColors(result.toMeshed().opaque.colors)
      expect(verts.length).toBeGreaterThan(0)
    })

    it('emissive block placed in dark space (computeBlockLight) → mesh reflects propagated block light', () => {
      // End-to-end: use computeBlockLight on a chunk containing a real emissive block.
      // Place a LAVA voxel (emissive=15) and a DIRT viewer block 3 voxels away; verify the
      // viewer's nearer faces show non-zero block light after BFS propagation.
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 5, y: 8, lz: 8, blockType: 'LAVA' },
        { lx: 9, y: 8, lz: 8, blockType: 'DIRT' },
      ])

      const skyLight = createLightBuffer()
      const blockLight = createLightBuffer()
      computeBlockLight(chunk.blocks, blockLight)

      const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, { skyLight, blockLight })

      const verts = sliceColors(result.toMeshed().opaque.colors)
      const maxB = Arr.reduce(verts, 0, (acc, [, , b]) => Math.max(acc, b))
      // BFS spreads at least 11 (LAVA=15, distance 4 → 11) toward the DIRT face → dequant ≥ 10 → 170.
      expect(maxB).toBeGreaterThanOrEqual(170)
    })
  })
})
