import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BiomeColumn } from './generator-pipeline-model'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Jungle temples: region-hashed surface structures (same deterministic
// world-coordinate pattern as strongholds/fortresses). The whole 12x12
// footprint is anchored INSIDE one chunk so the writer only needs that
// chunk's own surface heights and biome columns — no cross-chunk reads.
export const TEMPLE_REGION_SIZE = 320
export const TEMPLE_REGION_SPAWN_PERMILLE = 300
// Footprint half-extents around the anchor: x/z in [anchor-5, anchor+6].
const HALF_LOW = 5
const HALF_HIGH = 6
// Anchor's chunk-local coordinate is forced into [6..9] so the footprint
// [local-5, local+6] stays inside the 16-block chunk.
const ANCHOR_LOCAL_MIN = 6
const ANCHOR_LOCAL_SPAN = 4

export type TempleSite = {
  readonly x: number
  readonly z: number
}

export const templeSiteForRegion = (regionX: number, regionZ: number): TempleSite | null => {
  const roll = hash3(regionX, 1991, regionZ)
  if (roll >= TEMPLE_REGION_SPAWN_PERMILLE / 1000) return null
  const chunkSpan = Math.floor(TEMPLE_REGION_SIZE / CHUNK_SIZE)
  const chunkX = Math.floor(hash3(regionX, 1992, regionZ) * chunkSpan)
  const chunkZ = Math.floor(hash3(regionX, 1993, regionZ) * chunkSpan)
  const lx = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 1994, regionZ) * ANCHOR_LOCAL_SPAN)
  const lz = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 1995, regionZ) * ANCHOR_LOCAL_SPAN)
  return {
    x: (Math.floor((regionX * TEMPLE_REGION_SIZE) / CHUNK_SIZE) + chunkX) * CHUNK_SIZE + lx,
    z: (Math.floor((regionZ * TEMPLE_REGION_SIZE) / CHUNK_SIZE) + chunkZ) * CHUNK_SIZE + lz,
  }
}

// Writes this chunk's jungle temple, when (a) the region rolled a site,
// (b) the site's footprint chunk IS this chunk, and (c) the anchor column's
// biome is JUNGLE. surfaceYs/biomeColumns are indexed lx * CHUNK_SIZE + lz.
export const writeJungleTempleForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
  surfaceYs: Int32Array,
  biomeColumns: ReadonlyArray<BiomeColumn>,
): boolean => {
  const regionX = Math.floor((chunkX * CHUNK_SIZE) / TEMPLE_REGION_SIZE)
  const regionZ = Math.floor((chunkZ * CHUNK_SIZE) / TEMPLE_REGION_SIZE)
  const site = templeSiteForRegion(regionX, regionZ)
  if (site === null) return false
  if (Math.floor(site.x / CHUNK_SIZE) !== chunkX || Math.floor(site.z / CHUNK_SIZE) !== chunkZ) return false

  const anchorLx = site.x - chunkX * CHUNK_SIZE
  const anchorLz = site.z - chunkZ * CHUNK_SIZE
  const anchorColumn = biomeColumns[anchorLx * CHUNK_SIZE + anchorLz]
  if (anchorColumn === undefined || anchorColumn.biome !== 'JUNGLE') return false

  // Seat the platform on the LOWEST surface under the footprint so the
  // temple embeds into slopes instead of floating off them.
  let baseY = Number.MAX_SAFE_INTEGER
  for (let lx = anchorLx - HALF_LOW; lx <= anchorLx + HALF_HIGH; lx++) {
    for (let lz = anchorLz - HALF_LOW; lz <= anchorLz + HALF_HIGH; lz++) {
      baseY = Math.min(baseY, surfaceYs[lx * CHUNK_SIZE + lz] ?? baseY)
    }
  }
  if (!Number.isFinite(baseY) || baseY < 8 || baseY > 200) return false

  const cobble = blockTypeToIndex('COBBLESTONE')
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
  // Tier 1: platform + hollow hall (walls 3 high, roof slab).
  fill(x0, x1, baseY, baseY, z0, z1, cobble)
  fill(x0, x1, baseY + 1, baseY + 3, z0, z1, cobble)
  fill(x0 + 1, x1 - 1, baseY + 1, baseY + 3, z0 + 1, z1 - 1, air)
  fill(x0, x1, baseY + 4, baseY + 4, z0, z1, cobble)
  // Tier 2: stepped upper storey (8x8), hollow, capped.
  fill(x0 + 2, x1 - 2, baseY + 5, baseY + 7, z0 + 2, z1 - 2, cobble)
  fill(x0 + 3, x1 - 3, baseY + 5, baseY + 7, z0 + 3, z1 - 3, air)
  fill(x0 + 2, x1 - 2, baseY + 8, baseY + 8, z0 + 2, z1 - 2, cobble)
  // Tier 3: crown.
  fill(x0 + 4, x1 - 4, baseY + 9, baseY + 9, z0 + 4, z1 - 4, cobble)
  // Doorway: 2-wide, 2-tall opening centered on the -z face.
  fill(anchorLx, anchorLx + 1, baseY + 1, baseY + 2, z0, z0, air)
  // Treasure chest at the hall center.
  blocks[chunkBlockIndexUnchecked(anchorLx, baseY + 1, anchorLz)] = chest
  return true
}
