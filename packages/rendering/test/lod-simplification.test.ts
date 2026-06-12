import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  greedyMeshChunk,
  simplifyMesh,
  lodForDistance,
  packQuadKey,
  LOD1_DISTANCE_CHUNKS,
  LOD2_DISTANCE_CHUNKS,
  type MeshedChunk,
  type LodLevel,
} from '@ts-minecraft/rendering'
import { makeChunkWithBlocks, makeEmptyChunk, ZERO_COORD, ZERO_OFFSET } from './greedy-meshing-test-utils'

const fillSlab = (y: number) => {
  // Fill an entire CHUNK_SIZE × CHUNK_SIZE slab with DIRT at height `y`.
  const entries: Array<{ lx: number; y: number; lz: number; blockType: 'DIRT' }> = []
  for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
    for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
      entries.push({ lx, y, lz, blockType: 'DIRT' })
    }
  }
  return entries
}

const meshSlab = (): MeshedChunk => {
  const chunk = makeChunkWithBlocks(ZERO_COORD, fillSlab(64))
  return greedyMeshChunk(chunk, ZERO_OFFSET).toMeshed().opaque
}

// Vertex count of a quad = 4; vertex count divisible by 4 ⇔ valid greedy output.
const expectQuadInvariants = (m: MeshedChunk): void => {
  expect(m.positions.length % 12).toBe(0)
  expect(m.indices.length % 6).toBe(0)
  expect(m.indices.length / 6).toBe(m.positions.length / 12)
}

describe('lodForDistance', () => {
  it('returns 0 for distances below LOD1_DISTANCE_CHUNKS', () => {
    expect(lodForDistance(0)).toBe(0)
    expect(lodForDistance(LOD1_DISTANCE_CHUNKS - 1)).toBe(0)
  })

  it('returns 1 between LOD1_DISTANCE_CHUNKS and LOD2_DISTANCE_CHUNKS', () => {
    expect(lodForDistance(LOD1_DISTANCE_CHUNKS)).toBe(1)
    expect(lodForDistance(LOD2_DISTANCE_CHUNKS - 1)).toBe(1)
  })

  it('returns 2 at or beyond LOD2_DISTANCE_CHUNKS', () => {
    expect(lodForDistance(LOD2_DISTANCE_CHUNKS)).toBe(2)
    expect(lodForDistance(LOD2_DISTANCE_CHUNKS + 4)).toBe(2)
  })
})

