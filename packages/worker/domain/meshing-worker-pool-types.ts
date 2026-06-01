import type { ChunkAABB } from '@ts-minecraft/world'

// Structural payload type for chunk meshing results — opaque typed-array buffers
// that flow through the port / worker boundary unchanged.
export type MeshedChunk = {
  readonly positions: Float32Array
  readonly normals: Int8Array
  readonly colors: Uint8Array
  readonly uvs: Float32Array
  readonly tileIndexes: Float32Array
  readonly indices: Uint32Array
}

export type WorkerMeshResult = {
  readonly opaque: MeshedChunk
  readonly water: MeshedChunk | null
  readonly transparentSolid: MeshedChunk | null
}

// Mirrors LodLevel from rendering infrastructure — 0 = full detail, 1 = simplified, 2 = ultra-simplified.
export type LodLevel = 0 | 1 | 2

export type MeshChunkOptions = {
  readonly lod?: LodLevel
  readonly dirtyAABB?: ChunkAABB
}
