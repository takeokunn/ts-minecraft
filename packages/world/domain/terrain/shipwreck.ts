import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BiomeColumn } from './generator-pipeline-model'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Shipwrecks: sunken plank hulls on the OCEAN floor — fifth application of
// the single-chunk structure pattern. A broken hull with a mast stump and a
// supply chest, flooded like everything down there.
export const SHIPWRECK_REGION_SIZE = 256
export const SHIPWRECK_SPAWN_PERMILLE = 300
const HALF_LOW = 5
const HALF_HIGH = 6
const ANCHOR_LOCAL_MIN = 6
const ANCHOR_LOCAL_SPAN = 4

export type ShipwreckSite = {
  readonly x: number
  readonly z: number
}

export const shipwreckSiteForRegion = (regionX: number, regionZ: number): ShipwreckSite | null => {
  const roll = hash3(regionX, 5991, regionZ)
  if (roll >= SHIPWRECK_SPAWN_PERMILLE / 1000) return null
  const chunkSpan = Math.floor(SHIPWRECK_REGION_SIZE / CHUNK_SIZE)
  const chunkX = Math.floor(hash3(regionX, 5992, regionZ) * chunkSpan)
  const chunkZ = Math.floor(hash3(regionX, 5993, regionZ) * chunkSpan)
  const lx = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 5994, regionZ) * ANCHOR_LOCAL_SPAN)
  const lz = ANCHOR_LOCAL_MIN + Math.floor(hash3(regionX, 5995, regionZ) * ANCHOR_LOCAL_SPAN)
  return {
    x: (Math.floor((regionX * SHIPWRECK_REGION_SIZE) / CHUNK_SIZE) + chunkX) * CHUNK_SIZE + lx,
    z: (Math.floor((regionZ * SHIPWRECK_REGION_SIZE) / CHUNK_SIZE) + chunkZ) * CHUNK_SIZE + lz,
  }
}

export const writeShipwreckForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
  surfaceYs: Int32Array,
  biomeColumns: ReadonlyArray<BiomeColumn>,
): boolean => {
  const regionX = Math.floor((chunkX * CHUNK_SIZE) / SHIPWRECK_REGION_SIZE)
  const regionZ = Math.floor((chunkZ * CHUNK_SIZE) / SHIPWRECK_REGION_SIZE)
  const site = shipwreckSiteForRegion(regionX, regionZ)
  if (site === null) return false
  if (Math.floor(site.x / CHUNK_SIZE) !== chunkX || Math.floor(site.z / CHUNK_SIZE) !== chunkZ) return false

  const anchorLx = site.x - chunkX * CHUNK_SIZE
  const anchorLz = site.z - chunkZ * CHUNK_SIZE
  const anchorColumn = biomeColumns[anchorLx * CHUNK_SIZE + anchorLz]
  if (anchorColumn === undefined || anchorColumn.biome !== 'OCEAN') return false

  let baseY = Number.MAX_SAFE_INTEGER
  for (let lx = anchorLx - HALF_LOW; lx <= anchorLx + HALF_HIGH; lx++) {
    for (let lz = anchorLz - 2; lz <= anchorLz + 2; lz++) {
      baseY = Math.min(baseY, surfaceYs[lx * CHUNK_SIZE + lz] ?? baseY)
    }
  }
  if (!Number.isFinite(baseY) || baseY < 8 || baseY > 200) return false

  const planks = blockTypeToIndex('PLANKS')
  const log = blockTypeToIndex('WOOD')
  const chest = blockTypeToIndex('CHEST')

  const put = (lx: number, y: number, lz: number, id: number): void => {
    blocks[chunkBlockIndexUnchecked(lx, y, lz)] = id
  }

  // Hull: a 12-long, 5-wide open boat lying along X — keel line, curved-ish
  // sides two planks high, broken amidships (a 2-block gap in one wall).
  const x0 = anchorLx - HALF_LOW, x1 = anchorLx + HALF_HIGH
  const z0 = anchorLz - 2, z1 = anchorLz + 2
  for (let lx = x0; lx <= x1; lx++) {
    for (let lz = z0; lz <= z1; lz++) put(lx, baseY + 1, lz, planks) // deck floor
  }
  for (let lx = x0; lx <= x1; lx++) {
    // side walls with a breach on the -z wall amidships
    const breached = lx >= anchorLx - 1 && lx <= anchorLx
    if (!breached) put(lx, baseY + 2, z0, planks)
    put(lx, baseY + 2, z1, planks)
  }
  // bow/stern caps
  for (let lz = z0; lz <= z1; lz++) {
    put(x0, baseY + 2, lz, planks)
    put(x1, baseY + 2, lz, planks)
  }
  // Mast stump (2 logs) + supply chest at the stern.
  put(anchorLx, baseY + 2, anchorLz, log)
  put(anchorLx, baseY + 3, anchorLz, log)
  put(x1 - 1, baseY + 2, anchorLz, chest)
  return true
}
