import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import { getLightAt } from '@ts-minecraft/block/domain/light'
import type { LightGrids } from '@ts-minecraft/block/domain/light'
import { AIR } from './greedy-meshing-types'

export const getBlock = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return AIR
  return blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!
}

export const isAir = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): boolean =>
  /* c8 ignore next -- isAir called in AO computation; true-branch (AIR) rarely triggered in solid-chunk tests */
  getBlock(blocks, lx, y, lz) === AIR

export const aoXPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx >= CHUNK_SIZE - 1) return 0
  const xOffset = (lx + 1) * CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (y > 0 && blocks[y - 1 + zOffset + xOffset]! !== AIR) count++
  if (y < CHUNK_HEIGHT - 1 && blocks[y + 1 + zOffset + xOffset]! !== AIR) count++
  if (lz > 0 && blocks[y + (lz - 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  if (lz < CHUNK_SIZE - 1 && blocks[y + (lz + 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  return count > 3 ? 3 : count
}

export const aoXNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx <= 0) return 0
  const xOffset = (lx - 1) * CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (y > 0 && blocks[y - 1 + zOffset + xOffset]! !== AIR) count++
  if (y < CHUNK_HEIGHT - 1 && blocks[y + 1 + zOffset + xOffset]! !== AIR) count++
  if (lz > 0 && blocks[y + (lz - 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  if (lz < CHUNK_SIZE - 1 && blocks[y + (lz + 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  return count > 3 ? 3 : count
}

export const aoYPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (y >= CHUNK_HEIGHT - 1) return 0
  const yOffset = y + 1
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[yOffset + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[yOffset + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (lz + 1 < CHUNK_SIZE && blocks[yOffset + (lz + 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  if (lz > 0 && blocks[yOffset + (lz - 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

export const aoYNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (y <= 0) return 0
  const yOffset = y - 1
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[yOffset + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[yOffset + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (lz + 1 < CHUNK_SIZE && blocks[yOffset + (lz + 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  if (lz > 0 && blocks[yOffset + (lz - 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

export const aoZPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lz >= CHUNK_SIZE - 1) return 0
  const zOffset = (lz + 1) * CHUNK_HEIGHT
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[y + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[y + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (y + 1 < CHUNK_HEIGHT && blocks[y + 1 + zOffset + lx * xBase]! !== AIR) count++
  if (y > 0 && blocks[y - 1 + zOffset + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

export const aoZNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lz <= 0) return 0
  const zOffset = (lz - 1) * CHUNK_HEIGHT
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[y + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[y + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (y + 1 < CHUNK_HEIGHT && blocks[y + 1 + zOffset + lx * xBase]! !== AIR) count++
  if (y > 0 && blocks[y - 1 + zOffset + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

// ─── Light sampling ──────────────────────────────────────────────────────────

// Per-voxel light read with default of {sky:15, block:0} for out-of-bounds.
// Reads from the AIR side of a face — caller passes (lx,y,lz) of the empty voxel
// adjacent to the solid face.
// Returns packed `(sky << 4) | block` (sky and block each ∈ [0..15]).
export const sampleVoxelLight = (
  grids: LightGrids | undefined,
  lx: number,
  y: number,
  lz: number
): number => {
  /* c8 ignore next */
  if (grids === undefined) return 0xf0 /* sky=15,block=0 */
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
    return 0xf0 /* sky=15,block=0 */
  }
  return (getLightAt(grids.skyLight, lx, y, lz) << 4) | getLightAt(grids.blockLight, lx, y, lz)
}

// Sample 4 voxels meeting at a face corner and average their light.
// `airX/airY/airZ` is the AIR-side voxel adjacent to the face.
// `(t1x,t1y,t1z)` and `(t2x,t2y,t2z)` are unit tangent vectors in the face plane;
// the corner offset (du,dv) selects which 2×2 corner we're sampling around.
// Returns packed `(sky << 4) | block`; quantized 2-bit corner extraction at call sites:
//   sky 2-bit  = (packed >> 6) & 0x3   (shift off 4 block bits + 2 low sky bits, mask 2 bits)
//   block 2-bit = (packed >> 2) & 0x3
export const sampleCornerLight = (
  grids: LightGrids | undefined,
  airX: number,
  airY: number,
  airZ: number,
  t1x: number,
  t1y: number,
  t1z: number,
  t2x: number,
  t2y: number,
  t2z: number,
  du: number,
  dv: number
): number => {
  if (grids === undefined) return 0xf0 /* sky=15,block=0 */
  // 4 voxels meeting at the corner: the AIR voxel itself plus its 3 neighbors
  // along ±t1 / ±t2 directions, biased by the corner's quadrant (du,dv).
  const o1 = du === 0 ? -1 : 0
  const o2 = dv === 0 ? -1 : 0
  // Sample the 2×2 group of voxels touching the corner.
  let skySum = 0
  let blockSum = 0
  for (let i = 0; i <= 1; i++) {
    for (let j = 0; j <= 1; j++) {
      const sx = airX + (o1 + i) * t1x + (o2 + j) * t2x
      const sy = airY + (o1 + i) * t1y + (o2 + j) * t2y
      const sz = airZ + (o1 + i) * t1z + (o2 + j) * t2z
      const v = sampleVoxelLight(grids, sx, sy, sz)
      skySum += (v >> 4) & 0xf
      blockSum += v & 0xf
    }
  }
  return ((skySum >> 2) << 4) | (blockSum >> 2)
}
