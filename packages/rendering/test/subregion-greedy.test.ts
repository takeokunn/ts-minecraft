import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import type { ChunkCoord, BlockType } from '@ts-minecraft/core'
import { createFluidBuffer, encodeFluidCell } from '@ts-minecraft/world'
import type { Chunk } from '@ts-minecraft/world'
import {
  greedyMeshChunk,
  greedyMeshChunkSubregion,
  computeAffectedSlices,
  type MeshedChunk,
} from '@ts-minecraft/rendering'
import type { DirtyAABB } from '../infrastructure/meshing/subregion-greedy'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const ZERO_COORD: ChunkCoord = { x: 0, z: 0 }
const ZERO_OFFSET = { wx: 0, wz: 0 }

const blockIndex = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeEmptyChunk = (coord: ChunkCoord = ZERO_COORD): Chunk => ({
  coord,
  blocks: new Uint8Array(TOTAL_BLOCKS),
  fluid: Option.some(createFluidBuffer()),
})

const setBlock = (chunk: Chunk, lx: number, y: number, lz: number, type: BlockType): void => {
  const index = blockIndex(lx, y, lz)
  chunk.blocks[index] = blockTypeToIndex(type)
  const fluid = Option.getOrNull(chunk.fluid)
  if (fluid !== null) {
    fluid[index] = type === 'WATER' ? encodeFluidCell({ level: 0, source: true, type: 'water' }) : 0
  }
}

// Multiset signature of a meshed buffer: count quads keyed by their full
// per-vertex content (positions, normals, colors, uvs, tileIndexes). Two
// meshes with the same multiset render identically regardless of quad order.
const quadKey = (m: MeshedChunk, q: number): string => {
  const vBase = q * 4
  const pi = vBase * 3
  const ui = vBase * 2
  const parts: number[] = []
  for (let k = 0; k < 12; k++) {
    parts.push(Math.round(m.positions[pi + k]! * 1000) / 1000)
    parts.push(m.normals[pi + k]!)
    parts.push(m.colors[pi + k]!)
  }
  for (let k = 0; k < 8; k++) parts.push(Math.round(m.uvs[ui + k]! * 1000) / 1000)
  for (let k = 0; k < 4; k++) parts.push(m.tileIndexes[vBase + k]!)
  return parts.join(',')
}

const meshSignature = (m: MeshedChunk): Map<string, number> => {
  const sig = new Map<string, number>()
  const quadCount = m.indices.length / 6
  for (let q = 0; q < quadCount; q++) {
    const k = quadKey(m, q)
    sig.set(k, (sig.get(k) ?? 0) + 1)
  }
  return sig
}

const sigEquals = (a: Map<string, number>, b: Map<string, number>): boolean => {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false
  }
  return true
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('computeAffectedSlices', () => {
  it('expands AABB by 1 voxel on each side, clamped to chunk bounds', () => {
    const aabb: DirtyAABB = { minX: 5, maxX: 5, minY: 100, maxY: 100, minZ: 5, maxZ: 5 }
    const r = computeAffectedSlices(aabb)
    expect(r.xRange).toEqual({ start: 4, end: 6 })
    expect(r.yRange).toEqual({ start: 99, end: 101 })
    expect(r.zRange).toEqual({ start: 4, end: 6 })
  })

  it('clamps to lower chunk bound at 0', () => {
    const aabb: DirtyAABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
    const r = computeAffectedSlices(aabb)
    expect(r.xRange).toEqual({ start: 0, end: 1 })
    expect(r.yRange).toEqual({ start: 0, end: 1 })
    expect(r.zRange).toEqual({ start: 0, end: 1 })
  })

  it('clamps to upper chunk bound', () => {
    const aabb: DirtyAABB = {
      minX: CHUNK_SIZE - 1, maxX: CHUNK_SIZE - 1,
      minY: CHUNK_HEIGHT - 1, maxY: CHUNK_HEIGHT - 1,
      minZ: CHUNK_SIZE - 1, maxZ: CHUNK_SIZE - 1,
    }
    const r = computeAffectedSlices(aabb)
    expect(r.xRange).toEqual({ start: CHUNK_SIZE - 2, end: CHUNK_SIZE - 1 })
    expect(r.yRange).toEqual({ start: CHUNK_HEIGHT - 2, end: CHUNK_HEIGHT - 1 })
    expect(r.zRange).toEqual({ start: CHUNK_SIZE - 2, end: CHUNK_SIZE - 1 })
  })
})

