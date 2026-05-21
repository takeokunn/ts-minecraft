import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Module mocks (hoisted by vitest before any imports) ────────────────────

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

vi.mock('three/addons/shaders/CopyShader.js', () => ({
  CopyShader: {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: '// copy-vert',
    fragmentShader: '// copy-frag',
  },
}))

vi.mock('three', () => ({
  ShaderMaterial: vi.fn().mockImplementation(
    (params: { uniforms?: Record<string, { value: unknown }> } = {}) => ({
      uniforms: params.uniforms ?? {},
      dispose: vi.fn(),
    }),
  ),
  WebGLRenderTarget: vi.fn().mockImplementation((_w: number, _h: number) => ({
    texture: {},
    setSize: vi.fn(),
    dispose: vi.fn(),
  })),
  Vector2: vi.fn().mockImplementation((x = 0, y = 0) => ({ x, y })),
  // Stubs needed by transient world-renderer-refraction.ts module-level allocations
  Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Array.from({ length: 16 }, () => 0) })),
  Vector4: vi.fn(() => ({ set: vi.fn(), applyMatrix4: vi.fn(), x: 0, y: 0, z: 0, w: 1 })),
  UniformsUtils: { clone: (u: Record<string, unknown>) => ({ ...u }) },
  UnsignedByteType: 1,
  LinearFilter: 1,
  AdditiveBlending: 2,
}))

import { GodRaysPass } from '@ts-minecraft/rendering'

// ─── Type helper for private field access ──────────────────────────────────

type GodRaysPrivate = {
  sunVisibleMaterial: { uniforms: Record<string, { value: unknown }>; dispose: ReturnType<typeof vi.fn> }
  sunHiddenMaterial: { uniforms: Record<string, { value: unknown }>; dispose: ReturnType<typeof vi.fn> }
  fsQuad: { material: unknown; render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }
  halfResRT: { texture: object; setSize: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }
  blendMaterial: { uniforms: Record<string, { value: unknown }>; dispose: ReturnType<typeof vi.fn> }
  blendQuad: { render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }
}

const priv = (pass: GodRaysPass): GodRaysPrivate => pass as unknown as GodRaysPrivate

type MockRenderer = { setRenderTarget: ReturnType<typeof vi.fn> }
const makeMockRenderer = (): MockRenderer => ({ setRenderTarget: vi.fn() })
const makeMockBuffer = (): { texture: object } => ({ texture: {} })

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GodRaysPass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('sets needsSwap to false', () => {
      const pass = new GodRaysPass()
      expect(pass.needsSwap).toBe(false)
    })

    it('initializes sunScreenPos at (0.5, 0.8)', () => {
      const pass = new GodRaysPass()
      expect(pass.sunScreenPos.x).toBe(0.5)
      expect(pass.sunScreenPos.y).toBe(0.8)
    })

    it('sets fsQuad material to sunVisibleMaterial by default', () => {
      const pass = new GodRaysPass()
      const p = priv(pass)
      expect(p.fsQuad.material).toBe(p.sunVisibleMaterial)
    })
  })

  describe('setNumSamples', () => {
    it('sets uNumSamples uniform value on sunVisibleMaterial', () => {
      const pass = new GodRaysPass()
      pass.setNumSamples(20)
      expect(priv(pass).sunVisibleMaterial.uniforms['uNumSamples']?.value).toBe(20)
    })

    it('clamps values above MAX_SAMPLES (40) to 40', () => {
      const pass = new GodRaysPass()
      pass.setNumSamples(100)
      expect(priv(pass).sunVisibleMaterial.uniforms['uNumSamples']?.value).toBe(40)
    })

    it('accepts values at exactly MAX_SAMPLES (40)', () => {
      const pass = new GodRaysPass()
      pass.setNumSamples(40)
      expect(priv(pass).sunVisibleMaterial.uniforms['uNumSamples']?.value).toBe(40)
    })
  })

  describe('setSunVisible', () => {
    it('switches fsQuad.material to sunHiddenMaterial when false', () => {
      const pass = new GodRaysPass()
      pass.setSunVisible(false)
      expect(priv(pass).fsQuad.material).toBe(priv(pass).sunHiddenMaterial)
    })

    it('switches fsQuad.material back to sunVisibleMaterial when true', () => {
      const pass = new GodRaysPass()
      pass.setSunVisible(false)
      pass.setSunVisible(true)
      expect(priv(pass).fsQuad.material).toBe(priv(pass).sunVisibleMaterial)
    })
  })

  describe('setSize', () => {
    it('calls halfResRT.setSize with half the given dimensions', () => {
      const pass = new GodRaysPass()
      pass.setSize(800, 600)
      expect(priv(pass).halfResRT.setSize).toHaveBeenCalledWith(400, 300)
    })

    it('rounds up (Math.ceil) for odd dimensions', () => {
      const pass = new GodRaysPass()
      pass.setSize(801, 601)
      expect(priv(pass).halfResRT.setSize).toHaveBeenCalledWith(401, 301)
    })
  })

  describe('dispose', () => {
    it('disposes all internal resources', () => {
      const pass = new GodRaysPass()
      const p = priv(pass)
      pass.dispose()
      expect(p.sunVisibleMaterial.dispose).toHaveBeenCalled()
      expect(p.sunHiddenMaterial.dispose).toHaveBeenCalled()
      expect(p.fsQuad.dispose).toHaveBeenCalled()
      expect(p.halfResRT.dispose).toHaveBeenCalled()
      expect(p.blendMaterial.dispose).toHaveBeenCalled()
      expect(p.blendQuad.dispose).toHaveBeenCalled()
    })
  })

  describe('render', () => {
    it('assigns readBuffer.texture to sunVisibleMaterial tDiffuse uniform', () => {
      const pass = new GodRaysPass()
      const readBuffer = makeMockBuffer()
      const renderer = makeMockRenderer()

      pass.render(renderer as never, {} as never, readBuffer as never)

      expect(priv(pass).sunVisibleMaterial.uniforms['tDiffuse']?.value).toBe(readBuffer.texture)
    })

    it('renders the radial blur into halfResRT then blends onto readBuffer', () => {
      const pass = new GodRaysPass()
      const p = priv(pass)
      const renderer = makeMockRenderer()
      const readBuffer = makeMockBuffer()

      pass.render(renderer as never, {} as never, readBuffer as never)

      // Step 1: render into halfResRT
      expect(renderer.setRenderTarget).toHaveBeenCalledWith(p.halfResRT)
      expect(p.fsQuad.render).toHaveBeenCalledWith(renderer)
      // Step 2: blend onto readBuffer
      expect(p.blendMaterial.uniforms['tDiffuse']?.value).toBe(p.halfResRT.texture)
      expect(renderer.setRenderTarget).toHaveBeenCalledWith(readBuffer)
      expect(p.blendQuad.render).toHaveBeenCalledWith(renderer)
    })

    it('renders to null target when renderToScreen=true', () => {
      const pass = new GodRaysPass()
      pass.renderToScreen = true
      const renderer = makeMockRenderer()

      pass.render(renderer as never, {} as never, makeMockBuffer() as never)

      expect(renderer.setRenderTarget).toHaveBeenCalledWith(null)
    })
  })
})
