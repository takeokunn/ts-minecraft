import { describe, it, expect } from 'vitest'
import { GRAPHICS_PRESETS, resolvePreset } from '../application/settings-service.config'
import type { GraphicsQuality } from '../application/settings.schema'

// Quality tiers in ascending visual-fidelity order. The presets are designed as a
// monotonic lattice: climbing this chain may only ADD effects and RAISE resolution,
// never regress. These tests pin that contract so a future preset edit that, e.g.,
// disables shadows at "ultra" fails loudly instead of silently shipping.
const ASCENDING: ReadonlyArray<GraphicsQuality> = ['low', 'medium', 'high', 'ultra']

const HALF_FLOAT = 1016 // THREE.HalfFloatType — required for HDR (>1.0) effect output
const UNSIGNED_BYTE = 1009 // THREE.UnsignedByteType — 8-bit, no HDR headroom

const BOOLEAN_EFFECTS = [
  'shadowsEnabled', 'ssaoEnabled', 'bloomEnabled', 'smaaEnabled',
  'skyEnabled', 'dofEnabled', 'godRaysEnabled', 'useCompositePass',
] as const

const consecutivePairs = ASCENDING.slice(1).map((q, i) => [ASCENDING[i]!, q] as const)

describe('GRAPHICS_PRESETS monotonic quality progression', () => {
  for (const effect of BOOLEAN_EFFECTS) {
    it(`${effect} never regresses as quality increases`, () => {
      for (const [lower, higher] of consecutivePairs) {
        const lo = GRAPHICS_PRESETS[lower][effect]
        const hi = GRAPHICS_PRESETS[higher][effect]
        // once enabled, stays enabled: lo === true ⟹ hi === true
        expect(lo === true ? hi === true : true).toBe(true)
      }
    })
  }

  it('pixelRatioCap strictly increases with quality', () => {
    for (const [lower, higher] of consecutivePairs) {
      expect(GRAPHICS_PRESETS[lower].pixelRatioCap).toBeLessThan(GRAPHICS_PRESETS[higher].pixelRatioCap)
    }
  })

  it('godRaysSamples is non-decreasing with quality', () => {
    for (const [lower, higher] of consecutivePairs) {
      expect(GRAPHICS_PRESETS[lower].godRaysSamples).toBeLessThanOrEqual(GRAPHICS_PRESETS[higher].godRaysSamples)
    }
  })

  it('bloomStrength is non-decreasing with quality', () => {
    for (const [lower, higher] of consecutivePairs) {
      expect(GRAPHICS_PRESETS[lower].bloomStrength).toBeLessThanOrEqual(GRAPHICS_PRESETS[higher].bloomStrength)
    }
  })

  // NOTE: refractionThrottleFrames is intentionally NOT monotonic — low=0 is a
  // sentinel (refraction disabled entirely), so its throttle value is moot. low and
  // medium both run NO refraction pre-pass (throttle 0 — the full second scene render
  // is a high/ultra-only luxury). Among the tiers that actually run refraction the
  // pre-pass runs more often as quality rises: high(2) ≥ ultra(1).
  it('refraction pre-pass is disabled on low + medium and frequency increases high→ultra', () => {
    expect(GRAPHICS_PRESETS.low.refractionThrottleFrames).toBe(0)
    expect(GRAPHICS_PRESETS.medium.refractionThrottleFrames).toBe(0)
    expect(GRAPHICS_PRESETS.high.refractionThrottleFrames).toBeGreaterThanOrEqual(
      GRAPHICS_PRESETS.ultra.refractionThrottleFrames,
    )
    expect(GRAPHICS_PRESETS.ultra.refractionThrottleFrames).toBeGreaterThan(0)
  })
})

describe('GRAPHICS_PRESETS HDR coupling invariants', () => {
  for (const quality of ASCENDING) {
    const preset = GRAPHICS_PRESETS[quality]

    it(`${quality}: useCompositePass ⟺ HalfFloat render target`, () => {
      // CompositePass merges HDR passes; it MUST run against a HalfFloat target so
      // bloom/god-ray values >1.0 are not clipped by an 8-bit unorm target.
      expect(preset.useCompositePass).toBe(preset.composerRtType === HALF_FLOAT)
    })

    it(`${quality}: any HDR effect (bloom/godRays) implies HalfFloat target`, () => {
      if (preset.bloomEnabled || preset.godRaysEnabled) {
        expect(preset.composerRtType).toBe(HALF_FLOAT)
      }
    })

    it(`${quality}: composerRtType is one of the two known THREE constants`, () => {
      expect([UNSIGNED_BYTE, HALF_FLOAT]).toContain(preset.composerRtType)
    })

    it(`${quality}: dof and god rays are reserved for the top tier only`, () => {
      // By design only "ultra" turns these on; assert the rest leave them off.
      if (quality !== 'ultra') {
        expect(preset.dofEnabled).toBe(false)
        expect(preset.godRaysEnabled).toBe(false)
      }
    })
  }
})

describe('resolvePreset', () => {
  for (const quality of ASCENDING) {
    it(`returns the GRAPHICS_PRESETS entry for ${quality}`, () => {
      expect(resolvePreset(quality)).toBe(GRAPHICS_PRESETS[quality])
    })
  }
})
