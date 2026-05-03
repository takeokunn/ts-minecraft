import { describe, it, expect } from 'vitest'
import { Array as Arr, MutableHashMap, MutableHashSet, Option } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import { makeEmptyChunk, makeChunkWithBlock, makeChunkWithBlocks, ZERO_COORD, ZERO_OFFSET } from './greedy-meshing-test-utils'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('greedyMeshChunk', () => {
  describe('empty chunk (all AIR)', () => {
    it('produces no geometry when all blocks are AIR', () => {
      const chunk = makeEmptyChunk(ZERO_COORD)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.positions.length).toBe(0)
      expect(result.toMeshed().opaque.normals.length).toBe(0)
      expect(result.toMeshed().opaque.colors.length).toBe(0)
      expect(result.toMeshed().opaque.indices.length).toBe(0)
      expect(result.toMeshed().opaque.indices.length).toBe(0)
    })

    it('returns typed arrays with zero length', () => {
      const chunk = makeEmptyChunk(ZERO_COORD)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.positions).toBeInstanceOf(Float32Array)
      expect(result.toMeshed().opaque.normals).toBeInstanceOf(Int8Array)
      expect(result.toMeshed().opaque.colors).toBeInstanceOf(Uint8Array)
      expect(result.toMeshed().opaque.indices).toBeInstanceOf(Uint32Array)
    })
  })

  describe('single solid block', () => {
    it('produces 6 faces for a DIRT block at origin with all AIR neighbors', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // 6 faces × 4 vertices × 3 floats = 72 position components
      expect(result.toMeshed().opaque.positions.length).toBe(72)
      // 6 faces × 4 normals × 3 floats = 72 normal components
      expect(result.toMeshed().opaque.normals.length).toBe(72)
      // 6 faces × 4 vertices × 3 color channels = 72 color components
      expect(result.toMeshed().opaque.colors.length).toBe(72)
      // 6 faces × 2 triangles × 3 indices = 36 indices
      expect(result.toMeshed().opaque.indices.length).toBe(36)
      // one blockPosition entry per quad
      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
    })

    it('produces 6 faces for a STONE block in the interior of the chunk', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 10, 5, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.positions.length).toBe(72)
      expect(result.toMeshed().opaque.indices.length).toBe(36)
      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
    })

    it('produces valid index values that reference existing vertices', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const vertexCount = result.toMeshed().opaque.positions.length / 3
      Arr.forEach(Arr.makeBy(result.toMeshed().opaque.indices.length, i => i), i => {
        const idx = result.toMeshed().opaque.indices[i]
        expect(idx).toBeDefined()
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx!).toBeLessThan(vertexCount)
      })
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
      const quadCount = result.toMeshed().opaque.indices.length / 6
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
      const normalCount = result.toMeshed().opaque.normals.length / 3
      // Each quad contributes 4 normals; check every 4th normal
      for (let v = 0; v < normalCount; v += 4) {
        const nx = result.toMeshed().opaque.normals[v * 3]
        const ny = result.toMeshed().opaque.normals[v * 3 + 1]
        const nz = result.toMeshed().opaque.normals[v * 3 + 2]
        if (nx === 0 && ny === 1 && nz === 0) {
          topFaceCount++
        }
      }
      // The three top-facing voxels should produce exactly 1 merged quad
      expect(topFaceCount).toBe(1)
    })

    it('merges a 3×1×3 flat layer of STONE blocks into 6 quads', () => {
      const entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }> = []
      Arr.forEach(Arr.makeBy(3, lx => lx), lx => {
        Arr.forEach(Arr.makeBy(3, lz => lz), lz => {
          entries.push({ lx, y: 0, lz, blockType: 'STONE' })
        })
      })
      const chunk = makeChunkWithBlocks(ZERO_COORD, entries)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // With full greedy merging a 3×3 solid slab at y=0 should produce
      // 6 quads (top, bottom, +X side, -X side, +Z side, -Z side)
      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
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
      const normalCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const nx = result.toMeshed().opaque.normals[v * 3]
        const ny = result.toMeshed().opaque.normals[v * 3 + 1]
        const nz = result.toMeshed().opaque.normals[v * 3 + 2]
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
      expect(resultDiff.toMeshed().opaque.indices.length / 6).toBeGreaterThan(resultSame.toMeshed().opaque.indices.length / 6)
    })
  })

  describe('AIR blocks produce no faces', () => {
    it('AIR-adjacent face of a DIRT block is visible (rendered)', () => {
      // DIRT at (0,0,0) with all neighbors being AIR — all 6 faces visible
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
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
      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
    })
  })

  describe('chunk at non-zero world offset', () => {
    it('offsets vertex positions by wx in the geometry', () => {
      // Chunk at coord {x:1, z:0}: wx=16, wz=0
      const coord = { x: 1, z: 0 }
      const offset = { wx: coord.x * CHUNK_SIZE, wz: coord.z * CHUNK_SIZE }
      const chunk = makeChunkWithBlock(coord, 0, 10, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, offset)

      // All X coordinates in positions must be >= 16 (wx offset applied)
      expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
      for (let i = 0; i < result.toMeshed().opaque.positions.length; i += 3) {
        const x = result.toMeshed().opaque.positions[i]
        expect(x).toBeGreaterThanOrEqual(16)
      }
    })

    it('offsets vertex positions by wz in the geometry', () => {
      // Chunk at coord {x:0, z:2}: wx=0, wz=32
      const coord = { x: 0, z: 2 }
      const offset = { wx: coord.x * CHUNK_SIZE, wz: coord.z * CHUNK_SIZE }
      const chunk = makeChunkWithBlock(coord, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, offset)

      expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
      for (let i = 0; i < result.toMeshed().opaque.positions.length; i += 3) {
        const z = result.toMeshed().opaque.positions[i + 2]
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
      const vertCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < vertCount; v += 4) {
        const nx = result.toMeshed().opaque.normals[v * 3]
        const ny = result.toMeshed().opaque.normals[v * 3 + 1]
        const nz = result.toMeshed().opaque.normals[v * 3 + 2]
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

})
