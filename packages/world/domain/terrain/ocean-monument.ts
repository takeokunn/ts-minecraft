import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BiomeColumn } from './generator-pipeline-model'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Ocean monuments: prismarine halls on the OCEAN floor — third application of
// the single-chunk structure pattern (jungle/desert temples). The monument is
// seated on the seabed; its hall stays flooded until the player drains it,
// like vanilla's.
export const MONUMENT_REGION_SIZE = 384
export const MONUMENT_SPAWN_PERMILLE = 300
const HALF_LOW = 5
const HALF_HIGH = 6
const ANCHOR_LOCAL_MIN = 6
const ANCHOR_LOCAL_SPAN = 4

export type MonumentSite = {
  readonly x: number
  readonly z: number
}

export const monumentSiteForRegion = (regionX: number, regionZ: number): MonumentSite | null => {
  const roll = hash3(regionX, 3991, regionZ)
  if (roll >= MONUMENT_SPAWN_PERMILLE / 1000) return null
  const chunkSpan = Math.floor(MONUMENT_REGION_SIZE / CHUNK_SIZE)
  const chunkX = Math.floor(hash3(regionX, 3992, regionZ) * chunkSpan)
  const chunkZ = Math.floor(hash3(regionX, 3993, regionZ) * chunkSpan)
  const lx = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 3994, regionZ) * ANCHOR_LOCAL_SPAN)
  const lz = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 3995, regionZ) * ANCHOR_LOCAL_SPAN)
  return {
    x: (Math.floor((regionX * MONUMENT_REGION_SIZE) / CHUNK_SIZE) + chunkX) * CHUNK_SIZE + lx,
    z: (Math.floor((regionZ * MONUMENT_REGION_SIZE) / CHUNK_SIZE) + chunkZ) * CHUNK_SIZE + lz,
  }
}

export const writeOceanMonumentForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
  surfaceYs: Int32Array,
  biomeColumns: ReadonlyArray<BiomeColumn>,
): boolean => {
  const regionX = Math.floor((chunkX * CHUNK_SIZE) / MONUMENT_REGION_SIZE)
  const regionZ = Math.floor((chunkZ * CHUNK_SIZE) / MONUMENT_REGION_SIZE)
  const site = monumentSiteForRegion(regionX, regionZ)
  if (site === null) return false
  if (Math.floor(site.x / CHUNK_SIZE) !== chunkX || Math.floor(site.z / CHUNK_SIZE) !== chunkZ) return false

  const anchorLx = site.x - chunkX * CHUNK_SIZE
  const anchorLz = site.z - chunkZ * CHUNK_SIZE
  const anchorColumn = biomeColumns[anchorLx * CHUNK_SIZE + anchorLz]
  if (anchorColumn === undefined || anchorColumn.biome !== 'OCEAN') return false

  let baseY = Number.MAX_SAFE_INTEGER
  for (let lx = anchorLx - HALF_LOW; lx <= anchorLx + HALF_HIGH; lx++) {
    for (let lz = anchorLz - HALF_LOW; lz <= anchorLz + HALF_HIGH; lz++) {
      baseY = Math.min(baseY, surfaceYs[lx * CHUNK_SIZE + lz] ?? baseY)
    }
  }
  if (!Number.isFinite(baseY) || baseY < 8 || baseY > 200) return false

  const prismarine = blockTypeToIndex('PRISMARINE')
  const glowstone = blockTypeToIndex('GLOWSTONE')
  const water = blockTypeToIndex('WATER')

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
  // Prismarine shell around a FLOODED hall (vanilla monuments are water-filled
  // until the player drains them), capped by a stepped roof with glowing
  // sea-lantern stand-ins on the corners.
  fill(x0, x1, baseY, baseY, z0, z1, prismarine)
  fill(x0, x1, baseY + 1, baseY + 4, z0, z1, prismarine)
  fill(x0 + 1, x1 - 1, baseY + 1, baseY + 4, z0 + 1, z1 - 1, water)
  fill(x0, x1, baseY + 5, baseY + 5, z0, z1, prismarine)
  fill(x0 + 2, x1 - 2, baseY + 6, baseY + 6, z0 + 2, z1 - 2, prismarine)
  // Entrance gap on the -z face so the hall is swimmable from outside.
  fill(anchorLx, anchorLx + 1, baseY + 1, baseY + 2, z0, z0, water)
  // Corner lights.
  blocks[chunkBlockIndexUnchecked(x0, baseY + 5, z0)] = glowstone
  blocks[chunkBlockIndexUnchecked(x1, baseY + 5, z0)] = glowstone
  blocks[chunkBlockIndexUnchecked(x0, baseY + 5, z1)] = glowstone
  blocks[chunkBlockIndexUnchecked(x1, baseY + 5, z1)] = glowstone
  return true
}
