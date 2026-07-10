import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Amethyst geodes: rare hollow crystal pockets underground — sixth
// application of the single-chunk structure pattern. Concentric shells from
// the outside in: smooth basalt, calcite, an amethyst lining, and a hollow
// core studded with glowing clusters. The center is constrained to the chunk
// middle so the whole sphere stays inside one chunk (no cross-chunk seams).
export const GEODE_REGION_SIZE = 128
export const GEODE_SPAWN_PERMILLE = 350
export const GEODE_MIN_RADIUS = 5
export const GEODE_MAX_RADIUS = 7
export const GEODE_CENTER_MIN_Y = 14
export const GEODE_CENTER_MAX_Y = 38
// Chance (per mille) that a hollow-core cell adjacent to the lining grows a
// crystal cluster.
export const GEODE_CLUSTER_PERMILLE = 350

export type GeodeSite = {
  readonly x: number
  readonly z: number
  readonly y: number
  readonly radius: number
}

export const geodeSiteForRegion = (regionX: number, regionZ: number): GeodeSite | null => {
  const roll = hash3(regionX, 7301, regionZ)
  if (roll >= GEODE_SPAWN_PERMILLE / 1000) return null
  const chunkSpan = Math.floor(GEODE_REGION_SIZE / CHUNK_SIZE)
  const chunkX = Math.floor(hash3(regionX, 7302, regionZ) * chunkSpan)
  const chunkZ = Math.floor(hash3(regionX, 7303, regionZ) * chunkSpan)
  const radius = GEODE_MIN_RADIUS +
    Math.floor(hash3(regionX, 7304, regionZ) * (GEODE_MAX_RADIUS - GEODE_MIN_RADIUS + 1))
  // Center local coordinates keep the sphere inside the chunk: radius ≤ 7 and
  // the chunk is 16 wide, so lx/lz ∈ [radius, 15 - radius].
  const localSpan = CHUNK_SIZE - 2 * radius
  const lx = radius + Math.floor(hash3(regionX, 7305, regionZ) * localSpan)
  const lz = radius + Math.floor(hash3(regionX, 7306, regionZ) * localSpan)
  const y = GEODE_CENTER_MIN_Y +
    Math.floor(hash3(regionX, 7307, regionZ) * (GEODE_CENTER_MAX_Y - GEODE_CENTER_MIN_Y + 1))
  return {
    x: (Math.floor((regionX * GEODE_REGION_SIZE) / CHUNK_SIZE) + chunkX) * CHUNK_SIZE + lx,
    z: (Math.floor((regionZ * GEODE_REGION_SIZE) / CHUNK_SIZE) + chunkZ) * CHUNK_SIZE + lz,
    y,
    radius,
  }
}

export const writeAmethystGeodeForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
): boolean => {
  const regionX = Math.floor((chunkX * CHUNK_SIZE) / GEODE_REGION_SIZE)
  const regionZ = Math.floor((chunkZ * CHUNK_SIZE) / GEODE_REGION_SIZE)
  const site = geodeSiteForRegion(regionX, regionZ)
  if (site === null) return false
  if (Math.floor(site.x / CHUNK_SIZE) !== chunkX || Math.floor(site.z / CHUNK_SIZE) !== chunkZ) return false

  const centerLx = site.x - chunkX * CHUNK_SIZE
  const centerLz = site.z - chunkZ * CHUNK_SIZE
  const r = site.radius

  const air = blockTypeToIndex('AIR')
  const bedrock = blockTypeToIndex('BEDROCK')
  const basalt = blockTypeToIndex('SMOOTH_BASALT')
  const calcite = blockTypeToIndex('CALCITE')
  const amethyst = blockTypeToIndex('AMETHYST_BLOCK')
  const cluster = blockTypeToIndex('AMETHYST_CLUSTER')

  // Concentric shells by squared distance (avoids sqrt per voxel). The core
  // hollows out at d < r-3; the ring immediately inside the lining sprouts
  // clusters on a deterministic per-voxel roll.
  const rOuterSq = r * r
  const rCalciteSq = (r - 1) * (r - 1)
  const rAmethystSq = (r - 2) * (r - 2)
  const rCoreSq = (r - 3) * (r - 3)

  for (let dy = -r; dy <= r; dy++) {
    const y = site.y + dy
    if (y < 1 || y >= 255) continue
    for (let dx = -r; dx <= r; dx++) {
      const lx = centerLx + dx
      for (let dz = -r; dz <= r; dz++) {
        const lz = centerLz + dz
        const dSq = dx * dx + dy * dy + dz * dz
        if (dSq > rOuterSq) continue
        const idx = chunkBlockIndexUnchecked(lx, y, lz)
        if (blocks[idx] === bedrock) continue
        if (dSq > rCalciteSq) {
          blocks[idx] = basalt
        } else if (dSq > rAmethystSq) {
          blocks[idx] = calcite
        } else if (dSq > rCoreSq) {
          blocks[idx] = amethyst
        } else {
          // Hollow core; the outermost core ring rolls for clusters so the
          // crystals hug the lining like a real geode's druse.
          const isInnerRing = dSq > (r - 4) * (r - 4)
          const sprouts = isInnerRing &&
            hash3(site.x + dx, y * 31, site.z + dz) < GEODE_CLUSTER_PERMILLE / 1000
          blocks[idx] = sprouts ? cluster : air
        }
      }
    }
  }
  return true
}