describe('greedyMeshChunkSubregion — equivalence with full re-mesh', () => {
  it('produces an empty mesh when the chunk is empty before and after', () => {
    const prev = greedyMeshChunk(makeEmptyChunk(), ZERO_OFFSET)
    const result = greedyMeshChunkSubregion(
      makeEmptyChunk(),
      ZERO_OFFSET,
      { dirtyAABB: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }, prev },
    )
    expect(result.toMeshed().opaque.indices.length).toBe(0)
  })

  it('matches full re-mesh for single block placed in empty chunk', () => {
    const prev = greedyMeshChunk(makeEmptyChunk(), ZERO_OFFSET)
    const fresh = makeEmptyChunk()
    setBlock(fresh, 5, 10, 5, 'STONE')
    const aabb: DirtyAABB = { minX: 5, maxX: 5, minY: 10, maxY: 10, minZ: 5, maxZ: 5 }
    const sub = greedyMeshChunkSubregion(fresh, ZERO_OFFSET, { dirtyAABB: aabb, prev })
    const full = greedyMeshChunk(fresh, ZERO_OFFSET)
    expect(sigEquals(meshSignature(sub.toMeshed().opaque), meshSignature(full.toMeshed().opaque))).toBe(true)
  })

  it('matches full re-mesh when removing a block', () => {
    const before = makeEmptyChunk()
    setBlock(before, 5, 10, 5, 'STONE')
    setBlock(before, 5, 10, 6, 'STONE')
    const prev = greedyMeshChunk(before, ZERO_OFFSET)

    const after = makeEmptyChunk()
    setBlock(after, 5, 10, 6, 'STONE')
    const aabb: DirtyAABB = { minX: 5, maxX: 5, minY: 10, maxY: 10, minZ: 5, maxZ: 5 }
    const sub = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev })
    const full = greedyMeshChunk(after, ZERO_OFFSET)
    expect(sigEquals(meshSignature(sub.toMeshed().opaque), meshSignature(full.toMeshed().opaque))).toBe(true)
  })

  it('matches full re-mesh when changing a block type', () => {
    const before = makeEmptyChunk()
    setBlock(before, 8, 50, 8, 'DIRT')
    const prev = greedyMeshChunk(before, ZERO_OFFSET)

    const after = makeEmptyChunk()
    setBlock(after, 8, 50, 8, 'STONE')
    const aabb: DirtyAABB = { minX: 8, maxX: 8, minY: 50, maxY: 50, minZ: 8, maxZ: 8 }
    const sub = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev })
    const full = greedyMeshChunk(after, ZERO_OFFSET)
    expect(sigEquals(meshSignature(sub.toMeshed().opaque), meshSignature(full.toMeshed().opaque))).toBe(true)
  })

  it('matches full re-mesh for change at chunk-edge voxel (AABB clamp boundary)', () => {
    const before = makeEmptyChunk()
    const prev = greedyMeshChunk(before, ZERO_OFFSET)

    const after = makeEmptyChunk()
    setBlock(after, 0, 0, 0, 'STONE')
    const aabb: DirtyAABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
    const sub = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev })
    const full = greedyMeshChunk(after, ZERO_OFFSET)
    expect(sigEquals(meshSignature(sub.toMeshed().opaque), meshSignature(full.toMeshed().opaque))).toBe(true)
  })

  it('matches full re-mesh inside a flat plane (face merge across AABB boundary)', () => {
    // Build a 16×16 flat plane at y=10, then change one block in the middle.
    const before = makeEmptyChunk()
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), (lx) => {
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), (lz) => {
        setBlock(before, lx, 10, lz, 'STONE')
      })
    })
    const prev = greedyMeshChunk(before, ZERO_OFFSET)

    // Drill out the middle block.
    const after = makeEmptyChunk()
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), (lx) => {
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), (lz) => {
        if (!(lx === 8 && lz === 8)) setBlock(after, lx, 10, lz, 'STONE')
      })
    })
    const aabb: DirtyAABB = { minX: 8, maxX: 8, minY: 10, maxY: 10, minZ: 8, maxZ: 8 }
    const sub = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev })
    const full = greedyMeshChunk(after, ZERO_OFFSET)
    expect(sigEquals(meshSignature(sub.toMeshed().opaque), meshSignature(full.toMeshed().opaque))).toBe(true)
  })
})

// ─── Property test ──────────────────────────────────────────────────────────

