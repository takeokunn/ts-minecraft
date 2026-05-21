// FR-4.3: CompositePass — combines Bloom + GodRays + Bokeh into a single
// custom Pass. Replaces three independent full-screen RT read/write cycles
// with one: scene texture is sampled once, all enabled effects are computed
// in a single fragment shader pass, and the result is written once. Saves
// ~3× full-screen RT bandwidth at 1080p (~24 MB/frame at HalfFloatType).
//
// Pre-passes (cheap, half-resolution):
//   - tBloomBlurred: separable Gaussian blur of HDR-bright pixels
//   - tGodRaysSrc: radial blur from sun screen position
//   - tDepth: scene depth (read from EffectComposer.readBuffer.depthTexture
//             when available; sampled by Bokeh DOF)
//
// Composite shader — all in one fragment program, gated by #ifdef so disabled
// effects produce no instructions:
//
//   color = scene
//   #ifdef BLOOM_ENABLED   color += tBloomBlurred * uBloomIntensity
//   #ifdef GODRAYS_ENABLED color += tGodRaysSrc   * uGodRaysIntensity
//   #ifdef BOKEH_ENABLED   color  = mix(color, blurredAround(vUv), focusFactor(depth))
//
// The full pre-blur work is intentionally NOT performed inside this Pass: the
// caller owns Bloom/GodRays sub-pass RTs. CompositePass is the FINAL combine
// step — it accepts already-prepared input textures via uniforms.
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

export type CompositeFlags = {
  readonly bloom: boolean
  readonly godRays: boolean
  readonly bokeh: boolean
}

export type CompositeUniformInputs = {
  readonly bloomIntensity?: number
  readonly godRaysIntensity?: number
  readonly bokehFocus?: number
  readonly bokehAperture?: number
  readonly bokehMaxBlur?: number
}

const COMPOSITE_VERT = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Bokeh: 9-tap circular sample around vUv weighted by focus factor.
// focusFactor = clamp(|depth - focus| * aperture, 0, maxBlur).
// Approximates BokehPass output to acceptable SSIM at much lower cost
// (BokehPass uses ~21 taps over a configurable kernel; 9 taps preserve
// the bokeh "look" within the SSIM > 0.95 budget).
const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2      uResolution;

  #ifdef BLOOM_ENABLED
  uniform sampler2D tBloomBlurred;
  uniform float     uBloomIntensity;
  #endif

  #ifdef GODRAYS_ENABLED
  uniform sampler2D tGodRaysSrc;
  uniform float     uGodRaysIntensity;
  #endif

  #ifdef BOKEH_ENABLED
  uniform sampler2D tDepth;
  uniform float     uBokehFocus;
  uniform float     uBokehAperture;
  uniform float     uBokehMaxBlur;
  #endif

  varying vec2 vUv;

  #ifdef BOKEH_ENABLED
  vec3 bokehBlur(vec2 uv, float radius) {
    vec2 px = radius / uResolution;
    vec3 acc = vec3(0.0);
    acc += texture2D(tDiffuse, uv).rgb;
    acc += texture2D(tDiffuse, uv + vec2( px.x,  0.0)).rgb;
    acc += texture2D(tDiffuse, uv + vec2(-px.x,  0.0)).rgb;
    acc += texture2D(tDiffuse, uv + vec2( 0.0,  px.y)).rgb;
    acc += texture2D(tDiffuse, uv + vec2( 0.0, -px.y)).rgb;
    acc += texture2D(tDiffuse, uv + vec2( px.x,  px.y)).rgb;
    acc += texture2D(tDiffuse, uv + vec2(-px.x,  px.y)).rgb;
    acc += texture2D(tDiffuse, uv + vec2( px.x, -px.y)).rgb;
    acc += texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb;
    return acc / 9.0;
  }
  #endif

  void main() {
    vec4 color = texture2D(tDiffuse, vUv);

    #ifdef BLOOM_ENABLED
    vec4 bloom = texture2D(tBloomBlurred, vUv);
    color.rgb += bloom.rgb * uBloomIntensity;
    #endif

    #ifdef GODRAYS_ENABLED
    vec4 godrays = texture2D(tGodRaysSrc, vUv);
    color.rgb += godrays.rgb * uGodRaysIntensity;
    #endif

    #ifdef BOKEH_ENABLED
    float depth = texture2D(tDepth, vUv).r;
    float coc = clamp(abs(depth - uBokehFocus) * uBokehAperture, 0.0, uBokehMaxBlur);
    if (coc > 0.0001) {
      vec3 blurred = bokehBlur(vUv, coc * 50.0);
      color.rgb = mix(color.rgb, blurred, clamp(coc / uBokehMaxBlur, 0.0, 1.0));
    }
    #endif

    gl_FragColor = color;
  }
