import type { BlockType } from '@ts-minecraft/core'
import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { Array as Arr,MutableHashSet } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { makeChunkWithBlock,makeChunkWithBlocks,makeEmptyChunk,ZERO_COORD,ZERO_OFFSET,countFacesByNormal,findFirstFaceVertexWithNormal,assertAllXPositionsGte,assertAllZPositionsGte } from './greedy-meshing-test-utils'

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

      // The three top-facing voxels should produce exactly 1 merged quad
      expect(countFacesByNormal(result.toMeshed().opaque.normals, 0, 1, 0)).toBe(1)
    })

    it('keeps merged top face UVs in block units so the atlas tile repeats per block', () => {
      const chunk = makeChunkWithBlocks(ZERO_COORD, [
        { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 1, y: 0, lz: 0, blockType: 'DIRT' },
        { lx: 2, y: 0, lz: 0, blockType: 'DIRT' },
      ])
      const meshed = greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed().opaque

      const topQuadVertex = findFirstFaceVertexWithNormal(meshed.normals, 0, 1, 0)

      expect(topQuadVertex).toBeGreaterThanOrEqual(0)
      const uvOffset = topQuadVertex * 2
      expect(Array.from(meshed.uvs.slice(uvOffset, uvOffset + 8))).toEqual([
        0, 0,
        0, 1,
        3, 1,
        3, 0,
      ])
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
      expect(countFacesByNormal(result.toMeshed().opaque.normals, 0, 1, 0)).toBe(2)
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
      assertAllXPositionsGte(result.toMeshed().opaque.positions, 16)
    })

    it('offsets vertex positions by wz in the geometry', () => {
      // Chunk at coord {x:0, z:2}: wx=0, wz=32
      const coord = { x: 0, z: 2 }
      const offset = { wx: coord.x * CHUNK_SIZE, wz: coord.z * CHUNK_SIZE }
      const chunk = makeChunkWithBlock(coord, 0, 0, 0, 'GRASS')
      const result = greedyMeshChunk(chunk, offset)

      expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
      assertAllZPositionsGte(result.toMeshed().opaque.positions, 32)
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

// ─── Transparent solid (GLASS / LEAVES) meshing ─────────────────────────────

describe('greedyMeshChunk transparent solid meshing', () => {
  const GLASS_ID = blockTypeToIndex('GLASS')
  const LEAVES_ID = blockTypeToIndex('LEAVES')
  const transparentSolidIds = new Set([GLASS_ID, LEAVES_ID])

  it('GLASS block with transparent solid IDs goes to transparentSolid mesh, not opaque', () => {
    const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GLASS')
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)

    expect(result.toMeshed().opaque.positions.length).toBe(0)
    expect(result.toMeshed().water.positions.length).toBe(0)
    expect(result.toMeshed().transparentSolid.positions.length).toBeGreaterThan(0)
  })

  it('LEAVES block with transparent solid IDs goes to transparentSolid mesh, not opaque', () => {
    const chunk = makeChunkWithBlock(ZERO_COORD, 3, 5, 3, 'LEAVES')
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)

    expect(result.toMeshed().opaque.positions.length).toBe(0)
    expect(result.toMeshed().water.positions.length).toBe(0)
    expect(result.toMeshed().transparentSolid.positions.length).toBeGreaterThan(0)
  })

  it('GLASS block without transparent solid IDs remains in opaque mesh', () => {
    const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GLASS')
    const result = greedyMeshChunk(chunk, ZERO_OFFSET)

    expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
    expect(result.toMeshed().transparentSolid.positions.length).toBe(0)
  })

  it('GLASS block produces 6 faces in transparentSolid mesh', () => {
    const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'GLASS')
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)

    // 6 faces × 4 vertices × 3 floats = 72 position components
    expect(result.toMeshed().transparentSolid.positions.length).toBe(72)
    // 6 faces × 2 triangles × 3 indices = 36 indices
    expect(result.toMeshed().transparentSolid.indices.length).toBe(36)
  })

  it('transparentSolidRaw is null when no transparent solid blocks present', () => {
    const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'DIRT')
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)

    expect(result.transparentSolidRaw).toBeNull()
    expect(result.toMeshed().transparentSolid.positions.length).toBe(0)
  })

  it('mixed chunk: DIRT stays opaque, GLASS goes to transparentSolid', () => {
    const chunk = makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
      { lx: 2, y: 0, lz: 0, blockType: 'GLASS' },
    ])
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)

    expect(result.toMeshed().opaque.positions.length).toBeGreaterThan(0)
    expect(result.toMeshed().transparentSolid.positions.length).toBeGreaterThan(0)
    expect(result.toMeshed().water.positions.length).toBe(0)
  })

  // An opaque surface behind glass/leaves must still be drawn — otherwise you
  // see a hole through the transparent block. The opaque block's face toward
  // the transparent-solid neighbour is exposed, while the transparent block's
  // face toward the opaque is culled (so there is exactly one face at the
  // shared plane → no z-fighting).
  it('opaque face adjacent to GLASS is exposed (no see-through hole), glass face behind it is culled', () => {
    const chunk = makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },  // opaque
      { lx: 1, y: 0, lz: 0, blockType: 'GLASS' }, // transparent-solid neighbour on +X
    ])
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)
    const meshed = result.toMeshed()

    // DIRT: all 6 faces exposed (incl. +X toward glass) → 6 × 4 × 3 = 72.
    // Before the fix this was 60 (the +X face was wrongly culled → hole).
    expect(meshed.opaque.positions.length).toBe(72)
    // GLASS: only 5 faces (the -X face toward DIRT is culled) → 60. The shared
    // plane therefore carries exactly one face (the DIRT +X) — no z-fighting.
    expect(meshed.transparentSolid.positions.length).toBe(60)
  })

  it('same opaque block behind LEAVES is exposed too (trunk faces under foliage are not holes)', () => {
    const chunk = makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'WOOD' },
      { lx: 1, y: 0, lz: 0, blockType: 'LEAVES' },
    ])
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)
    // WOOD keeps all 6 faces; its +X face toward the leaves is exposed.
    expect(result.toMeshed().opaque.positions.length).toBe(72)
  })

  it('adjacent same-type transparent-solid blocks cull their shared face (no internal double faces)', () => {
    const chunk = makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'GLASS' },
      { lx: 1, y: 0, lz: 0, blockType: 'GLASS' },
    ])
    const result = greedyMeshChunk(chunk, ZERO_OFFSET, new Set(), undefined, undefined, transparentSolidIds)
    // A 2×1×1 glass run is a box: 6 merged quads = 72 floats. The internal
    // shared face is culled (otherwise it would be 8 quads = 96).
    expect(result.toMeshed().transparentSolid.positions.length).toBe(72)
  })
})
