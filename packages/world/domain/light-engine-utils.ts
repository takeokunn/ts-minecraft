import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { createLightBuffer, LIGHT_BYTE_LENGTH } from '@ts-minecraft/block/domain/light'
import { growAABBToVoxel } from './chunk-aabb'
import type { AABBAccumulator } from './light-engine-model'

export const FULL_RECOMPUTE_THRESHOLD = 256

export const inLightBounds = (lx: number, y: number, lz: number): boolean =>
  lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE

export const lightBufferOrFresh = (buf: Uint8Array<ArrayBufferLike> | undefined): Uint8Array => {
  return buf !== undefined && buf.byteLength === LIGHT_BYTE_LENGTH ? buf : createLightBuffer()
}

export const trackTouched = (acc: AABBAccumulator, x: number, y: number, z: number): void => {
  // Grow the accumulator box in place — allocation-free after the first node. The BFS
  // calls this once per touched voxel (thousands per light edit).
  acc.aabb = growAABBToVoxel(acc.aabb, x, y, z)
}

export const packPosLevel = (x: number, y: number, z: number, lvl: number): number =>
  (x << 13) | (z << 9) | y | (lvl << 17)
export const unpackX = (p: number): number => (p >> 13) & 0x0f
export const unpackZ = (p: number): number => (p >> 9) & 0x0f
export const unpackY = (p: number): number => p & 0x1ff
export const unpackLevel = (p: number): number => (p >> 17) & 0x1f

export const NEIGHBOR_DX = [1, -1, 0, 0, 0, 0] as const
export const NEIGHBOR_DY = [0, 0, 1, -1, 0, 0] as const
export const NEIGHBOR_DZ = [0, 0, 0, 0, 1, -1] as const
