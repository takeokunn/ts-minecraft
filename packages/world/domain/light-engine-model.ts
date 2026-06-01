import { Option } from 'effect'
import type { ChunkAABB } from './chunk-aabb'

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

export type AABBAccumulator = { aabb: ChunkAABB | null }