describe('greedyMeshChunkSubregion — property equivalence', () => {
  // Pre-build the "before" chunk and its mesh once so each property iteration
  // only pays for the diff. Using a 1-block-thick floor keeps face merging
  // active while keeping per-iteration cost bounded.
  const sharedBefore = makeEmptyChunk()
  for (let plx = 0; plx < CHUNK_SIZE; plx++) {
    for (let plz = 0; plz < CHUNK_SIZE; plz++) {
      setBlock(sharedBefore, plx, 0, plz, 'STONE')
    }
  }

const WATER_ID_SET = new Set([blockTypeToIndex('WATER')])
const GLASS_ID_SET = new Set([blockTypeToIndex('GLASS')])

describe('greedyMeshChunkSubregion — water and transparent mesh paths', () => {
  it('produces a water mesh when freshWater is present and prevWater was null (new water path)', () => {
    // prev has no water → prevWater = null; fresh has water → freshWater != null
    const emptyPrev = greedyMeshChunk(makeEmptyChunk(), ZERO_OFFSET, WATER_ID_SET)
    const withWater = makeEmptyChunk()
    setBlock(withWater, 5, 10, 5, 'WATER')
    const aabb: DirtyAABB = { minX: 5, maxX: 5, minY: 10, maxY: 10, minZ: 5, maxZ: 5 }
    const result = greedyMeshChunkSubregion(withWater, ZERO_OFFSET, { dirtyAABB: aabb, prev: emptyPrev }, WATER_ID_SET)
    const meshed = result.toMeshed()
    expect(meshed.water).not.toBeNull()
    expect(meshed.water!.indices.length).toBeGreaterThan(0)
  })

  it('splices the water mesh when both fresh and prev have water (spliceMesh water path)', () => {
    const before = makeEmptyChunk()
    setBlock(before, 5, 10, 5, 'WATER')
    setBlock(before, 5, 10, 6, 'WATER')
    const prevMesh = greedyMeshChunk(before, ZERO_OFFSET, WATER_ID_SET)

    const after = makeEmptyChunk()
    setBlock(after, 5, 10, 6, 'WATER')
    const aabb: DirtyAABB = { minX: 5, maxX: 5, minY: 10, maxY: 10, minZ: 5, maxZ: 5 }
    const result = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev: prevMesh }, WATER_ID_SET)
    const meshed = result.toMeshed()
    expect(meshed.water).not.toBeNull()
  })

  it('produces a transparent solid mesh when freshTransparentSolid is present and prev had none (GLASS path)', () => {
    const emptyPrev = greedyMeshChunk(makeEmptyChunk(), ZERO_OFFSET, new Set(), undefined, undefined, GLASS_ID_SET)
    const withGlass = makeEmptyChunk()
    setBlock(withGlass, 3, 5, 3, 'GLASS')
    const aabb: DirtyAABB = { minX: 3, maxX: 3, minY: 5, maxY: 5, minZ: 3, maxZ: 3 }
    const result = greedyMeshChunkSubregion(withGlass, ZERO_OFFSET, { dirtyAABB: aabb, prev: emptyPrev }, new Set(), undefined, undefined, GLASS_ID_SET)
    const meshed = result.toMeshed()
    expect(meshed.transparentSolid).not.toBeNull()
    expect(meshed.transparentSolid!.indices.length).toBeGreaterThan(0)
  })

  it('splices transparent solid mesh when both prev and fresh have GLASS (spliceMesh transparentSolid path)', () => {
    const before = makeEmptyChunk()
    setBlock(before, 3, 5, 3, 'GLASS')
    setBlock(before, 3, 5, 4, 'GLASS')
    const prevMesh = greedyMeshChunk(before, ZERO_OFFSET, new Set(), undefined, undefined, GLASS_ID_SET)

    const after = makeEmptyChunk()
    setBlock(after, 3, 5, 4, 'GLASS')
    const aabb: DirtyAABB = { minX: 3, maxX: 3, minY: 5, maxY: 5, minZ: 3, maxZ: 3 }
    const result = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev: prevMesh }, new Set(), undefined, undefined, GLASS_ID_SET)
    const meshed = result.toMeshed()
    expect(meshed.transparentSolid).not.toBeNull()
  })
})

const sharedPrev = greedyMeshChunk(sharedBefore, ZERO_OFFSET)

  it('is multiset-equivalent to greedyMeshChunk for any single-block edit', () => {
    fc.assert(
      fc.property(
        fc.record({
          lx: fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
          y: fc.integer({ min: 1, max: 20 }),
          lz: fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
          type: fc.constantFrom<BlockType>('STONE', 'DIRT', 'GRASS', 'COBBLESTONE'),
        }),
        ({ lx, y, lz, type }) => {
          const after = makeEmptyChunk()
          for (let plx = 0; plx < CHUNK_SIZE; plx++) {
            for (let plz = 0; plz < CHUNK_SIZE; plz++) {
              setBlock(after, plx, 0, plz, 'STONE')
            }
          }
          setBlock(after, lx, y, lz, type)

          const aabb: DirtyAABB = { minX: lx, maxX: lx, minY: y, maxY: y, minZ: lz, maxZ: lz }
          const sub = greedyMeshChunkSubregion(after, ZERO_OFFSET, { dirtyAABB: aabb, prev: sharedPrev })
          const full = greedyMeshChunk(after, ZERO_OFFSET)

          return sigEquals(
            meshSignature(sub.toMeshed().opaque),
            meshSignature(full.toMeshed().opaque),
          )
        },
      ),
      { numRuns: 15 },
    )
  }, 30000)
})
