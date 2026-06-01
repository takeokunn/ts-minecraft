import { Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'

// Zero-copy view into accumulator buffers — subarrays (NOT sliced copies).
// Used by the update path (tryReuseGeometry) to avoid an intermediate ~200-400KB allocation
// per chunk that would immediately become garbage after being copied into GPU buffers.
//
// ⚠ These subarrays alias the accumulator's backing store. They are only valid
// until the next call to greedyMeshChunk (which resets the accumulators).
// The update path consumes them synchronously within the same frame-handler tick,
// so this is safe under the current single-fiber meshing model.
export const RawMeshDataSchema = Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Int8Array),
  colors: Schema.instanceOf(Uint8Array),
  uvs: Schema.instanceOf(Float32Array),
  tileIndexes: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  indexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type RawMeshData = Schema.Schema.Type<typeof RawMeshDataSchema>

export const MeshedChunkSchema = Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Int8Array),
  colors: Schema.instanceOf(Uint8Array),
  uvs: Schema.instanceOf(Float32Array),
  tileIndexes: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
})
export type MeshedChunk = Schema.Schema.Type<typeof MeshedChunkSchema>

export const ChunkWorldOffsetSchema = Schema.Struct({
  wx: Schema.Number.pipe(Schema.int()),
  wz: Schema.Number.pipe(Schema.int()),
})
export type ChunkWorldOffset = Schema.Schema.Type<typeof ChunkWorldOffsetSchema>

export const AIR = 0

// Greedy meshing scratch buffers.
// Reusing these per worker/service instance avoids reallocating the two mask buffers
// on every chunk rebuild.
export const EMPTY_MESHED_CHUNK: MeshedChunk = {
  positions: new Float32Array(0),
  normals: new Int8Array(0),
  colors: new Uint8Array(0),
  uvs: new Float32Array(0),
  tileIndexes: new Float32Array(0),
  indices: new Uint32Array(0),
}

// Mask cells now pack 26 bits:
//   blockId      bits 0-7   (8 bits)
//   ao           bits 8-9   (2 bits)
//   sky0..sky3   bits 10-17 (2 bits each, 4 corners)
//   block0..3    bits 18-25 (2 bits each, 4 corners)
// Uint32Array is required to fit all 26 bits.
export type GreedyMeshScratch = {
  readonly maskCH: Uint32Array
  readonly maskSS: Uint32Array
}

export const createGreedyMeshScratch = (): GreedyMeshScratch => ({
  maskCH: new Uint32Array(CHUNK_SIZE * CHUNK_HEIGHT),
  maskSS: new Uint32Array(CHUNK_SIZE * CHUNK_SIZE),
})

export type GreedyMeshToMeshed = () => { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk }

export type GreedyMeshResult = {
  // Zero-copy subarray views — valid until next greedyMeshChunk call (aliases accumulator backing store).
  readonly opaqueRaw: RawMeshData
  readonly waterRaw: RawMeshData | null
  // Transparent-solid (GLASS, LEAVES) faces — rendered with atlas material + transparency, not water shader.
  readonly transparentSolidRaw: RawMeshData | null
  // Lazily produces sliced (owned) copies — call only when you need independent arrays.
  readonly toMeshed: GreedyMeshToMeshed
}

export const GreedyMeshResultSchema = Schema.Struct({
  opaqueRaw: RawMeshDataSchema,
  waterRaw: Schema.NullOr(RawMeshDataSchema),
  transparentSolidRaw: Schema.NullOr(RawMeshDataSchema),
  toMeshed: Schema.declare((u): u is GreedyMeshToMeshed => typeof u === 'function'),
})
