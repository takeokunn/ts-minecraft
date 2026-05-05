import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'
import type { BlockType } from '@ts-minecraft/kernel'
import type { MeshedChunk } from '@ts-minecraft/rendering'

// ─── Helpers ───────────────────────────────────────────────────────────────

export const makeEmptyChunk = (coord: ChunkCoord): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  return { coord, blocks, fluid: Option.none() }
}

export const makeChunkWithBlock = (
  coord: ChunkCoord,
  lx: number,
  y: number,
  lz: number,
  blockType: BlockType
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
  blocks[idx] = blockTypeToIndex(blockType)
  return { coord, blocks, fluid: Option.none() }
}

export const makeChunkWithBlocks = (
  coord: ChunkCoord,
  entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }>
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(entries, ({ lx, y, lz, blockType }) => {
    const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    blocks[idx] = blockTypeToIndex(blockType)
  })
  return { coord, blocks, fluid: Option.none() }
}

export const ZERO_COORD: ChunkCoord = { x: 0, z: 0 }
export const ZERO_OFFSET = { wx: 0, wz: 0 }

// ─── Face-normal helpers ────────────────────────────────────────────────────

// Stride loops below (v += 4, i += 3) are intentional exceptions to the project's
// Arr.forEach convention — they operate on typed arrays at a fixed stride and the
// loop state threads directly through the index arithmetic.
// Normals are stored 4-per-quad (one per vertex); sample at stride 4.
export const countFacesByNormal = (
  normals: Int8Array,
  nx: number,
  ny: number,
  nz: number,
): number => {
  let count = 0
  const vertCount = normals.length / 3
  for (let v = 0; v < vertCount; v += 4) {
    if (normals[v * 3] === nx && normals[v * 3 + 1] === ny && normals[v * 3 + 2] === nz) count++
  }
  return count
}

export const hasFaceWithNormal = (
  normals: Int8Array,
  nx: number,
  ny: number,
  nz: number,
): boolean => countFacesByNormal(normals, nx, ny, nz) > 0

// Returns the vertex index (stride-4 units) of the first quad matching the normal, or -1.
export const findFirstFaceVertexWithNormal = (
  normals: Int8Array,
  nx: number,
  ny: number,
  nz: number,
): number => {
  const vertCount = normals.length / 3
  for (let v = 0; v < vertCount; v += 4) {
    if (normals[v * 3] === nx && normals[v * 3 + 1] === ny && normals[v * 3 + 2] === nz) return v
  }
  return -1
}

// ─── Geometry count helpers ─────────────────────────────────────────────────

// 6 indices per quad (2 triangles × 3 vertices).
export const getQuadCount = (meshed: MeshedChunk): number => meshed.indices.length / 6

// ─── Position assertion helpers ─────────────────────────────────────────────

export const assertAllXPositionsGte = (positions: Float32Array, minX: number): void => {
  for (let i = 0; i < positions.length; i += 3) {
    expect(positions[i]).toBeGreaterThanOrEqual(minX)
  }
}

export const assertAllZPositionsGte = (positions: Float32Array, minZ: number): void => {
  for (let i = 0; i < positions.length; i += 3) {
    expect(positions[i + 2]).toBeGreaterThanOrEqual(minZ)
  }
}
