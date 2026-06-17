import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { resolvePreset } from '@ts-minecraft/game'

import { resolvePostProcessingSetupLayout } from './post-processing-layout'

describe('post-processing-layout', () => {
  it('clamps the render size and derives enabled pass layouts', () => {
    const layout = resolvePostProcessingSetupLayout({
      width: 0,
      height: 0,
      pixelRatio: 2,
      isWebGL2: true,
      resolvedGraphics: {
        ...resolvePreset('high'),
        bloomStrength: 0.42,
        godRaysEnabled: true,
        godRaysSamples: 13,
      },
    })

    expect(layout.renderSize).toEqual({ width: 1, height: 1 })
    expect(layout.shadowCastEnabled).toBe(true)
    expect(layout.gtao).toEqual({
      enabled: true,
      size: { width: 1, height: 1 },
    })
    expect(layout.bloom).toEqual({
      enabled: true,
      strength: 0.42,
      size: { width: 1, height: 1 },
    })
    expect(layout.dof).toEqual({
      enabled: false,
      size: { width: 1, height: 1 },
    })
    expect(layout.smaa).toEqual({
      enabled: true,
      size: { width: 1, height: 1 },
    })
    expect(layout.godRays).toEqual({
      enabled: true,
      samples: 13,
      size: { width: 1, height: 1 },
    })
  })

  it('uses half resolution for GTAO only when WebGL2 is available', () => {
    const layout = resolvePostProcessingSetupLayout({
      width: 320,
      height: 180,
      pixelRatio: 1.5,
      isWebGL2: false,
      resolvedGraphics: {
        ...resolvePreset('high'),
        ssaoEnabled: true,
      },
    })

    expect(layout.renderSize).toEqual({ width: 480, height: 270 })
    expect(layout.gtao).toEqual({
      enabled: false,
      size: { width: 1, height: 1 },
    })
  })

  it('keeps the configured shadow, bloom, and god rays settings', () => {
    const layout = resolvePostProcessingSetupLayout({
      width: 800,
      height: 600,
      pixelRatio: 1,
      isWebGL2: true,
      resolvedGraphics: {
        ...resolvePreset('low'),
        shadowsEnabled: false,
        bloomEnabled: false,
        bloomStrength: 0.17,
        godRaysEnabled: true,
        godRaysSamples: 37,
      },
    })

    expect(layout.shadowCastEnabled).toBe(false)
    expect(layout.bloom).toEqual({
      enabled: false,
      strength: 0.17,
      size: { width: 1, height: 1 },
    })
    expect(layout.godRays).toEqual({
      enabled: true,
      samples: 37,
      size: { width: 800, height: 600 },
    })
  })
})
