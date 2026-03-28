import { describe, it, expect } from 'vitest'
import { Array as Arr, MutableHashMap, MutableHashSet, Option } from 'effect'
import { greedyMeshChunk } from './greedy-meshing'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@/domain/chunk'
import type { Chunk, ChunkCoord } from '@/domain/chunk'
import type { BlockType } from '@/domain/block'

// ─── Helpers ───────────────────────────────────────────────────────────────

const makeEmptyChunk = (coord: ChunkCoord): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  return { coord, blocks }
}

const makeChunkWithBlock = (
  coord: ChunkCoord,
  lx: number,
  y: number,
  lz: number,
  blockType: BlockType
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
  blocks[idx] = blockTypeToIndex(blockType)
  return { coord, blocks }
}

const makeChunkWithBlocks = (
  coord: ChunkCoord,
  entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }>
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  for (const { lx, y, lz, blockType } of entries) {
    const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    blocks[idx] = blockTypeToIndex(blockType)
  }
  return { coord, blocks }
}

const ZERO_COORD: ChunkCoord = { x: 0, z: 0 }
const ZERO_OFFSET = { wx: 0, wz: 0 }

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('greedyMeshChunk', () => {
  describe('empty chunk (all AIR)', () => {
    it('produces no geometry when all blocks are AIR', () => {
      const chunk = makeEmptyChunk(ZERO_COORD)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.positions.length).toBe(0)
      expect(result.opaque.normals.length).toBe(0)
      expect(result.opaque.colors.length).toBe(0)
      expect(result.opaque.indices.length).toBe(0)
      expect(result.opaque.blockPositions.length).toBe(0)
    })

    it('returns typed arrays with zero length', () => {
      const chunk = makeEmptyChunk(ZERO_COORD)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.positions).toBeInstanceOf(Float32Array)
      expect(result.opaque.normals).toBeInstanceOf(Float32Array)
      expect(result.opaque.colors).toBeInstanceOf(Float32Array)
      expect(result.opaque.indices).toBeInstanceOf(Uint32Array)
    })
  })

  describe('single solid block', () => {
    it('produces 6 faces for a DIRT block at origin with all AIR neighbors', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // 6 faces × 4 vertices × 3 floats = 72 position components
      expect(result.opaque.positions.length).toBe(72)
      // 6 faces × 4 normals × 3 floats = 72 normal components
      expect(result.opaque.normals.length).toBe(72)
      // 6 faces × 4 vertices × 3 color channels = 72 color components
      expect(result.opaque.colors.length).toBe(72)
      // 6 faces × 2 triangles × 3 indices = 36 indices
      expect(result.opaque.indices.length).toBe(36)
      // one blockPosition entry per quad
      expect(result.opaque.blockPositions.length).toBe(6)
    })

    it('produces 6 faces for a STONE block in the interior of the chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 10, 5, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.positions.length).toBe(72)
      expect(result.opaque.indices.length).toBe(36)
      expect(result.opaque.blockPositions.length).toBe(6)
    })

    it('produces valid index values that reference existing vertices', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const vertexCount = result.opaque.positions.length / 3
      for (let i = 0; i < result.opaque.indices.length; i++) {
        const idx = result.opaque.indices[i]
        expect(idx).toBeDefined()
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx!).toBeLessThan(vertexCount)
      }
    })
  })

  describe('greedy merging — adjacent same-type blocks', () => {
    it('merges 3 adjacent DIRT blocks in a row into fewer quads than 3×6', () => {
      // Three DIRT blocks at (0,0,0), (1,0,0), (2,0,0)
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 1, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 2, y: 0, lz: 0, blockType: 'DIRT' },
      ])
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Without merging: 3 blocks × 6 faces = 18 quads (108 pos floats)
      // With merging all 6 directions are merged to 1 quad each = 6 quads total
      // The total should be strictly less than 18 quads
      const quadCount = result.opaque.blockPositions.length
      expect(quadCount).toBeLessThan(18)
      // Fully merged: 6 faces total (each direction produces 1 merged quad)
      expect(quadCount).toBe(6)
    })

    it('merges top face of a 3×1×1 row into a single quad', () => {
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 1, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 2, y: 0, lz: 0, blockType: 'DIRT' },
      ])
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Top face normals are (0, 1, 0); count quads with that normal
      let topFaceCount = 0
      const normalCount = result.opaque.normals.length / 3
      // Each quad contributes 4 normals; check every 4th normal
      for (let v = 0; v < normalCount; v += 4) {
        const nx = result.opaque.normals[v * 3]
        const ny = result.opaque.normals[v * 3 + 1]
        const nz = result.opaque.normals[v * 3 + 2]
        if (nx === 0 && ny === 1 && nz === 0) {
          topFaceCount++
        }
      }
      // The three top-facing voxels should produce exactly 1 merged quad
      expect(topFaceCount).toBe(1)
    })

    it('merges a 3×1×3 flat layer of STONE blocks into 6 quads', () => {
      const entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }> = []
      for (let lx = 0; lx < 3; lx++) {
        for (let lz = 0; lz < 3; lz++) {
          entries.push({ lx, y: 0, lz, blockType: 'STONE' })
        }
      }
      const chunk = makeChunkWithBlocks(ZERO_COORD, entries)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // With full greedy merging a 3×3 solid slab at y=0 should produce
      // 6 quads (top, bottom, +X side, -X side, +Z side, -Z side)
      expect(result.opaque.blockPositions.length).toBe(6)
    })
  })

  describe('different block types are NOT merged', () => {
    it('does not merge DIRT and STONE top faces', () => {
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 1, y: 0, lz: 0, blockType: 'STONE' },
      ])
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Each block has 6 faces; internal +X/-X faces between the two blocks
      // are NOT visible (solid neighbors), so we get fewer than 12 but more
      // than 6.  Top faces must remain separate (2 quads with normal 0,1,0).
      let topFaceCount = 0
      const normalCount = result.opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const nx = result.opaque.normals[v * 3]
        const ny = result.opaque.normals[v * 3 + 1]
        const nz = result.opaque.normals[v * 3 + 2]
        if (nx === 0 && ny === 1 && nz === 0) {
          topFaceCount++
        }
      }
      expect(topFaceCount).toBe(2)
    })

    it('produces more quads for two different adjacent types than for two same-type', () => {
      const chunkSame = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 1, y: 0, lz: 0, blockType: 'DIRT' },
      ])
      const chunkDiff = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 1, y: 0, lz: 0, blockType: 'STONE' },
      ])
      const resultSame = greedyMeshChunk(chunkSame, ZERO_OFFSET)
      const resultDiff = greedyMeshChunk(chunkDiff, ZERO_OFFSET)

      // Same type: all merging possible; different type: top/bottom cannot merge
      expect(resultDiff.opaque.blockPositions.length).toBeGreaterThan(resultSame.opaque.blockPositions.length)
    })
  })

  describe('AIR blocks produce no faces', () => {
    it('AIR-adjacent face of a DIRT block is visible (rendered)', () => {
      // DIRT at (0,0,0) with all neighbors being AIR — all 6 faces visible
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.blockPositions.length).toBe(6)
    })

    it('two stacked DIRT blocks share an internal face which is hidden', () => {
      // DIRT at (0,0,0) and DIRT at (0,1,0): the face between them is hidden
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 0, y: 1, lz: 0, blockType: 'DIRT' },
      ])
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Two isolated blocks would give 12 quads, but greedy merging combines
      // all four side faces (±X, ±Z) into single merged quads spanning y=0..2,
      // the top +Y face from y=1 and the bottom -Y face from y=0 remain.
      // Internal faces (top of y=0 block, bottom of y=1 block) are hidden.
      // Result: 6 merged quads total (all directions merge to 1 each).
      expect(result.opaque.blockPositions.length).toBe(6)
    })
  })

  describe('blockPositions world coordinates', () => {
    it('records the correct world position for a block in a zero-offset chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 3, 7, 5, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // blockPositions are per-quad; all 6 quads point to the same source block
      expect(result.opaque.blockPositions.length).toBe(6)

      for (const pos of result.opaque.blockPositions) {
        expect(pos.x).toBe(3)  // wx + lx = 0 + 3
        expect(pos.y).toBe(7)
        expect(pos.z).toBe(5)  // wz + lz = 0 + 5
      }
    })

    it('applies chunk world offset to blockPositions', () => {
      // Chunk at coord {x:2, z:3} means wx=32, wz=48
      const coord: ChunkCoord = { x: 2, z: 3 }
      const offset = { wx: coord.x * CHUNK_SIZE, wz: coord.z * CHUNK_SIZE }
      const chunk = makeChunkWithBlock(coord, 1, 5, 2, 'STONE')
      const result = greedyMeshChunk(chunk, offset)

      expect(result.opaque.blockPositions.length).toBe(6)

      for (const pos of result.opaque.blockPositions) {
        expect(pos.x).toBe(32 + 1)  // 33
        expect(pos.y).toBe(5)
        expect(pos.z).toBe(48 + 2)  // 50
      }
    })
  })

  describe('chunk at non-zero world offset', () => {
    it('offsets vertex positions by wx in the geometry', () => {
      // Chunk at coord {x:1, z:0}: wx=16, wz=0
      const coord: ChunkCoord = { x: 1, z: 0 }
      const offset = { wx: coord.x * CHUNK_SIZE, wz: coord.z * CHUNK_SIZE }
      const chunk = makeChunkWithBlock(coord, 0, 10, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, offset)

      // All X coordinates in positions must be >= 16 (wx offset applied)
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      for (let i = 0; i < result.opaque.positions.length; i += 3) {
        const x = result.opaque.positions[i]
        expect(x).toBeGreaterThanOrEqual(16)
      }
    })

    it('offsets vertex positions by wz in the geometry', () => {
      // Chunk at coord {x:0, z:2}: wx=0, wz=32
      const coord: ChunkCoord = { x: 0, z: 2 }
      const offset = { wx: coord.x * CHUNK_SIZE, wz: coord.z * CHUNK_SIZE }
      const chunk = makeChunkWithBlock(coord, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, offset)

      expect(result.opaque.positions.length).toBeGreaterThan(0)
      for (let i = 0; i < result.opaque.positions.length; i += 3) {
        const z = result.opaque.positions[i + 2]
        expect(z).toBeGreaterThanOrEqual(32)
      }
    })
  })

  describe('face normals', () => {
    it('produces exactly 6 distinct face normals for a single block', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const seenNormals = MutableHashSet.empty<string>()
      // Each quad has 4 identical normals; sample one per quad (every 4 vertices)
      const vertCount = result.opaque.normals.length / 3
      for (let v = 0; v < vertCount; v += 4) {
        const nx = result.opaque.normals[v * 3]
        const ny = result.opaque.normals[v * 3 + 1]
        const nz = result.opaque.normals[v * 3 + 2]
        MutableHashSet.add(seenNormals, `${nx},${ny},${nz}`)
      }

      expect(MutableHashSet.size(seenNormals)).toBe(6)
      expect(MutableHashSet.has(seenNormals, '1,0,0')).toBe(true)   // +X
      expect(MutableHashSet.has(seenNormals, '-1,0,0')).toBe(true)  // -X
      expect(MutableHashSet.has(seenNormals, '0,1,0')).toBe(true)   // +Y
      expect(MutableHashSet.has(seenNormals, '0,-1,0')).toBe(true)  // -Y
      expect(MutableHashSet.has(seenNormals, '0,0,1')).toBe(true)   // +Z
      expect(MutableHashSet.has(seenNormals, '0,0,-1')).toBe(true)  // -Z
    })
  })

  describe('block colors (AO grayscale factors)', () => {
    it('assigns a non-zero color to a DIRT block', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.colors.length).toBe(72)  // 6 faces × 4 verts × 3 channels
      // Colors are grayscale AO factors (1.0 = no darkening) — must be non-zero
      const hasNonZero = Arr.some(Arr.fromIterable(result.opaque.colors), (v) => v > 0)
      expect(hasNonZero).toBe(true)
    })

    it('assigns equal grayscale AO colors to DIRT and STONE at same position (texture provides color)', () => {
      const dirtChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const stoneChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'STONE')
      const dirtResult = greedyMeshChunk(dirtChunk, ZERO_OFFSET)
      const stoneResult = greedyMeshChunk(stoneChunk, ZERO_OFFSET)

      // Both have ao=0 (no solid neighbors), so both should be factor=1.0
      expect(dirtResult.opaque.colors[0]).toBe(1.0)
      expect(stoneResult.opaque.colors[0]).toBe(1.0)
    })

    it('assigns different UVs to DIRT and STONE blocks (atlas tile lookup)', () => {
      const dirtChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const stoneChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'STONE')
      const dirtResult = greedyMeshChunk(dirtChunk, ZERO_OFFSET)
      const stoneResult = greedyMeshChunk(stoneChunk, ZERO_OFFSET)

      // DIRT maps to atlas tile 0, STONE to tile 1 — u0 values must differ
      expect(dirtResult.opaque.uvs[0]).not.toBe(stoneResult.opaque.uvs[0])
    })
  })

  describe('UV coordinates', () => {
    it('returns uvs as Float32Array', () => {
      const chunk = makeEmptyChunk(ZERO_COORD)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.opaque.uvs).toBeInstanceOf(Float32Array)
    })

    it('uvs length equals 2 UV components per vertex', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      const vertexCount = result.opaque.positions.length / 3
      expect(result.opaque.uvs.length).toBe(vertexCount * 2)
    })

    it('all UV values are in [0, 1] range', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      for (const uv of result.opaque.uvs) {
        expect(uv).toBeGreaterThanOrEqual(0)
        expect(uv).toBeLessThanOrEqual(1)
      }
    })

    it('GRASS top face has different UV than GRASS side face', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Collect first UV per face direction by checking normals
      const uvsByNormal = MutableHashMap.empty<string, number>()
      const vertCount = result.opaque.normals.length / 3
      let uvOffset = 0
      for (let v = 0; v < vertCount; v += 4) {
        const ny = Option.getOrElse(Option.fromNullable(result.opaque.normals[v * 3 + 1]), () => 0)
        const nz = Option.getOrElse(Option.fromNullable(result.opaque.normals[v * 3 + 2]), () => 0)
        const key = ny === 1 ? 'top' : nz !== 0 ? 'side' : 'other'
        if (!MutableHashMap.has(uvsByNormal, key)) {
          MutableHashMap.set(uvsByNormal, key, Option.getOrElse(Option.fromNullable(result.opaque.uvs[uvOffset]), () => 0))
        }
        uvOffset += 8  // 4 verts × 2 UV components
      }

      // grass_top (tile 4) and grass_side (tile 5) have different u0
      expect(Option.getOrElse(MutableHashMap.get(uvsByNormal, 'top'), () => -1))
        .not.toBe(Option.getOrElse(MutableHashMap.get(uvsByNormal, 'side'), () => -2))
    })
  })

  describe('output array lengths are consistent', () => {
    it('positions, normals, and colors all have the same length', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 5, 5, 'WOOD')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.positions.length).toBe(result.opaque.normals.length)
      expect(result.opaque.positions.length).toBe(result.opaque.colors.length)
    })

    it('index count is consistent with vertex count (2 triangles per quad)', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 5, 5, 'WOOD')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const quadCount = result.opaque.blockPositions.length
      const vertexCount = result.opaque.positions.length / 3

      expect(vertexCount).toBe(quadCount * 4)
      expect(result.opaque.indices.length).toBe(quadCount * 6)
    })
  })

  describe('large flat surface merging efficiency', () => {
    it('16x16 flat layer at y=0 produces exactly 6 quads', () => {
      const entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }> = []
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          entries.push({ lx, y: 0, lz, blockType: 'STONE' })
        }
      }
      const chunk = makeChunkWithBlocks(ZERO_COORD, entries)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // A full 16x16 slab at y=0 should merge into exactly 6 faces
      expect(result.opaque.blockPositions.length).toBe(6)
    })

    it('16x16 flat layer produces far fewer quads than 16*16*6', () => {
      const entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }> = []
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          entries.push({ lx, y: 10, lz, blockType: 'DIRT' })
        }
      }
      const chunk = makeChunkWithBlocks(ZERO_COORD, entries)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Without merging: 256 blocks * 6 faces = 1536 quads
      // With full merging: 6 quads
      expect(result.opaque.blockPositions.length).toBeLessThan(1536)
      expect(result.opaque.blockPositions.length).toBe(6)
    })
  })

  describe('chunk boundary blocks', () => {
    it('block at chunk edge (lx=15) should have exposed face towards positive X', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 15, 0, 0, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Should have 6 faces (all exposed at chunk boundary)
      expect(result.opaque.blockPositions.length).toBe(6)

      // Check that +X face normal exists
      let hasPositiveXFace = false
      const normalCount = result.opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const nx = result.opaque.normals[v * 3]
        if (nx === 1) {
          hasPositiveXFace = true
          break
        }
      }
      expect(hasPositiveXFace).toBe(true)
    })

    it('block at chunk edge (lz=15) should have exposed face towards positive Z', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 15, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.blockPositions.length).toBe(6)

      // Check that +Z face normal exists
      let hasPositiveZFace = false
      const normalCount = result.opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const nz = result.opaque.normals[v * 3 + 2]
        if (nz === 1) {
          hasPositiveZFace = true
          break
        }
      }
      expect(hasPositiveZFace).toBe(true)
    })

    it('block at top of chunk (y=CHUNK_HEIGHT-1) should have an exposed +Y face', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, CHUNK_HEIGHT - 1, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.blockPositions.length).toBe(6)

      let hasTopFace = false
      const normalCount = result.opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const ny = result.opaque.normals[v * 3 + 1]
        if (ny === 1) {
          hasTopFace = true
          break
        }
      }
      expect(hasTopFace).toBe(true)
    })

    it('block at y=0 should have an exposed -Y (bottom) face', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 8, 0, 8, 'GRASS')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.opaque.blockPositions.length).toBe(6)

      let hasBottomFace = false
      const normalCount = result.opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const ny = result.opaque.normals[v * 3 + 1]
        if (ny === -1) {
          hasBottomFace = true
          break
        }
      }
      expect(hasBottomFace).toBe(true)
    })
  })

  describe('all block types produce geometry', () => {
    const testBlockTypes: BlockType[] = ['DIRT', 'STONE', 'GRASS', 'WOOD', 'SAND', 'LEAVES']

    for (const blockType of testBlockTypes) {
      it(`${blockType} block produces 6 faces when isolated`, () => {
        const chunk = makeChunkWithBlock(ZERO_COORD, 3, 3, 3, blockType)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        expect(result.opaque.blockPositions.length).toBe(6)
        expect(result.opaque.positions.length).toBe(72)  // 6 faces * 4 verts * 3 floats
        expect(result.opaque.indices.length).toBe(36)    // 6 faces * 2 tris * 3 indices
      })
    }
  })

  describe('WATER block routing', () => {
    const TRANSPARENT_BLOCK_IDS = new Set([blockTypeToIndex('WATER')])

    it('a chunk with a single WATER block routes geometry to result.water, not result.opaque, when transparentBlockIds is passed', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 4, 10, 4, 'WATER')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_BLOCK_IDS)

      // Water geometry must be non-empty
      expect(result.water.positions.length).toBeGreaterThan(0)
      // Opaque geometry must be empty (only WATER block present)
      expect(result.opaque.positions.length).toBe(0)
    })

    it('a chunk with DIRT and WATER produces separate geometry in result.opaque (DIRT) and result.water (WATER)', () => {
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 2, y: 0, lz: 0, blockType: 'WATER' },
      ])
      const result = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_BLOCK_IDS)

      // Both accumulators should have geometry
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      expect(result.water.positions.length).toBeGreaterThan(0)
    })

    it('a chunk with WATER but no transparentBlockIds passed routes WATER to result.opaque', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 4, 10, 4, 'WATER')
      // No transparentBlockIds argument — uses default empty Set
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Without transparent routing, WATER goes to opaque
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      expect(result.water.positions.length).toBe(0)
    })
  })

  describe('MeshedChunk type consistency', () => {
    it('should return Float32Array for uvs on a non-empty chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.opaque.uvs).toBeInstanceOf(Float32Array)
      expect(result.opaque.uvs.length).toBeGreaterThan(0)
    })

    it('should return Uint32Array for indices on a non-empty chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)
      expect(result.opaque.indices).toBeInstanceOf(Uint32Array)
      expect(result.opaque.indices.length).toBeGreaterThan(0)
    })
  })
})
