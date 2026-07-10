import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  CAVE_SAMPLE_STRIDE,
  CAVE_FLOOR,
  CAVE_CEILING,
  CAVE_BASE_THRESHOLD,
  CAVE_DEPTH_BIAS,
  CAVE_DEPTH_MIN,
  CAVE_DEPTH_MAX,
  CAVE_LAVA_MAX_Y,
  CAVE_WATER_FLOOR_MARGIN,
} from './constants'
import { smoothstep, chunkBlockIndexUnchecked } from './math'

// Lowest water Y per column within carving reach (-1 = no water). Scans a few
// blocks past CAVE_CEILING so a bed sitting just above the ceiling still gets
// its floor margin protected.
const computeWaterFloorYs = (blocks: Readonly<Uint8Array>, waterBlockIndex: number): Int16Array => {
  const floors = new Int16Array(CHUNK_SIZE * CHUNK_SIZE).fill(-1)
  const scanTop = CAVE_CEILING + CAVE_WATER_FLOOR_MARGIN
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = CAVE_FLOOR; y <= scanTop; y++) {
        if (blocks[chunkBlockIndexUnchecked(lx, y, lz)] === waterBlockIndex) {
          floors[lx * CHUNK_SIZE + lz] = y
          break
        }
      }
    }
  }
  return floors
}

// Trilinearly interpolates coarse 3D noise samples; voxels where |noise| < threshold(y) become AIR.
// Sample grid index: sx + sz*SX + sy*SX*SZ, SX=SZ=floor(CHUNK_SIZE/STRIDE)+1.
export const carveCaves = (
  blocks: Uint8Array,
  caveSamples: ReadonlyArray<number>,
  airBlockIndex: number,
  waterBlockIndex: number,
  bedrockBlockIndex: number,
  lavaBlockIndex: number,
): void => {
  const stride = CAVE_SAMPLE_STRIDE
  const sxCount = Math.floor(CHUNK_SIZE / stride) + 1
  const szCount = Math.floor(CHUNK_SIZE / stride) + 1
  const sample = (sx: number, sy: number, sz: number): number =>
    caveSamples[sx + sz * sxCount + sy * sxCount * szCount]!

  const waterFloorYs = computeWaterFloorYs(blocks, waterBlockIndex)

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const sx0 = Math.floor(lx / stride)
    const sx1 = sx0 + 1
    const fx = (lx - sx0 * stride) / stride
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const sz0 = Math.floor(lz / stride)
      const sz1 = sz0 + 1
      const fz = (lz - sz0 * stride) / stride
      const waterFloorY = waterFloorYs[lx * CHUNK_SIZE + lz]!

      // Traverse the vertical cave region only — saves work outside [FLOOR, CEILING]
      for (let y = CAVE_FLOOR; y <= CAVE_CEILING; y++) {
        const idx = chunkBlockIndexUnchecked(lx, y, lz)
        const current = blocks[idx]!
        // Protect bedrock, AIR (already), and WATER (fluid bodies)
        if (current === bedrockBlockIndex || current === airBlockIndex || current === waterBlockIndex) {
          continue
        }
        // Keep a solid shell under water bodies: carving the bed away leaves a
        // floating water sheet over an unlit cavity (the black-void bug).
        if (waterFloorY >= 0 && y >= waterFloorY - CAVE_WATER_FLOOR_MARGIN && y < waterFloorY) {
          continue
        }

        const sy0 = Math.floor(y / stride)
        const sy1 = sy0 + 1
        const fy = (y - sy0 * stride) / stride

        // Trilinear interpolation of 8 corner samples
        const c000 = sample(sx0, sy0, sz0)
        const c100 = sample(sx1, sy0, sz0)
        const c010 = sample(sx0, sy0, sz1)
        const c110 = sample(sx1, sy0, sz1)
        const c001 = sample(sx0, sy1, sz0)
        const c101 = sample(sx1, sy1, sz0)
        const c011 = sample(sx0, sy1, sz1)
        const c111 = sample(sx1, sy1, sz1)
        const c00 = c000 * (1 - fx) + c100 * fx
        const c10 = c010 * (1 - fx) + c110 * fx
        const c01 = c001 * (1 - fx) + c101 * fx
        const c11 = c011 * (1 - fx) + c111 * fx
        const c0 = c00 * (1 - fz) + c10 * fz
        const c1 = c01 * (1 - fz) + c11 * fz
        const interpolated = c0 * (1 - fy) + c1 * fy

        // Threshold: higher in the mid-depth sweet spot → more carving there.
        // smoothstep rises from 0 at y=10 to 1 at y=40, then stays at 1 above;
        // we want the bias near its peak in [10,40], which this produces.
        const depth = smoothstep(CAVE_DEPTH_MIN, CAVE_DEPTH_MAX, y)
        const threshold = CAVE_BASE_THRESHOLD + CAVE_DEPTH_BIAS * depth

        if (Math.abs(interpolated) < threshold) {
          blocks[idx] = y <= CAVE_LAVA_MAX_Y ? lavaBlockIndex : airBlockIndex
        }
      }
    }
  }
}
