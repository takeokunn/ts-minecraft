import { describe, it, expect } from 'vitest'
import {
  facingFromYaw,
  formatNumber,
  debugFeatureSearchMatches,
  debugFeatureBadges,
  DOM_UPDATE_INTERVAL_MS,
  debugFeatureGroupLabels,
  DEBUG_FEATURE_GROUP_ORDER,
} from '../hud/debug-overlay-utils'

// Minimal catalog entry shapes for testing (type-safe via structural compatibility)
const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-flag',
  label: 'Test Flag',
  group: 'rendering' as const,
  description: 'A test feature flag',
  ...overrides,
})

describe('facingFromYaw', () => {
  it('returns south for yaw 0 (positive Z)', () => {
    const r = facingFromYaw(0)
    expect(r.name).toBe('south')
    expect(r.axis).toBe('Towards positive Z')
  })

  it('returns west for yaw π/2 (negative X)', () => {
    const r = facingFromYaw(Math.PI / 2)
    expect(r.name).toBe('west')
    expect(r.axis).toBe('Towards negative X')
  })

  it('returns north for yaw π (negative Z direction)', () => {
    const r = facingFromYaw(Math.PI)
    expect(r.name).toBe('north')
    expect(r.axis).toBe('Towards negative Z')
  })

  it('returns east for yaw -π/2 (positive X)', () => {
    const r = facingFromYaw(-Math.PI / 2)
    expect(r.name).toBe('east')
    expect(r.axis).toBe('Towards positive X')
  })

  it('wraps yaw values > 2π correctly', () => {
    const r1 = facingFromYaw(0)
    const r2 = facingFromYaw(2 * Math.PI)
    expect(r1.name).toBe(r2.name)
  })

  it('handles negative yaw wrapping', () => {
    const r1 = facingFromYaw(-2 * Math.PI)
    const r2 = facingFromYaw(0)
    expect(r1.name).toBe(r2.name)
  })

  it('returns a consistent result at quarter-boundaries', () => {
    // Just inside west quadrant
    expect(facingFromYaw(Math.PI / 4)).toEqual({ name: 'west', axis: 'Towards negative X' })
    // Just inside south quadrant
    expect(facingFromYaw(-Math.PI / 4 + 0.001)).toEqual({ name: 'south', axis: 'Towards positive Z' })
  })
})

describe('formatNumber', () => {
  it('formats finite numbers with specified decimals', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14')
    expect(formatNumber(1, 0)).toBe('1')
    expect(formatNumber(0.1 + 0.2, 1)).toBe('0.3')
  })

  it('returns "--" for Infinity', () => {
    expect(formatNumber(Infinity, 2)).toBe('--')
    expect(formatNumber(-Infinity, 2)).toBe('--')
  })

  it('returns "--" for NaN', () => {
    expect(formatNumber(NaN, 2)).toBe('--')
  })

  it('formats 0 correctly', () => {
    expect(formatNumber(0, 2)).toBe('0.00')
  })
})

describe('debugFeatureBadges', () => {
  it('returns empty array for an entry without badges', () => {
    const entry = makeEntry()
    expect(debugFeatureBadges(entry as never)).toEqual([])
  })

  it('returns the badges array when present', () => {
    const entry = makeEntry({ badges: ['danger', 'reload'] })
    expect(debugFeatureBadges(entry as never)).toEqual(['danger', 'reload'])
  })
})

describe('debugFeatureSearchMatches', () => {
  it('returns true for empty query', () => {
    expect(debugFeatureSearchMatches(makeEntry() as never, '')).toBe(true)
    expect(debugFeatureSearchMatches(makeEntry() as never, '   ')).toBe(true)
  })

  it('matches on entry id', () => {
    const entry = makeEntry({ id: 'bloom-effect' })
    expect(debugFeatureSearchMatches(entry as never, 'bloom')).toBe(true)
    expect(debugFeatureSearchMatches(entry as never, 'shadow')).toBe(false)
  })

  it('matches on entry label (case-insensitive)', () => {
    const entry = makeEntry({ label: 'Bloom Effect' })
    expect(debugFeatureSearchMatches(entry as never, 'BLOOM')).toBe(true)
  })

  it('matches on description', () => {
    const entry = makeEntry({ description: 'Enables god rays post-processing' })
    expect(debugFeatureSearchMatches(entry as never, 'god rays')).toBe(true)
  })
})

describe('constants', () => {
  it('DOM_UPDATE_INTERVAL_MS is 250', () => {
    expect(DOM_UPDATE_INTERVAL_MS).toBe(250)
  })

  it('debugFeatureGroupLabels has human-readable labels for all groups', () => {
    for (const group of DEBUG_FEATURE_GROUP_ORDER) {
      expect(typeof debugFeatureGroupLabels[group]).toBe('string')
      expect(debugFeatureGroupLabels[group].length).toBeGreaterThan(0)
    }
  })

  it('DEBUG_FEATURE_GROUP_ORDER has 6 entries', () => {
    expect(DEBUG_FEATURE_GROUP_ORDER.length).toBe(6)
  })
})
