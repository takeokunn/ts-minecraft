import { Array as Arr, Effect } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { resolvePreset, type GraphicsQuality } from '@ts-minecraft/game'

// ---------------------------------------------------------------------------
// FR-1.6: buildPostProcessing chooses the EffectComposer intermediate RT
// pixel type from the resolved graphics preset (low/medium → UnsignedByteType,
// high/ultra → HalfFloatType). Three's runtime constants are pinned in the
// preset config (1009 / 1016) so this test verifies they round-trip into
// THREE.WebGLRenderTarget's `type` option.
// ---------------------------------------------------------------------------

// THREE constants used by buildPostProcessing — match the real runtime values.
const HalfFloatType = 1016
const UnsignedByteType = 1009

// Capture every WebGLRenderTarget(type) on a globalThis-attached array. The
// vi.mock factory is hoisted above all module-level state, so we can't close
// over a regular `const` here — we read/write through globalThis instead.
type CaptureBag = Array<{ type: number }>
declare const globalThis: { __capturedRtOptions__?: CaptureBag; __smaaConstructCount__?: number } & typeof global
globalThis.__capturedRtOptions__ = []
globalThis.__smaaConstructCount__ = 0
const captured = (): CaptureBag => globalThis.__capturedRtOptions__ ?? []
const smaaConstructCount = (): number => globalThis.__smaaConstructCount__ ?? 0

vi.mock('three', () => {
  // Hardcoded inline because vi.mock is hoisted above all top-level vars.
  // Must match real THREE.HalfFloatType (1016) / UnsignedByteType (1009).
  class WebGLRenderTarget {
    readonly width: number
    readonly height: number
    readonly options: { type: number }
    constructor(width: number, height: number, options: { type: number } = { type: 1016 }) {
      this.width = width
      this.height = height
      this.options = options
      const g = globalThis as { __capturedRtOptions__?: CaptureBag }
      ;(g.__capturedRtOptions__ ??= []).push(options)
    }
    setSize = vi.fn()
    dispose = vi.fn()
  }
  class Vector2 {
    constructor(public x = 0, public y = 0) {}
  }
  return { WebGLRenderTarget, Vector2, HalfFloatType: 1016, UnsignedByteType: 1009 }
})

vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
  EffectComposer: vi.fn().mockImplementation(() => ({
    addPass: vi.fn(),
    setSize: vi.fn(),
    dispose: vi.fn(),
  })),
}))

// Each `vi.mock` is hoisted; factories cannot reference outer locals, so
// every pass stub is inlined as its own factory to keep them self-contained.
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({
  RenderPass: vi.fn().mockImplementation(() => ({
    enabled: true, strength: 0, setSize: vi.fn(), dispose: vi.fn(),
  })),
}))
vi.mock('three/addons/postprocessing/GTAOPass.js', () => ({
  GTAOPass: vi.fn().mockImplementation(() => ({
    enabled: false, blendIntensity: 0, setSize: vi.fn(), dispose: vi.fn(),
  })),
}))
vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: vi.fn().mockImplementation(() => ({
    enabled: true, strength: 0, setSize: vi.fn(), dispose: vi.fn(),
  })),
}))
vi.mock('three/addons/postprocessing/BokehPass.js', () => ({
  BokehPass: vi.fn().mockImplementation(() => ({
    enabled: true, strength: 0, setSize: vi.fn(), dispose: vi.fn(),
  })),
}))
vi.mock('three/addons/postprocessing/SMAAPass.js', () => ({
  SMAAPass: vi.fn().mockImplementation(() => {
    const g = globalThis as { __smaaConstructCount__?: number }
    g.__smaaConstructCount__ = (g.__smaaConstructCount__ ?? 0) + 1
    return { enabled: true, strength: 0, setSize: vi.fn(), dispose: vi.fn() }
  }),
}))
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({
  OutputPass: vi.fn().mockImplementation(() => ({
    enabled: true, strength: 0, setSize: vi.fn(), dispose: vi.fn(),
  })),
}))
vi.mock('@ts-minecraft/rendering', () => ({
  GodRaysPass: vi.fn().mockImplementation(() => ({
    enabled: false, setSize: vi.fn(), dispose: vi.fn(),
  })),
  // FR-4.3: CompositePass + flag helpers — fed the resolved preset booleans.
  CompositePass: vi.fn().mockImplementation(() => ({
    enabled: false, setSize: vi.fn(), dispose: vi.fn(),
  })),
  resolveCompositeFlags: (preset: { bloomEnabled: boolean; godRaysEnabled: boolean; dofEnabled: boolean }) => ({
    bloom: preset.bloomEnabled, godRays: preset.godRaysEnabled, bokeh: preset.dofEnabled,
  }),
  compositeFlagsAnyEnabled: (f: { bloom: boolean; godRays: boolean; bokeh: boolean }) =>
    f.bloom || f.godRays || f.bokeh,
}))

import { buildPostProcessing } from '@ts-minecraft/app/main/session-post-processing'

const stubScene = {} as never
const stubCamera = {} as never
const stubRenderer = {} as never
const canvas = { clientWidth: 800, clientHeight: 600 }

describe('FR-1.6 — buildPostProcessing composer RT type', () => {
  it('low preset selects UnsignedByteType (8-bit unorm)', async () => {
    captured().length = 0
    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('low')))
    expect(captured()).toHaveLength(1)
    expect(captured()[0]!.type).toBe(UnsignedByteType)
  })

  it('medium preset selects UnsignedByteType (8-bit unorm)', async () => {
    captured().length = 0
    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('medium')))
    expect(captured()).toHaveLength(1)
    expect(captured()[0]!.type).toBe(UnsignedByteType)
  })

  it('high preset selects HalfFloatType (16-bit float)', async () => {
    captured().length = 0
    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('high')))
    expect(captured()).toHaveLength(1)
    expect(captured()[0]!.type).toBe(HalfFloatType)
  })

  it('ultra preset selects HalfFloatType (16-bit float)', async () => {
    captured().length = 0
    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('ultra')))
    expect(captured()).toHaveLength(1)
    expect(captured()[0]!.type).toBe(HalfFloatType)
  })

  it('every preset maps to either HalfFloatType or UnsignedByteType', () => {
    Arr.forEach(['low', 'medium', 'high', 'ultra'] as const satisfies ReadonlyArray<GraphicsQuality>, (quality) => {
      const t = resolvePreset(quality).composerRtType
      expect([UnsignedByteType, HalfFloatType]).toContain(t)
    })
  })
})

describe('buildPostProcessing SMAA allocation', () => {
  it('skips SMAAPass construction for presets with SMAA disabled', async () => {
    globalThis.__smaaConstructCount__ = 0

    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('low')))
    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('medium')))

    expect(smaaConstructCount()).toBe(0)
  })

  it('constructs SMAAPass only for presets with SMAA enabled', async () => {
    globalThis.__smaaConstructCount__ = 0

    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('high')))
    await Effect.runPromise(buildPostProcessing(stubRenderer, stubScene, stubCamera, canvas, resolvePreset('ultra')))

    expect(smaaConstructCount()).toBe(2)
  })
})