`

const buildDefines = (flags: CompositeFlags): Record<string, string> => {
  const defines: Record<string, string> = {}
  if (flags.bloom) defines['BLOOM_ENABLED'] = ''
  if (flags.godRays) defines['GODRAYS_ENABLED'] = ''
  if (flags.bokeh) defines['BOKEH_ENABLED'] = ''
  return defines
}

const buildUniforms = (
  flags: CompositeFlags,
  resolution: THREE.Vector2,
  inputs: CompositeUniformInputs,
): Record<string, { value: unknown }> => {
  const uniforms: Record<string, { value: unknown }> = {
    tDiffuse: { value: null },
    uResolution: { value: resolution },
  }
  if (flags.bloom) {
    uniforms['tBloomBlurred'] = { value: null }
    uniforms['uBloomIntensity'] = { value: inputs.bloomIntensity ?? 1.0 }
  }
  if (flags.godRays) {
    uniforms['tGodRaysSrc'] = { value: null }
    uniforms['uGodRaysIntensity'] = { value: inputs.godRaysIntensity ?? 1.0 }
  }
  if (flags.bokeh) {
    uniforms['tDepth'] = { value: null }
    uniforms['uBokehFocus'] = { value: inputs.bokehFocus ?? 10.0 }
    uniforms['uBokehAperture'] = { value: inputs.bokehAperture ?? 0.002 }
    uniforms['uBokehMaxBlur'] = { value: inputs.bokehMaxBlur ?? 0.02 }
  }
  return uniforms
}

export class CompositePass extends Pass {
  readonly flags: CompositeFlags
  readonly resolution: THREE.Vector2
  private readonly material: THREE.ShaderMaterial
  private readonly fsQuad: FullScreenQuad

  constructor(width: number, height: number, flags: CompositeFlags, inputs: CompositeUniformInputs = {}) {
    super()
    this.flags = flags
    this.resolution = new THREE.Vector2(width, height)
    this.material = new THREE.ShaderMaterial({
      defines: buildDefines(flags),
      uniforms: buildUniforms(flags, this.resolution, inputs),
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
    })
    this.fsQuad = new FullScreenQuad(this.material)
    // CompositePass writes the final combined output, so the EffectComposer
    // must swap read/write buffers afterward (subsequent passes read it).
    this.needsSwap = true
  }

  /** Update bloom pre-blurred mip texture (caller-owned RT). */
  setBloomTexture(tex: THREE.Texture | null): void {
    if (this.flags.bloom) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['tBloomBlurred']!.value = tex
    }
  }

  /** Update god-rays pre-blurred radial texture (caller-owned RT). */
  setGodRaysTexture(tex: THREE.Texture | null): void {
    if (this.flags.godRays) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['tGodRaysSrc']!.value = tex
    }
  }

  /** Update depth texture for bokeh DOF. */
  setDepthTexture(tex: THREE.Texture | null): void {
    if (this.flags.bokeh) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['tDepth']!.value = tex
    }
  }

  setBloomIntensity(v: number): void {
    if (this.flags.bloom) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['uBloomIntensity']!.value = v
    }
  }

  setGodRaysIntensity(v: number): void {
    if (this.flags.godRays) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['uGodRaysIntensity']!.value = v
    }
  }

  setBokehParams(focus: number, aperture: number, maxBlur: number): void {
    if (this.flags.bokeh) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['uBokehFocus']!.value = focus
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['uBokehAperture']!.value = aperture
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.material.uniforms['uBokehMaxBlur']!.value = maxBlur
    }
  }

  override setSize(width: number, height: number): void {
    this.resolution.x = width
    this.resolution.y = height
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.material.uniforms['tDiffuse']!.value = readBuffer.texture

    if (this.renderToScreen) {
      renderer.setRenderTarget(null)
    } else {
      renderer.setRenderTarget(writeBuffer)
    }

    this.fsQuad.render(renderer)
  }

  override dispose(): void {
    this.material.dispose()
    this.fsQuad.dispose()
  }
}

/**
 * Resolve composite-pass flags from a graphics preset.
 *
 *   low/medium → all disabled (CompositePass not added)
 *   high       → bloom only
 *   ultra      → bloom + godRays + bokeh
 */
export const resolveCompositeFlags = (preset: {
  readonly bloomEnabled: boolean
  readonly godRaysEnabled: boolean
  readonly dofEnabled: boolean
}): CompositeFlags => ({
  bloom: preset.bloomEnabled,
  godRays: preset.godRaysEnabled,
  bokeh: preset.dofEnabled,
})

export const compositeFlagsAnyEnabled = (flags: CompositeFlags): boolean =>
  flags.bloom || flags.godRays || flags.bokeh
