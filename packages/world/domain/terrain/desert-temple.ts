import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BiomeColumn } from './generator-pipeline-model'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Desert temples: sandstone pyramids on DESERT biome surfaces, using the
// single-chunk structure pattern established by jungle-temple.ts (anchor
// local coord forced into [6..9] so the footprint never crosses a border).
export const DESERT_TEMPLE_REGION_SIZE = 320
export const DESERT_TEMPLE_SPAWN_PERMILLE = 300
const HALF_LOW = 5
const HALF_HIGH = 6
const ANCHOR_LOCAL_MIN = 6
const ANCHOR_LOCAL_SPAN = 4

export type DesertTempleSite = {
  readonly x: number
  readonly z: number
}

export const desertTempleSiteForRegion = (regionX: number, regionZ: number): DesertTempleSite | null => {
  const roll = hash3(regionX, 2991, regionZ)
  if (roll >= DESERT_TEMPLE_SPAWN_PERMILLE / 1000) return null
  const chunkSpan = Math.floor(DESERT_TEMPLE_REGION_SIZE / CHUNK_SIZE)
  const chunkX = Math.floor(hash3(regionX, 2992, regionZ) * chunkSpan)
  const chunkZ = Math.floor(hash3(regionX, 2993, regionZ) * chunkSpan)
  const lx = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 2994, regionZ) * ANCHOR_LOCAL_SPAN)
  const lz = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 2995, regionZ) * ANCHOR_LOCAL_SPAN)
  return {
    x: (Math.floor((regionX * DESERT_TEMPLE_REGION_SIZE) / CHUNK_SIZE) + chunkX) * CHUNK_SIZE + lx,
    z: (Math.floor((regionZ * DESERT_TEMPLE_REGION_SIZE) / CHUNK_SIZE) + chunkZ) * CHUNK_SIZE + lz,
  }
}

export const writeDesertTempleForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
  surfaceYs: Int32Array,
  biomeColumns: ReadonlyArray<BiomeColumn>,
): boolean => {
  const regionX = Math.floor((chunkX * CHUNK_SIZE) / DESERT_TEMPLE_REGION_SIZE)
  const regionZ = Math.floor((chunkZ * CHUNK_SIZE) / DESERT_TEMPLE_REGION_SIZE)
  const site = desertTempleSiteForRegion(regionX, regionZ)
  if (site === null) return false
  if (Math.floor(site.x / CHUNK_SIZE) !== chunkX || Math.floor(site.z / CHUNK_SIZE) !== chunkZ) return false

  const anchorLx = site.x - chunkX * CHUNK_SIZE
  const anchorLz = site.z - chunkZ * CHUNK_SIZE
  const anchorColumn = biomeColumns[anchorLx * CHUNK_SIZE + anchorLz]
  if (anchorColumn === undefined || anchorColumn.biome !== 'DESERT') return false

  let baseY = Number.MAX_SAFE_INTEGER
  for (let lx = anchorLx - HALF_LOW; lx <= anchorLx + HALF_HIGH; lx++) {
    for (let lz = anchorLz - HALF_LOW; lz <= anchorLz + HALF_HIGH; lz++) {
      baseY = Math.min(baseY, surfaceYs[lx * CHUNK_SIZE + lz] ?? baseY)
    }
  }
  if (!Number.isFinite(baseY) || baseY < 8 || baseY > 200) return false

  const sandstone = blockTypeToIndex('SANDSTONE')
  const chest = blockTypeToIndex('CHEST')
  const air = 0

  const fill = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, id: number): void => {
    for (let lx = x0; lx <= x1; lx++) {
      for (let lz = z0; lz <= z1; lz++) {
        for (let y = y0; y <= y1; y++) {
          blocks[chunkBlockIndexUnchecked(lx, y, lz)] = id
        }
      }
    }
  }

  const x0 = anchorLx - HALF_LOW, x1 = anchorLx + HALF_HIGH
  const z0 = anchorLz - HALF_LOW, z1 = anchorLz + HALF_HIGH
  // Stepped pyramid: 12 → 8 → 4 wide tiers over a hollow treasure hall.
  fill(x0, x1, baseY, baseY, z0, z1, sandstone)
  fill(x0, x1, baseY + 1, baseY + 3, z0, z1, sandstone)
  fill(x0 + 1, x1 - 1, baseY + 1, baseY + 3, z0 + 1, z1 - 1, air)
  fill(x0, x1, baseY + 4, baseY + 4, z0, z1, sandstone)
  fill(x0 + 2, x1 - 2, baseY + 5, baseY + 6, z0 + 2, z1 - 2, sandstone)
  fill(x0 + 4, x1 - 4, baseY + 7, baseY + 8, z0 + 4, z1 - 4, sandstone)
  // Doorway on the -z face; buried treasure under the hall center (vanilla
  // hides its loot beneath the floor).
  fill(anchorLx, anchorLx + 1, baseY + 1, baseY + 2, z0, z0, air)
  blocks[chunkBlockIndexUnchecked(anchorLx, baseY + 1, anchorLz)] = chest
  return true
}