describe('simplifyMesh', () => {
  it('LOD 0 returns the input unchanged (referential equality on arrays)', () => {
    const meshed = meshSlab()
    const simplified = simplifyMesh(meshed, 0)
    expect(simplified).toBe(meshed)
    expect(simplified.positions).toBe(meshed.positions)
    expect(simplified.indices).toBe(meshed.indices)
  })

  it('LOD 0 on an empty chunk is a no-op', () => {
    const empty = greedyMeshChunk(makeEmptyChunk(ZERO_COORD), ZERO_OFFSET).toMeshed().opaque
    expect(empty.indices.length).toBe(0)
    const simplified = simplifyMesh(empty, 0)
    expect(simplified).toBe(empty)
  })

  it('LOD 1/2 on an empty chunk returns the (empty) input unchanged', () => {
    const empty = greedyMeshChunk(makeEmptyChunk(ZERO_COORD), ZERO_OFFSET).toMeshed().opaque
    expect(simplifyMesh(empty, 1)).toBe(empty)
    expect(simplifyMesh(empty, 2)).toBe(empty)
  })

  it('LOD 1 preserves quad-count and vertex/index invariants', () => {
    const meshed = meshSlab()
    const lod1 = simplifyMesh(meshed, 1)
    expectQuadInvariants(lod1)
    // Same number of quads (we snap extents, not merge quads across the source layout).
    expect(lod1.indices.length).toBe(meshed.indices.length)
    expect(lod1.positions.length).toBe(meshed.positions.length)
  })

  it('LOD 2 preserves quad-count and vertex/index invariants', () => {
    const meshed = meshSlab()
    const lod2 = simplifyMesh(meshed, 2)
    expectQuadInvariants(lod2)
    expect(lod2.indices.length).toBe(meshed.indices.length)
  })

  it('LOD 1 snaps quad extents to even multiples on horizontal faces', () => {
    // 1×1 voxel produces 4 unit-quads; LOD 1 snaps each unit quad outward to 2×2.
    const meshed = greedyMeshChunk(makeChunkWithBlocks(ZERO_COORD, [
      { lx: 1, y: 1, lz: 1, blockType: 'DIRT' },
    ]), ZERO_OFFSET).toMeshed().opaque
    const lod1 = simplifyMesh(meshed, 1)
    // For top face (Y normal): both X and Z extents snap to mod-2 grid.
    // Inspect the first quad with normal (0,1,0) — top face — and check its X bbox.
    let topMinX = Infinity, topMaxX = -Infinity
    for (let v = 0; v < lod1.positions.length / 3; v += 1) {
      if (lod1.normals[v * 3 + 1] === 1) {
        const x = lod1.positions[v * 3 + 0]!
        if (x < topMinX) topMinX = x
        if (x > topMaxX) topMaxX = x
      }
    }
    expect(topMinX % 2).toBe(0)
    expect(topMaxX % 2).toBe(0)
    expect(topMaxX - topMinX).toBeGreaterThanOrEqual(2)
  })

  it('LOD 1 preserves Y silhouette on side faces (X-normal)', () => {
    const meshed = greedyMeshChunk(makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'DIRT' },
    ]), ZERO_OFFSET).toMeshed().opaque
    const lod1 = simplifyMesh(meshed, 1)

    // The +X face spans Y=[0,1]; LOD 1 must NOT snap Y on side faces.
    let sideYs: number[] = []
    for (let v = 0; v < lod1.positions.length / 3; v += 1) {
      if (lod1.normals[v * 3 + 0] === 1) {
        sideYs.push(lod1.positions[v * 3 + 1]!)
      }
    }
    // Y values stay in [0,1] (1-unit tall block silhouette preserved).
    expect(Math.min(...sideYs)).toBe(0)
    expect(Math.max(...sideYs)).toBe(1)
  })

  it('LOD 1 keeps per-quad attributes (normals, tile indexes) intact', () => {
    const meshed = meshSlab()
    const lod1 = simplifyMesh(meshed, 1)

    // Normals: every set of 4 vertices in one quad should share the same normal.
    for (let v = 0; v < lod1.positions.length / 3; v += 4) {
      const nx = lod1.normals[v * 3 + 0]!
      const ny = lod1.normals[v * 3 + 1]!
      const nz = lod1.normals[v * 3 + 2]!
      for (let i = 1; i < 4; i += 1) {
        expect(lod1.normals[(v + i) * 3 + 0]).toBe(nx)
        expect(lod1.normals[(v + i) * 3 + 1]).toBe(ny)
        expect(lod1.normals[(v + i) * 3 + 2]).toBe(nz)
      }
    }

    // tileIndex of LOD1 quad equals the source quad's tileIndex (we never merge across types).
    Arr.forEach(Arr.makeBy(lod1.tileIndexes.length, (i) => i), (i) => {
      const srcIdx = meshed.tileIndexes[i]!
      expect(lod1.tileIndexes[i]).toBe(srcIdx)
    })
  })

  it('LOD 1 outputs index pattern [v,v+1,v+2,v,v+2,v+3] per quad', () => {
    const meshed = meshSlab()
    const lod1 = simplifyMesh(meshed, 1)
    for (let q = 0; q < lod1.indices.length / 6; q += 1) {
      const base = q * 4
      const o = q * 6
      expect(lod1.indices[o + 0]).toBe(base)
      expect(lod1.indices[o + 1]).toBe(base + 1)
      expect(lod1.indices[o + 2]).toBe(base + 2)
      expect(lod1.indices[o + 3]).toBe(base)
      expect(lod1.indices[o + 4]).toBe(base + 2)
      expect(lod1.indices[o + 5]).toBe(base + 3)
    }
  })

  it['each']([1, 2] as const satisfies readonly LodLevel[])(
    'LOD %i fits within LOD-1/2 vertex-count expectation for a full slab',
    (lod: LodLevel) => {
      const meshed = meshSlab()
      const simplified = simplifyMesh(meshed, lod)
      // Full slab → 1 huge merged top quad + 1 bottom quad + side faces. Greedy
      // already produces minimal output; LOD just snaps extents. Size never grows.
      expect(simplified.positions.length).toBeLessThanOrEqual(meshed.positions.length)
      expect(simplified.indices.length).toBeLessThanOrEqual(meshed.indices.length)
    }
  )
})

describe('packQuadKey collision safety', () => {
  it('produces distinct keys for distinct inputs', () => {
    // Verify no collision across the full input range for normals
    // and boundary values for positions. Uses Set to detect duplicates.
    const seen = new Set<number>()
    for (let nx = -1; nx <= 1; nx++) {
    for (let ny = -1; ny <= 1; ny++) {
    for (let nz = -1; nz <= 1; nz++) {
    for (const p0x of [0, 8, 16]) {
    for (const p0y of [0, 128, 255]) {
    for (const p0z of [0, 8, 16]) {
    for (const p2x of [0, 8, 16]) {
    for (const p2y of [0, 128, 255]) {
    for (const p2z of [0, 8, 16]) {
      const key = packQuadKey(nx, ny, nz, p0x, p0y, p0z, p2x, p2y, p2z)
      expect(seen.has(key), `collision for (${nx},${ny},${nz}, ${p0x},${p0y},${p0z}, ${p2x},${p2y},${p2z})`).toBe(false)
      seen.add(key)
    }}}}}}}}}
    // 3^3 × 3^4 × 3^2 = 27 × 81 × 9 = 19683
    expect(seen.size).toBe(19683)
  })

  it('distinguishes swapped p0/p2 corners', () => {
    const k1 = packQuadKey(0, 1, 0, 0, 0, 0, 16, 16, 16)
    const k2 = packQuadKey(0, 1, 0, 16, 16, 16, 0, 0, 0)
    expect(k1).not.toBe(k2)
  })

  it('distinguishes normal directions', () => {
    const up    = packQuadKey(0,  1, 0, 0, 0, 0, 1, 0, 1)
    const north = packQuadKey(0,  0,-1, 0, 0, 0, 1, 0, 1)
    const east  = packQuadKey(1,  0, 0, 0, 0, 0, 1, 0, 1)
    const down  = packQuadKey(0, -1, 0, 0, 0, 0, 1, 0, 1)
    const south = packQuadKey(0,  0, 1, 0, 0, 0, 1, 0, 1)
    const west  = packQuadKey(-1, 0, 0, 0, 0, 0, 1, 0, 1)
    const keys = [up, north, east, down, south, west]
    expect(new Set(keys).size).toBe(6)
  })
})
