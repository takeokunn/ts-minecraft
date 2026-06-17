import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { resolveBrowserRuntimeResizeLayout } from './browser-runtime-resize-layout'

describe('browser-runtime-resize-layout', () => {
  it('caps the pixel ratio and derives scaled pass sizes', () => {
    const layout = resolveBrowserRuntimeResizeLayout({
      width: 320,
      height: 180,
      devicePixelRatio: 2,
      pixelRatioCap: 1.5,
      gtaoEnabled: true,
      bloomEnabled: true,
      bokehEnabled: true,
      smaaEnabled: true,
      godRaysEnabled: true,
    })

    expect(layout.pixelRatio).toBe(1.5)
    expect(layout.displaySize).toEqual({ width: 320, height: 180 })
    expect(layout.scaledSize).toEqual({ width: 480, height: 270 })
    expect(layout.cameraAspect).toBeCloseTo(320 / 180)
    expect(layout.passSizes.gtao).toEqual({ width: 240, height: 135 })
    expect(layout.passSizes.bloom).toEqual({ width: 480, height: 270 })
    expect(layout.passSizes.bokeh).toEqual({ width: 480, height: 270 })
    expect(layout.passSizes.smaa).toEqual({ width: 480, height: 270 })
    expect(layout.passSizes.godRays).toEqual({ width: 480, height: 270 })
  })

  it('falls back to 1x1 for disabled passes', () => {
    const layout = resolveBrowserRuntimeResizeLayout({
      width: 1,
      height: 1,
      devicePixelRatio: 0.5,
      pixelRatioCap: 0.25,
      gtaoEnabled: false,
      bloomEnabled: false,
      bokehEnabled: false,
      smaaEnabled: false,
      godRaysEnabled: false,
    })

    expect(layout.pixelRatio).toBe(0.25)
    expect(layout.scaledSize).toEqual({ width: 1, height: 1 })
    expect(layout.passSizes.gtao).toEqual({ width: 1, height: 1 })
    expect(layout.passSizes.bloom).toEqual({ width: 1, height: 1 })
    expect(layout.passSizes.bokeh).toEqual({ width: 1, height: 1 })
    expect(layout.passSizes.smaa).toEqual({ width: 1, height: 1 })
    expect(layout.passSizes.godRays).toEqual({ width: 1, height: 1 })
  })
})
