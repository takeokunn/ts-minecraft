import { beforeEach, describe, expect, it, vi } from 'vitest'

// FR-4.3: CompositePass merges Bloom + GodRays + Bokeh into a single
// fragment shader pass with #ifdef-gated effect blocks. Tests verify:
//   - flags drive shader defines and uniform set
//   - texture / parameter setters wire through to uniforms
//   - render() writes to writeBuffer (or screen) using readBuffer.texture
//   - resolveCompositeFlags maps preset booleans to flag struct
//   - compositeFlagsAnyEnabled detects "skip pass" condition

vi.mock('three/addons/postprocessing/Pass.js', () => {
  class Pass {
    needsSwap = true
    enabled = true
    renderToScreen = false
  }
  const FullScreenQuad = vi.fn().mockImplementation((mat: unknown) => ({
    material: mat,
    render: vi.fn(),
    dispose: vi.fn(),
  }))
  return { Pass, FullScreenQuad }
})

vi.mock('three', () => ({
  ShaderMaterial: vi.fn().mockImplementation(
    (params: {
      defines?: Record<string, string>
      uniforms?: Record<string, { value: unknown }>
      vertexShader?: string
      fragmentShader?: string
    } = {}) => ({
      defines: params.defines ?? {},
      uniforms: params.uniforms ?? {},
      vertexShader: params.vertexShader ?? '',
      fragmentShader: params.fragmentShader ?? '',
      dispose: vi.fn(),
    }),
  ),
  Vector2: vi.fn().mockImplementation((x = 0, y = 0) => ({ x, y })),
}))

// Import via relative path — avoids the package-barrel re-export chain that
// pulls in world-renderer.ts and its module-load-time THREE allocations
// (which would force this mock to stub Matrix4/Vector4/etc.). The test only
// needs CompositePass and its two helpers from this single source file.
import {
  CompositePass,
  compositeFlagsAnyEnabled,
  resolveCompositeFlags,
} from '../infrastructure/post-processing/composite-pass'

type CompositePrivate = {
  material: {
    defines: Record<string, string>
    uniforms: Record<string, { value: unknown }>
    dispose: ReturnType<typeof vi.fn>
  }
  fsQuad: { material: unknown; render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }
}
const priv = (p: CompositePass): CompositePrivate => p as unknown as CompositePrivate

type MockRenderer = { setRenderTarget: ReturnType<typeof vi.fn> }
const makeMockRenderer = (): MockRenderer => ({ setRenderTarget: vi.fn() })
const makeMockBuffer = (): { texture: object } => ({ texture: {} })

