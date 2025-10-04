import { describe, it, expect } from '@effect/vitest'
import { WORLD_DOMAIN_FEATURES, WORLD_DOMAIN_STATS, WORLD_DOMAIN_VERSION } from '../metadata'

describe('domain/world/metadata', () => {
  it('declares semantic version info', () => {
    expect(WORLD_DOMAIN_VERSION.major).toBeGreaterThanOrEqual(0)
    expect(WORLD_DOMAIN_VERSION.compatibility.effectTs).toContain('3.')
  })

  it('highlights core features', () => {
    expect(WORLD_DOMAIN_FEATURES.DDD_AGGREGATE_ROOTS).toBe(true)
    expect(WORLD_DOMAIN_FEATURES.EFFECT_TS_INTEGRATION).toBe(true)
  })

  it('tracks statistics coverage', () => {
    expect(WORLD_DOMAIN_STATS.totalFiles).toBeGreaterThan(0)
    expect(WORLD_DOMAIN_STATS.bundleSize.gzipped).toMatch(/KB$/)
  })
})
