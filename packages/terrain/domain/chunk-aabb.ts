import { Array as Arr, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'

// FR-4.2 — Per-chunk dirty AABB for sub-region re-meshing. Coordinates are
// chunk-LOCAL and INCLUSIVE on every face: 0..CHUNK_SIZE-1 for x/z, 0..CHUNK_HEIGHT-1
// for y. An AABB that covers [0..CHUNK_SIZE-1, 0..CHUNK_HEIGHT-1, 0..CHUNK_SIZE-1]
// is structurally indistinguishable from "full chunk" — callers can fall back to
// a full re-mesh in that case (FR-4.1 sub-region greedy treats it the same way).
export type ChunkAABB = Readonly<{
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
  readonly minZ: number
  readonly maxZ: number
}>

export type DirtyVoxelLike = Readonly<{
  readonly lx: number
  readonly y: number
  readonly lz: number
}>

const clampX = (n: number): number => Math.max(0, Math.min(CHUNK_SIZE - 1, n | 0))
const clampY = (n: number): number => Math.max(0, Math.min(CHUNK_HEIGHT - 1, n | 0))

export const aabbFromVoxel = (v: DirtyVoxelLike): ChunkAABB => ({
  minX: clampX(v.lx), maxX: clampX(v.lx),
  minY: clampY(v.y), maxY: clampY(v.y),
  minZ: clampX(v.lz), maxZ: clampX(v.lz),
})

// Bounding box of a non-empty voxel array. Returns Option.none() for [].
export const aabbFromVoxels = (voxels: ReadonlyArray<DirtyVoxelLike>): Option.Option<ChunkAABB> =>
  Arr.match(voxels, {
    onEmpty: () => Option.none(),
    onNonEmpty: (vs) => {
      const head = aabbFromVoxel(vs[0])
      return Option.some(
        Arr.reduce(Arr.drop(vs, 1), head, (acc, v) => unionAABB(acc, aabbFromVoxel(v))),
      )
    },
  })

export const unionAABB = (a: ChunkAABB, b: ChunkAABB): ChunkAABB => ({
  minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
  minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY),
  minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ),
})

// Grow by `pad` voxels on each axis, clamped to chunk bounds. Light propagation
// reaches up to LIGHT_LEVEL_MAX (=15) voxels; passing pad=15 yields the safe
// re-mesh halo in case lighting changes affect nearby surface visibility.
export const expandAABB = (aabb: ChunkAABB, pad: number): ChunkAABB => ({
  minX: clampX(aabb.minX - pad), maxX: clampX(aabb.maxX + pad),
  minY: clampY(aabb.minY - pad), maxY: clampY(aabb.maxY + pad),
  minZ: clampX(aabb.minZ - pad), maxZ: clampX(aabb.maxZ + pad),
})

export const aabbCoversChunk = (aabb: ChunkAABB): boolean =>
  aabb.minX === 0 && aabb.maxX === CHUNK_SIZE - 1 &&
  aabb.minY === 0 && aabb.maxY === CHUNK_HEIGHT - 1 &&
  aabb.minZ === 0 && aabb.maxZ === CHUNK_SIZE - 1

export const aabbContainsVoxel = (aabb: ChunkAABB, lx: number, y: number, lz: number): boolean =>
  lx >= aabb.minX && lx <= aabb.maxX &&
  y  >= aabb.minY && y  <= aabb.maxY &&
  lz >= aabb.minZ && lz <= aabb.maxZ

export const fullChunkAABB: ChunkAABB = {
  minX: 0, maxX: CHUNK_SIZE - 1,
  minY: 0, maxY: CHUNK_HEIGHT - 1,
  minZ: 0, maxZ: CHUNK_SIZE - 1,
}
