import { Option } from 'effect'
import { hashString } from './village-hash'

// Deterministic, seed-derived village placement. The world is divided into
// square regions; each region rolls one potential village site from
// (worldSeed, regionX, regionZ). Same seed -> same villages for every player
// (multiplayer-consistent) and villages are SPARSE like vanilla, instead of
// the old behavior where a village materialized within 80 blocks of wherever
// the player happened to walk.
export const VILLAGE_REGION_SIZE = 384
// Fraction of regions that contain a village, in permille (400 = 40%).
export const VILLAGE_REGION_SPAWN_PERMILLE = 400
// Keep sites away from region edges so structures never straddle two regions.
export const VILLAGE_SITE_MARGIN = 48
// A site becomes a live village once the player is within this distance.
export const VILLAGE_ACTIVATION_DISTANCE = 160

export type VillageSite = {
  readonly x: number
  readonly z: number
}

export const villageSiteForRegion = (
  worldSeed: number,
  regionX: number,
  regionZ: number,
): Option.Option<VillageSite> => {
  const hash = hashString(`${worldSeed}:village:${regionX},${regionZ}`)
  if (hash % 1000 >= VILLAGE_REGION_SPAWN_PERMILLE) return Option.none()
  const span = VILLAGE_REGION_SIZE - VILLAGE_SITE_MARGIN * 2
  // Two independent-ish offsets from the same hash via distinct prime strides.
  const offsetX = VILLAGE_SITE_MARGIN + (Math.floor(hash / 1009) % span)
  const offsetZ = VILLAGE_SITE_MARGIN + (Math.floor(hash / 1000003) % span)
  return Option.some({
    x: regionX * VILLAGE_REGION_SIZE + offsetX,
    z: regionZ * VILLAGE_REGION_SIZE + offsetZ,
  })
}

// All deterministic sites within `radius` blocks (XZ) of `position`.
export const villageSitesNear = (
  worldSeed: number,
  position: { readonly x: number; readonly z: number },
  radius: number,
): ReadonlyArray<VillageSite> => {
  const minRegionX = Math.floor((position.x - radius) / VILLAGE_REGION_SIZE)
  const maxRegionX = Math.floor((position.x + radius) / VILLAGE_REGION_SIZE)
  const minRegionZ = Math.floor((position.z - radius) / VILLAGE_REGION_SIZE)
  const maxRegionZ = Math.floor((position.z + radius) / VILLAGE_REGION_SIZE)
  const radiusSq = radius * radius
  const sites: Array<VillageSite> = []
  for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
    for (let regionZ = minRegionZ; regionZ <= maxRegionZ; regionZ++) {
      const site = Option.getOrNull(villageSiteForRegion(worldSeed, regionX, regionZ))
      if (site === null) continue
      const dx = site.x - position.x
      const dz = site.z - position.z
      if (dx * dx + dz * dz <= radiusSq) sites.push(site)
    }
  }
  return sites
}
