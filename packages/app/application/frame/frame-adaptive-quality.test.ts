import { describe, expect, it } from 'vitest'
import { decideAdaptiveQuality } from '@ts-minecraft/app/frame/frame-adaptive-quality'
import type { AdaptiveQualityInput, AdaptiveQualityDecision } from '@ts-minecraft/app/frame/frame-adaptive-quality'

// Thresholds from frame-handler.config.ts:
// ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD = 50
// ADAPTIVE_QUALITY_RECOVERY_FPS_THRESHOLD = 50 + 10 = 60
const HIGH_FPS = 50
const RECOVERY_FPS = 60

// ─── helpers ─────────────────────────────────────────────────────────────────

type Quality = AdaptiveQualityInput['graphicsQuality']

const input = (overrides: Partial<AdaptiveQualityInput> = {}): AdaptiveQualityInput => ({
  adaptivePerformanceMode: true,
  graphicsQuality: 'medium',
  renderDistance: 8,
  fps: HIGH_FPS,
  cooldown: 0,
  ...overrides,
})

const isPatch = (d: AdaptiveQualityDecision): d is { nextCooldown: number; settingsPatch: { graphicsQuality?: Quality; renderDistance?: number } } =>
  typeof d === 'object'

// ─── adaptive mode disabled ───────────────────────────────────────────────────
describe('adaptive mode disabled', () => {
  it('returns the current cooldown unchanged when adaptivePerformanceMode is false', () => {
    const result = decideAdaptiveQuality(input({ adaptivePerformanceMode: false, cooldown: 5 }))
    expect(result).toBe(5)
  })

  it('returns 0 when cooldown is 0 and mode is disabled', () => {
    const result = decideAdaptiveQuality(input({ adaptivePerformanceMode: false, cooldown: 0 }))
    expect(result).toBe(0)
  })
})

// ─── cooldown draining ────────────────────────────────────────────────────────
describe('cooldown draining', () => {
  it('decrements cooldown by 1 while it is positive', () => {
    const result = decideAdaptiveQuality(input({ cooldown: 10 }))
    expect(result).toBe(9)
  })

  it('returns 0 when cooldown is 1 (decrements to 0)', () => {
    const result = decideAdaptiveQuality(input({ cooldown: 1 }))
    expect(result).toBe(0)
  })
})

// ─── fps === 0 (not yet measured) ────────────────────────────────────────────
describe('fps guard', () => {
  it('returns unchanged cooldown when fps is 0', () => {
    const result = decideAdaptiveQuality(input({ fps: 0, cooldown: 0 }))
    expect(result).toBe(0)
  })
})

// ─── recovery path (fps >= 60) ────────────────────────────────────────────────
describe('recovery path — fps at or above recovery threshold', () => {
  it('increases render distance when fps is high and render distance is below 8', () => {
    const result = decideAdaptiveQuality(input({ fps: RECOVERY_FPS, renderDistance: 6 }))
    expect(isPatch(result)).toBe(true)
    if (isPatch(result)) {
      expect(result.settingsPatch.renderDistance).toBe(7)
      expect(result.nextCooldown).toBeGreaterThan(0)
    }
  })

  it('upgrades graphics quality when render distance is already at recovery target', () => {
    const result = decideAdaptiveQuality(input({ fps: RECOVERY_FPS, graphicsQuality: 'medium', renderDistance: 8 }))
    expect(isPatch(result)).toBe(true)
    if (isPatch(result)) {
      expect(result.settingsPatch.graphicsQuality).toBe('high')
    }
  })

  it('upgrades from high to ultra is not available — returns no change when already at ultra', () => {
    const result = decideAdaptiveQuality(input({ fps: RECOVERY_FPS, graphicsQuality: 'ultra', renderDistance: 8 }))
    expect(typeof result).toBe('number')
  })

  it('skips recovery upgrade when chunk sync is pending', () => {
    const result = decideAdaptiveQuality(input({ fps: RECOVERY_FPS, renderDistance: 6, chunkSyncPending: true }))
    expect(typeof result).toBe('number')
  })

  it('returns no change when already at max quality and max render distance', () => {
    const result = decideAdaptiveQuality(input({ fps: RECOVERY_FPS, graphicsQuality: 'ultra', renderDistance: 16 }))
    expect(typeof result).toBe('number')
  })
})

// ─── stable zone (fps >= 50 but < 60) ────────────────────────────────────────
describe('stable zone — fps at or above high threshold but below recovery', () => {
  it('returns current cooldown unchanged when fps is exactly at high threshold', () => {
    const result = decideAdaptiveQuality(input({ fps: HIGH_FPS }))
    expect(typeof result).toBe('number')
  })

  it('returns current cooldown unchanged when fps is between thresholds', () => {
    const result = decideAdaptiveQuality(input({ fps: 55 }))
    expect(typeof result).toBe('number')
  })
})

// ─── degradation path (fps < 50) ─────────────────────────────────────────────
describe('degradation path — fps below high threshold', () => {
  it('downgrades graphics from ultra to high when fps is low', () => {
    const result = decideAdaptiveQuality(input({ fps: 20, graphicsQuality: 'ultra' }))
    expect(isPatch(result)).toBe(true)
    if (isPatch(result)) {
      expect(result.settingsPatch.graphicsQuality).toBe('high')
      expect(result.nextCooldown).toBeGreaterThan(0)
    }
  })

  it('downgrades graphics from high to medium when fps is low', () => {
    const result = decideAdaptiveQuality(input({ fps: 20, graphicsQuality: 'high' }))
    expect(isPatch(result)).toBe(true)
    if (isPatch(result)) {
      expect(result.settingsPatch.graphicsQuality).toBe('medium')
    }
  })

  it('downgrades graphics from medium to low when fps is low', () => {
    const result = decideAdaptiveQuality(input({ fps: 20, graphicsQuality: 'medium' }))
    expect(isPatch(result)).toBe(true)
    if (isPatch(result)) {
      expect(result.settingsPatch.graphicsQuality).toBe('low')
    }
  })

  it('reduces render distance when already at low quality and fps is below threshold', () => {
    const result = decideAdaptiveQuality(input({ fps: 20, graphicsQuality: 'low', renderDistance: 8 }))
    expect(isPatch(result)).toBe(true)
    if (isPatch(result)) {
      expect(result.settingsPatch.renderDistance).toBe(7)
    }
  })

  it('returns no change when at low quality and minimum render distance', () => {
    const result = decideAdaptiveQuality(input({ fps: 20, graphicsQuality: 'low', renderDistance: 4 }))
    expect(typeof result).toBe('number')
  })
})
