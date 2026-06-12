import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing'
import { createAccumulatorPool } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-quads'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import type { MeshedChunk } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-types'

// R128 regression: the meshing worker reuses one accumulator pool across requests. This
// is only safe because the worker fully copies the mesh out via toMeshed() (.slice())
// before the next call. These tests prove that two back-to-back pooled calls on different
// chunks produce outputs identical to the non-pooled path, and that an earlier pooled
// result is not mutated when a later pooled call reuses (and resets) the buffers.

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const ZERO_OFFSET = { wx: 0, wz: 0 }

const makeSolidChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  blocks.fill(2) // STONE
  return { coord, blocks, fluid: Option.none() }
}

// A sparse, asymmetric chunk: a few different block types at y=0 so its mesh differs
// from the solid chunk in both size and content.
const makeSparseChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      if ((lx + lz) % 3 === 0) {
        const idx = 0 + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        blocks[idx] = ((lx + lz) % 5) + 1
      }
    }
  }
  return { coord, blocks, fluid: Option.none() }
}

const snapshot = (m: MeshedChunk) => ({
  positions: Array.from(m.positions),
  normals: Array.from(m.normals),
  colors: Array.from(m.colors),
  uvs: Array.from(m.uvs),
  tileIndexes: Array.from(m.tileIndexes),
  indices: Array.from(m.indices),
})

describe('greedyMeshChunk — accumulator pool (R128)', () => {
  it('pooled output equals non-pooled output for back-to-back different chunks', () => {
    const a = makeSolidChunk()
    const b = makeSparseChunk()

    // Non-pooled references.
    const refA = snapshot(greedyMeshChunk(a, ZERO_OFFSET).toMeshed().opaque)
    const refB = snapshot(greedyMeshChunk(b, ZERO_OFFSET).toMeshed().opaque)

    // Pooled: reuse one pool across both calls.
    const pool = createAccumulatorPool()
    const pooledA = snapshot(
      greedyMeshChunk(a, ZERO_OFFSET, undefined, undefined, undefined, undefined, pool).toMeshed().opaque,
    )
    const pooledB = snapshot(
      greedyMeshChunk(b, ZERO_OFFSET, undefined, undefined, undefined, undefined, pool).toMeshed().opaque,
    )

    // Each pooled result matches its independent non-pooled reference — the reset between
    // calls fully clears the previous chunk's geometry (no carry-over from A into B).
    expect(pooledA).toEqual(refA)
    expect(pooledB).toEqual(refB)
  })

  it('an earlier pooled mesh is not mutated when a later pooled call reuses the buffers', () => {
    const a = makeSolidChunk()
    const b = makeSparseChunk()
    const pool = createAccumulatorPool()

    // Capture A's mesh (owned copies from toMeshed()).
    const meshA = greedyMeshChunk(a, ZERO_OFFSET, undefined, undefined, undefined, undefined, pool).toMeshed().opaque
    const aBefore = snapshot(meshA)

    // Reuse the pool for a different chunk B — this resets+overwrites the pool buffers.
    greedyMeshChunk(b, ZERO_OFFSET, undefined, undefined, undefined, undefined, pool).toMeshed()

    // A's copies are independent of the pool buffers, so they must be unchanged.
    expect(snapshot(meshA)).toEqual(aBefore)
  })
})
