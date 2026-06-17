import { Option } from 'effect'
import { aabbFromVoxels, fullChunkAABB, type ChunkAABB } from '../domain/chunk-aabb'
import type { DirtyVoxel } from '../domain/light-engine-model'

export type DirtyBoundary = { readonly nx: boolean; readonly px: boolean; readonly nz: boolean; readonly pz: boolean }

export type DirtyBfsResult = Option.Option<{
  readonly boundary: DirtyBoundary
  readonly affectedAABB: Option.Option<ChunkAABB>
}>

type BfsBoundaryResult = Option.Option<{ readonly boundary: DirtyBoundary }>

const allOffsets: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

export const dirtyOffsets = (bfsResult: BfsBoundaryResult): ReadonlyArray<readonly [number, number]> => {
  const bfsResultVal = Option.getOrNull(bfsResult)
  if (bfsResultVal === null) return allOffsets
  const b = bfsResultVal.boundary
  const result: Array<readonly [number, number]> = []
  for (const [dx, dz] of allOffsets) {
    if (dx === 0 && dz === 0) {
      result.push([dx, dz])
      continue
    }
    if (dx === -1 && dz === -1) {
      if (b.nx && b.nz) result.push([dx, dz])
      continue
    }
    if (dx === -1 && dz === 1) {
      if (b.nx && b.pz) result.push([dx, dz])
      continue
    }
    if (dx === 1 && dz === -1) {
      if (b.px && b.nz) result.push([dx, dz])
      continue
    }
    if (dx === 1 && dz === 1) {
      if (b.px && b.pz) result.push([dx, dz])
      continue
    }
    if (dx === -1) {
      if (b.nx) result.push([dx, dz])
      continue
    }
    if (dx === 1) {
      if (b.px) result.push([dx, dz])
      continue
    }
    if (dz === -1) {
      if (b.nz) result.push([dx, dz])
      continue
    }
    if (dz === 1) {
      if (b.pz) result.push([dx, dz])
    }
  }
  return result
}

export const dirtyAABBFromVoxels = (dirtyVoxels?: ReadonlyArray<DirtyVoxel>): Option.Option<ChunkAABB> =>
  dirtyVoxels === undefined ? Option.none() : aabbFromVoxels(dirtyVoxels)

export const editedChunkAABBFromDirty = (
  dirtyVoxels: ReadonlyArray<DirtyVoxel> | undefined,
  bfsResult: DirtyBfsResult,
): ChunkAABB => {
  const seedAABB = dirtyAABBFromVoxels(dirtyVoxels)
  const bfsAABB = Option.flatMap(bfsResult, (r) => r.affectedAABB)
  return Option.getOrElse(Option.orElse(seedAABB, () => bfsAABB), () => fullChunkAABB)
}
