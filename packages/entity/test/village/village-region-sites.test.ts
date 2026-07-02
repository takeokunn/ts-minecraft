import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  VILLAGE_REGION_SIZE,
  VILLAGE_REGION_SPAWN_PERMILLE,
  VILLAGE_SITE_MARGIN,
  villageSiteForRegion,
  villageSitesNear,
} from '@ts-minecraft/entity/domain/village/village-region-sites'

describe('villageSiteForRegion', () => {
  it('is deterministic: same seed and region always yield the same site', () => {
    for (let region = -5; region <= 5; region++) {
      const first = villageSiteForRegion(42, region, -region)
      const second = villageSiteForRegion(42, region, -region)
      expect(first).toEqual(second)
    }
  })

  it('different seeds produce different site layouts', () => {
    const layout = (seed: number): string =>
      JSON.stringify(
        Array.from({ length: 20 }, (_, i) => Option.getOrNull(villageSiteForRegion(seed, i, 0))),
      )
    expect(layout(1)).not.toBe(layout(2))
  })

  it('keeps sites inside the region with the configured margin', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (let region = -3; region <= 3; region++) {
        const site = Option.getOrNull(villageSiteForRegion(seed, region, region))
        if (site === null) continue
        const localX = site.x - region * VILLAGE_REGION_SIZE
        const localZ = site.z - region * VILLAGE_REGION_SIZE
        expect(localX).toBeGreaterThanOrEqual(VILLAGE_SITE_MARGIN)
        expect(localX).toBeLessThan(VILLAGE_REGION_SIZE - VILLAGE_SITE_MARGIN)
        expect(localZ).toBeGreaterThanOrEqual(VILLAGE_SITE_MARGIN)
        expect(localZ).toBeLessThan(VILLAGE_REGION_SIZE - VILLAGE_SITE_MARGIN)
      }
    }
  })

  it('spawns in roughly the configured fraction of regions (sparse, not everywhere)', () => {
    let withSite = 0
    const total = 400
    for (let i = 0; i < total; i++) {
      if (Option.isSome(villageSiteForRegion(7, i % 20, Math.floor(i / 20)))) withSite++
    }
    const fraction = withSite / total
    const target = VILLAGE_REGION_SPAWN_PERMILLE / 1000
    expect(fraction).toBeGreaterThan(target - 0.15)
    expect(fraction).toBeLessThan(target + 0.15)
  })
})

describe('villageSitesNear', () => {
  it('returns only sites within the given radius', () => {
    const center = { x: 100, z: 100 }
    const radius = 500
    for (const site of villageSitesNear(9, center, radius)) {
      const dist = Math.hypot(site.x - center.x, site.z - center.z)
      expect(dist).toBeLessThanOrEqual(radius)
    }
  })

  it('finds sites across negative-coordinate regions too', () => {
    const sites = villageSitesNear(3, { x: -2000, z: -2000 }, 1500)
    for (const site of sites) {
      expect(Number.isFinite(site.x)).toBe(true)
      expect(Number.isFinite(site.z)).toBe(true)
    }
  })
})