describe('CompositePass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor + defines', () => {
    it('all flags off → no effect defines', () => {
      const pass = new CompositePass(800, 600, { bloom: false, godRays: false, bokeh: false })
      const defines = priv(pass).material.defines
      expect(defines['BLOOM_ENABLED']).toBeUndefined()
      expect(defines['GODRAYS_ENABLED']).toBeUndefined()
      expect(defines['BOKEH_ENABLED']).toBeUndefined()
    })

    it('all flags on → all effect defines present', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: true, bokeh: true })
      const defines = priv(pass).material.defines
      expect(defines).toHaveProperty('BLOOM_ENABLED')
      expect(defines).toHaveProperty('GODRAYS_ENABLED')
      expect(defines).toHaveProperty('BOKEH_ENABLED')
    })

    it('bloom-only flag → only BLOOM_ENABLED + bloom uniforms', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      const u = priv(pass).material.uniforms
      expect(u).toHaveProperty('tBloomBlurred')
      expect(u).toHaveProperty('uBloomIntensity')
      expect(u).not.toHaveProperty('tGodRaysSrc')
      expect(u).not.toHaveProperty('tDepth')
    })

    it('always provides tDiffuse + uResolution uniforms', () => {
      const pass = new CompositePass(800, 600, { bloom: false, godRays: false, bokeh: false })
      const u = priv(pass).material.uniforms
      expect(u).toHaveProperty('tDiffuse')
      expect(u).toHaveProperty('uResolution')
    })

    it('needsSwap=true (final output drives composer ping-pong)', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      expect(pass.needsSwap).toBe(true)
    })
  })

  describe('texture setters', () => {
    it('setBloomTexture writes uniform when bloom enabled', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      const tex = { id: 'bloom-tex' } as never
      pass.setBloomTexture(tex)
      expect(priv(pass).material.uniforms['tBloomBlurred']?.value).toBe(tex)
    })

    it('setBloomTexture is a no-op when bloom disabled', () => {
      const pass = new CompositePass(800, 600, { bloom: false, godRays: true, bokeh: true })
      pass.setBloomTexture({} as never)
      expect(priv(pass).material.uniforms['tBloomBlurred']).toBeUndefined()
    })

    it('setGodRaysTexture and setDepthTexture write uniforms when enabled', () => {
      const pass = new CompositePass(800, 600, { bloom: false, godRays: true, bokeh: true })
      const grTex = { id: 'gr' } as never
      const depthTex = { id: 'depth' } as never
      pass.setGodRaysTexture(grTex)
      pass.setDepthTexture(depthTex)
      expect(priv(pass).material.uniforms['tGodRaysSrc']?.value).toBe(grTex)
      expect(priv(pass).material.uniforms['tDepth']?.value).toBe(depthTex)
    })
  })

  describe('parameter setters', () => {
    it('setBloomIntensity updates uniform', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      pass.setBloomIntensity(0.42)
      expect(priv(pass).material.uniforms['uBloomIntensity']?.value).toBe(0.42)
    })

    it('setGodRaysIntensity updates uniform', () => {
      const pass = new CompositePass(800, 600, { bloom: false, godRays: true, bokeh: false })
      pass.setGodRaysIntensity(0.7)
      expect(priv(pass).material.uniforms['uGodRaysIntensity']?.value).toBe(0.7)
    })

    it('setBokehParams updates focus, aperture, maxBlur uniforms', () => {
      const pass = new CompositePass(800, 600, { bloom: false, godRays: false, bokeh: true })
      pass.setBokehParams(15.0, 0.005, 0.03)
      const u = priv(pass).material.uniforms
      expect(u['uBokehFocus']?.value).toBe(15.0)
      expect(u['uBokehAperture']?.value).toBe(0.005)
      expect(u['uBokehMaxBlur']?.value).toBe(0.03)
    })
  })

  describe('setSize', () => {
    it('updates resolution Vector2 in place', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      pass.setSize(1920, 1080)
      expect(pass.resolution.x).toBe(1920)
      expect(pass.resolution.y).toBe(1080)
    })
  })

  describe('render', () => {
    it('writes readBuffer.texture into tDiffuse and renders into writeBuffer', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: true, bokeh: true })
      const renderer = makeMockRenderer()
      const readBuffer = makeMockBuffer()
      const writeBuffer = makeMockBuffer()

      pass.render(renderer as never, writeBuffer as never, readBuffer as never)

      expect(priv(pass).material.uniforms['tDiffuse']?.value).toBe(readBuffer.texture)
      expect(renderer.setRenderTarget).toHaveBeenCalledWith(writeBuffer)
      expect(priv(pass).fsQuad.render).toHaveBeenCalledWith(renderer)
    })

    it('renders to null target when renderToScreen=true', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      pass.renderToScreen = true
      const renderer = makeMockRenderer()
      pass.render(renderer as never, makeMockBuffer() as never, makeMockBuffer() as never)
      expect(renderer.setRenderTarget).toHaveBeenCalledWith(null)
    })
  })

  describe('dispose', () => {
    it('disposes material and fsQuad', () => {
      const pass = new CompositePass(800, 600, { bloom: true, godRays: false, bokeh: false })
      const p = priv(pass)
      pass.dispose()
      expect(p.material.dispose).toHaveBeenCalled()
      expect(p.fsQuad.dispose).toHaveBeenCalled()
    })
  })

  describe('resolveCompositeFlags', () => {
    it('low/medium-style preset (all off) → all flags false', () => {
      const flags = resolveCompositeFlags({ bloomEnabled: false, godRaysEnabled: false, dofEnabled: false })
      expect(flags).toEqual({ bloom: false, godRays: false, bokeh: false })
    })

    it('high-style preset (bloom only) → bloom flag only', () => {
      const flags = resolveCompositeFlags({ bloomEnabled: true, godRaysEnabled: false, dofEnabled: false })
      expect(flags).toEqual({ bloom: true, godRays: false, bokeh: false })
    })

    it('ultra-style preset (all on) → all three flags', () => {
      const flags = resolveCompositeFlags({ bloomEnabled: true, godRaysEnabled: true, dofEnabled: true })
      expect(flags).toEqual({ bloom: true, godRays: true, bokeh: true })
    })
  })

  describe('compositeFlagsAnyEnabled', () => {
    it('returns false when all flags are off', () => {
      expect(compositeFlagsAnyEnabled({ bloom: false, godRays: false, bokeh: false })).toBe(false)
    })

    it('returns true when any flag is on', () => {
      expect(compositeFlagsAnyEnabled({ bloom: true, godRays: false, bokeh: false })).toBe(true)
      expect(compositeFlagsAnyEnabled({ bloom: false, godRays: true, bokeh: false })).toBe(true)
      expect(compositeFlagsAnyEnabled({ bloom: false, godRays: false, bokeh: true })).toBe(true)
    })
  })
})
