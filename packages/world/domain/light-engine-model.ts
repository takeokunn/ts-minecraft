import type { Option } from 'effect'
import type { ChunkAABB, MutableChunkAABB } from './chunk-aabb'

export type BoundaryDirty = Readonly<{
  readonly nx: boolean
  readonly px: boolean
  readonly nz: boolean
  readonly pz: boolean
}>

export type IncrementalLightResult = Readonly<{
  readonly skyLight: Uint8Array
  readonly blockLight: Uint8Array
  readonly boundary: BoundaryDirty
  readonly affectedAABB: Option.Option<ChunkAABB>
}>

export type DirtyVoxel = Readonly<{
  readonly lx: number
  readonly y: number
  readonly lz: number
}>

export type MutableBoundaryDirty = {
  nx: boolean
  px: boolean
  nz: boolean
  pz: boolean
}

// aabb is a MutableChunkAABB so trackTouched can grow it in place (allocation-free
// per BFS node). MutableChunkAABB is structurally assignable to ChunkAABB for consumers.
export type AABBAccumulator = { aabb: MutableChunkAABB | null }
