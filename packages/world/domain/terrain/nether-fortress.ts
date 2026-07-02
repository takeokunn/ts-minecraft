import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Nether fortress generation. Fortresses are derived purely from world
// coordinates (same seedless-hash convention as the nether's bedrock and
// lava passes), so every chunk can emit its slice of a fortress
// independently — no cross-chunk coordination and automatic
// multiplayer/session consistency.
//
// Layout: a cross of two elevated corridors (X-axis and Z-axis) centered on
// the region's fortress point — nether-brick floor and roof slabs, 3-high
// walls with window gaps, and support pillars dropping to the ground every
// 8 blocks.

export const FORTRESS_REGION_SIZE = 256
// Fraction of regions containing a fortress, in permille.
export const FORTRESS_REGION_SPAWN_PERMILLE = 300
const FORTRESS_SITE_MARGIN = 64
export const FORTRESS_FLOOR_Y = 48
const CORRIDOR_HALF_LENGTH = 24
const CORRIDOR_HALF_WIDTH = 2
const WALL_HEIGHT = 3
const PILLAR_INTERVAL = 8
const WINDOW_INTERVAL = 4

export type FortressSite = {
  readonly x: number
  readonly z: number
}

export const fortressSiteForRegion = (
  regionX: number,
  regionZ: number,
): FortressSite | null => {
  const roll = hash3(regionX, 777, regionZ)
  if (roll >= FORTRESS_REGION_SPAWN_PERMILLE / 1000) return null
  const span = FORTRESS_REGION_SIZE - FORTRESS_SITE_MARGIN * 2
  const offsetX = FORTRESS_SITE_MARGIN + Math.floor(hash3(regionX, 778, regionZ) * span)
  const offsetZ = FORTRESS_SITE_MARGIN + Math.floor(hash3(regionX, 779, regionZ) * span)
  return {
    x: regionX * FORTRESS_REGION_SIZE + offsetX,
    z: regionZ * FORTRESS_REGION_SIZE + offsetZ,
  }
}

// The block a fortress places at world column (wx, wz) and height y, or 0
// (nothing). Evaluated per column so a chunk only writes its own slice.
const fortressBlockAt = (
  site: FortressSite,
  wx: number,
  y: number,
  wz: number,
): boolean => {
  const dx = wx - site.x
  const dz = wz - site.z
  const inXCorridor = Math.abs(dx) <= CORRIDOR_HALF_LENGTH && Math.abs(dz) <= CORRIDOR_HALF_WIDTH
  const inZCorridor = Math.abs(dz) <= CORRIDOR_HALF_LENGTH && Math.abs(dx) <= CORRIDOR_HALF_WIDTH
  if (!inXCorridor && !inZCorridor) return false

  // Floor and roof slabs.
  if (y === FORTRESS_FLOOR_Y || y === FORTRESS_FLOOR_Y + WALL_HEIGHT + 1) return true

  // Walls along the corridor edges, with window gaps every few blocks.
  if (y > FORTRESS_FLOOR_Y && y <= FORTRESS_FLOOR_Y + WALL_HEIGHT) {
    const onXEdge = inXCorridor && Math.abs(dz) === CORRIDOR_HALF_WIDTH && !inZCorridor
    const onZEdge = inZCorridor && Math.abs(dx) === CORRIDOR_HALF_WIDTH && !inXCorridor
    if (onXEdge || onZEdge) {
      const along = onXEdge ? dx : dz
      const isWindow = y === FORTRESS_FLOOR_Y + 2 && ((along % WINDOW_INTERVAL) + WINDOW_INTERVAL) % WINDOW_INTERVAL === 0
      return !isWindow
    }
    return false
  }

  // Support pillars under the corridor spine down to the ground.
  if (y < FORTRESS_FLOOR_Y) {
    const onSpine = (inXCorridor && dz === 0) || (inZCorridor && dx === 0)
    if (!onSpine) return false
    const along = inXCorridor && dz === 0 ? dx : dz
    return ((along % PILLAR_INTERVAL) + PILLAR_INTERVAL) % PILLAR_INTERVAL === 0
  }

  return false
}

// Writes this chunk's slice of any fortress whose footprint intersects it.
export const writeFortressBlocksForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
): void => {
  const baseWorldX = chunkX * CHUNK_SIZE
  const baseWorldZ = chunkZ * CHUNK_SIZE
  const netherBrickIndex = blockTypeToIndex('NETHER_BRICK')

  // A fortress reaches at most CORRIDOR_HALF_LENGTH from its site, so only
  // the regions overlapping the chunk (± reach) can contribute.
  const reach = CORRIDOR_HALF_LENGTH
  const minRegionX = Math.floor((baseWorldX - reach) / FORTRESS_REGION_SIZE)
  const maxRegionX = Math.floor((baseWorldX + CHUNK_SIZE + reach) / FORTRESS_REGION_SIZE)
  const minRegionZ = Math.floor((baseWorldZ - reach) / FORTRESS_REGION_SIZE)
  const maxRegionZ = Math.floor((baseWorldZ + CHUNK_SIZE + reach) / FORTRESS_REGION_SIZE)

  for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
    for (let regionZ = minRegionZ; regionZ <= maxRegionZ; regionZ++) {
      const site = fortressSiteForRegion(regionX, regionZ)
      if (site === null) continue
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseWorldX + lx
        if (Math.abs(wx - site.x) > reach) continue
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wz = baseWorldZ + lz
          if (Math.abs(wz - site.z) > reach) continue
          for (let y = 1; y <= FORTRESS_FLOOR_Y + WALL_HEIGHT + 1; y++) {
            if (fortressBlockAt(site, wx, y, wz)) {
              blocks[chunkBlockIndexUnchecked(lx, y, lz)] = netherBrickIndex
            } else if (y > FORTRESS_FLOOR_Y && y <= FORTRESS_FLOOR_Y + WALL_HEIGHT) {
              // Clear the corridor interior so it is walkable even where the
              // nether terrain was solid.
              const dx = wx - site.x
              const dz = wz - site.z
              const insideX = Math.abs(dx) <= CORRIDOR_HALF_LENGTH && Math.abs(dz) < CORRIDOR_HALF_WIDTH
              const insideZ = Math.abs(dz) <= CORRIDOR_HALF_LENGTH && Math.abs(dx) < CORRIDOR_HALF_WIDTH
              if (insideX || insideZ) {
                blocks[chunkBlockIndexUnchecked(lx, y, lz)] = 0
              }
            }
          }
        }
      }
    }
  }
}
