import { Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked, hash3 } from './math'

// Stronghold end-portal rooms. Like nether fortresses, sites are derived
// purely from world coordinates via a seedless hash, so each chunk writes its
// own slice independently and multiplayer clients agree for free.
//
// Layout: a cobblestone-shelled room buried at STRONGHOLD_FLOOR_Y with the
// classic 12-frame end-portal ring (unfilled) around an empty 3×3 interior.
// The player finds one with an eye of ender (which pulls toward the nearest
// site), digs down, and fills the frames to open the portal.

export const STRONGHOLD_REGION_SIZE = 384
// Fraction of regions containing a stronghold, in permille.
export const STRONGHOLD_REGION_SPAWN_PERMILLE = 350
const STRONGHOLD_SITE_MARGIN = 96
export const STRONGHOLD_FLOOR_Y = 28
// Interior half-extent (room spans ±ROOM_HALF around the site, walls outside).
const ROOM_HALF = 5
const ROOM_AIR_HEIGHT = 5

export type StrongholdSite = {
  readonly x: number
  readonly z: number
}

export const strongholdSiteForRegion = (
  regionX: number,
  regionZ: number,
): StrongholdSite | null => {
  const roll = hash3(regionX, 991, regionZ)
  if (roll >= STRONGHOLD_REGION_SPAWN_PERMILLE / 1000) return null
  const span = STRONGHOLD_REGION_SIZE - STRONGHOLD_SITE_MARGIN * 2
  const offsetX = STRONGHOLD_SITE_MARGIN + Math.floor(hash3(regionX, 992, regionZ) * span)
  const offsetZ = STRONGHOLD_SITE_MARGIN + Math.floor(hash3(regionX, 993, regionZ) * span)
  return {
    x: regionX * STRONGHOLD_REGION_SIZE + offsetX,
    z: regionZ * STRONGHOLD_REGION_SIZE + offsetZ,
  }
}

// Nearest stronghold site to (x, z), scanning the surrounding region
// neighborhood. Drives the eye-of-ender locator; None only in the (rare)
// all-miss neighborhood — widen the search radius until a site appears.
export const nearestStrongholdSite = (x: number, z: number): Option.Option<StrongholdSite> => {
  const centerRegionX = Math.floor(x / STRONGHOLD_REGION_SIZE)
  const centerRegionZ = Math.floor(z / STRONGHOLD_REGION_SIZE)
  for (let radius = 0; radius <= 4; radius++) {
    let best: StrongholdSite | null = null
    let bestDistSq = Number.POSITIVE_INFINITY
    for (let regionX = centerRegionX - radius; regionX <= centerRegionX + radius; regionX++) {
      for (let regionZ = centerRegionZ - radius; regionZ <= centerRegionZ + radius; regionZ++) {
        const site = strongholdSiteForRegion(regionX, regionZ)
        if (site === null) continue
        const dx = site.x - x
        const dz = site.z - z
        const distSq = dx * dx + dz * dz
        if (distSq < bestDistSq) {
          best = site
          bestDistSq = distSq
        }
      }
    }
    if (best !== null) return Option.some(best)
  }
  return Option.none()
}

// The 12 end-portal-frame positions for a site: three per side around the
// 3×3 interior, at floor + 1 (resting on the floor slab).
export const endPortalFramePositionsForSite = (site: StrongholdSite): ReadonlyArray<Position> => {
  const y = STRONGHOLD_FLOOR_Y + 1
  const positions: Position[] = []
  for (let offset = -1; offset <= 1; offset++) {
    positions.push({ x: site.x + offset, y, z: site.z - 2 })
    positions.push({ x: site.x + offset, y, z: site.z + 2 })
    positions.push({ x: site.x - 2, y, z: site.z + offset })
    positions.push({ x: site.x + 2, y, z: site.z + offset })
  }
  return positions
}

// The 3×3 interior cells that become END_PORTAL blocks on activation.
export const endPortalInteriorForSite = (site: StrongholdSite): ReadonlyArray<Position> => {
  const y = STRONGHOLD_FLOOR_Y + 1
  const positions: Position[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      positions.push({ x: site.x + dx, y, z: site.z + dz })
    }
  }
  return positions
}

const strongholdBlockAt = (
  site: StrongholdSite,
  wx: number,
  y: number,
  wz: number,
): BlockType | null => {
  const dx = wx - site.x
  const dz = wz - site.z
  const shell = ROOM_HALF + 1
  if (Math.abs(dx) > shell || Math.abs(dz) > shell) return null

  const floorY = STRONGHOLD_FLOOR_Y
  const ceilingY = STRONGHOLD_FLOOR_Y + ROOM_AIR_HEIGHT + 1
  if (y < floorY || y > ceilingY) return null

  // Cobblestone shell: floor, ceiling, and perimeter walls.
  const onWall = Math.abs(dx) === shell || Math.abs(dz) === shell
  if (y === floorY || y === ceilingY || onWall) return 'COBBLESTONE'

  // Frame ring (three per side around the 3×3 interior) sits on the floor.
  if (y === floorY + 1) {
    const onRing =
      (Math.abs(dz) === 2 && Math.abs(dx) <= 1) ||
      (Math.abs(dx) === 2 && Math.abs(dz) <= 1)
    if (onRing) return 'END_PORTAL_FRAME'
  }

  return 'AIR'
}

// Writes this chunk's slice of any stronghold room intersecting it. Runs as
// the overworld generator's final pass so the room carves through caves/ores.
export const writeStrongholdBlocksForChunk = (
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
): void => {
  const baseWorldX = chunkX * CHUNK_SIZE
  const baseWorldZ = chunkZ * CHUNK_SIZE
  const reach = ROOM_HALF + 1

  const minRegionX = Math.floor((baseWorldX - reach) / STRONGHOLD_REGION_SIZE)
  const maxRegionX = Math.floor((baseWorldX + CHUNK_SIZE + reach) / STRONGHOLD_REGION_SIZE)
  const minRegionZ = Math.floor((baseWorldZ - reach) / STRONGHOLD_REGION_SIZE)
  const maxRegionZ = Math.floor((baseWorldZ + CHUNK_SIZE + reach) / STRONGHOLD_REGION_SIZE)

  for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
    for (let regionZ = minRegionZ; regionZ <= maxRegionZ; regionZ++) {
      const site = strongholdSiteForRegion(regionX, regionZ)
      if (site === null) continue
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseWorldX + lx
        if (Math.abs(wx - site.x) > reach) continue
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wz = baseWorldZ + lz
          if (Math.abs(wz - site.z) > reach) continue
          for (let y = STRONGHOLD_FLOOR_Y; y <= STRONGHOLD_FLOOR_Y + ROOM_AIR_HEIGHT + 1; y++) {
            const blockType = strongholdBlockAt(site, wx, y, wz)
            if (blockType !== null) {
              blocks[chunkBlockIndexUnchecked(lx, y, lz)] = blockTypeToIndex(blockType)
            }
          }
        }
      }
    }
  }
}
