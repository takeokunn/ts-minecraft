/**
 * GodRaysPass — screen-space radial blur to simulate crepuscular light shafts.
 *
 * Algorithm: radial blur from a sun screen-position UV toward the edges.
 * Implemented as a custom Three.js postprocessing Pass using ShaderPass.
 *
 * FR-002: The blit step uses AdditiveBlending to composite the god-rays texture
 * directly onto readBuffer (like UnrealBloomPass), eliminating one full-screen
 * texture read (~4MB/frame at 1080p). needsSwap=false since we write to readBuffer.
 */
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { CopyShader } from 'three/addons/shaders/CopyShader.js'
const GOD_RAYS_VERT = /* glsl */`
  precision mediump float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// MAX_SAMPLES is a compile-time constant for GLSL loop unrolling.
// The actual iteration count is controlled by uNumSamples uniform —
// `break` exits early, avoiding wasted texture fetches on lower quality presets.
const MAX_SAMPLES = 40

const GOD_RAYS_FRAG = /* glsl */`
  precision mediump float;
  #define MAX_SAMPLES ${MAX_SAMPLES}

  uniform sampler2D tDiffuse;
  uniform vec2 sunScreenPos;
  uniform float exposure;
  uniform float decay;
  uniform float density;
  uniform float weight;
  uniform int uNumSamples;

  varying vec2 vUv;

  void main() {
    #ifdef SUN_VISIBLE
    vec2 texCoord = vUv;
    vec2 deltaTexCoord = (texCoord - sunScreenPos) * (1.0 / float(uNumSamples)) * density;

    float illuminationDecay = 1.0;
    vec4 color = vec4(0.0);

    for (int i = 0; i < MAX_SAMPLES; i++) {
      if (i >= uNumSamples) break;
      texCoord -= deltaTexCoord;
      if (texCoord.x < 0.0 || texCoord.x > 1.0 || texCoord.y < 0.0 || texCoord.y > 1.0) continue;
      vec4 s = texture2D(tDiffuse, texCoord);
      s *= illuminationDecay * weight;
      color += s;
      illuminationDecay *= decay;
    }

    color *= exposure;
    gl_FragColor = color;
    #else
    gl_FragColor = vec4(0.0);
    #endif
  }
`

export class GodRaysPass extends Pass {
  private readonly sunVisibleMaterial: THREE.ShaderMaterial
  private readonly sunHiddenMaterial: THREE.ShaderMaterial
  private readonly fsQuad: FullScreenQuad
  private readonly halfResRT: THREE.WebGLRenderTarget
  private readonly blendMaterial: THREE.ShaderMaterial
  private readonly blendQuad: FullScreenQuad

  /** Sun position in screen UV space [0,1] — update each frame before render. */
  readonly sunScreenPos: THREE.Vector2

  constructor() {
    super()

    this.sunScreenPos = new THREE.Vector2(0.5, 0.8)

    const sharedUniforms = {
      tDiffuse: { value: null },
      sunScreenPos: { value: this.sunScreenPos },
      exposure: { value: 0.05 },
      decay: { value: 0.94 },
      density: { value: 0.9 },
      weight: { value: 0.75 },
      uNumSamples: { value: MAX_SAMPLES },
    }

    this.sunVisibleMaterial = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: GOD_RAYS_VERT,
      fragmentShader: '#define SUN_VISIBLE\n' + GOD_RAYS_FRAG,
    })

    this.sunHiddenMaterial = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: GOD_RAYS_VERT,
      fragmentShader: GOD_RAYS_FRAG,
    })

    this.fsQuad = new FullScreenQuad(this.sunVisibleMaterial)

    this.halfResRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    })

    // FR-002: Additive blend material — draws god-rays texture onto readBuffer
    // using GPU AdditiveBlending, eliminating the second full-screen texture read
    // that the old shader-based blit required (tDiffuse + tGodRays → output).
    this.blendMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    this.blendQuad = new FullScreenQuad(this.blendMaterial)

    // Write to readBuffer (like UnrealBloomPass) — no swap needed
    this.needsSwap = false
  }

  /** Update the effective sample count at runtime (clamped to MAX_SAMPLES). */
  setNumSamples(n: number): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.sunVisibleMaterial.uniforms['uNumSamples']!.value = Math.min(n, MAX_SAMPLES)
  }

  /** Swap the fsQuad material between the full radial-blur and the transparent-black variant. */
  setSunVisible(visible: boolean): void {
    this.fsQuad.material = visible ? this.sunVisibleMaterial : this.sunHiddenMaterial
  }

  override setSize(width: number, height: number): void {
    this.halfResRT.setSize(Math.ceil(width / 2), Math.ceil(height / 2))
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    // Step 1: Radial blur from readBuffer into half-resolution RT
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.sunVisibleMaterial.uniforms['tDiffuse']!.value = readBuffer.texture

    renderer.setRenderTarget(this.halfResRT)
    this.fsQuad.render(renderer)

    // Step 2: Additive-blend god-rays onto readBuffer (or screen).
    // AdditiveBlending on the material means the GPU composites:
    //   dest = dest + src  (i.e. scene + godRays)
    // This avoids reading readBuffer in the shader — one fewer full-screen texture fetch.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.blendMaterial.uniforms['tDiffuse']!.value = this.halfResRT.texture

    if (this.renderToScreen) {
      renderer.setRenderTarget(null)
    } else {
      renderer.setRenderTarget(readBuffer)
    }

    this.blendQuad.render(renderer)
  }

  override dispose(): void {
    this.sunVisibleMaterial.dispose()
    this.sunHiddenMaterial.dispose()
    this.fsQuad.dispose()
    this.halfResRT.dispose()
    this.blendMaterial.dispose()
    this.blendQuad.dispose()
  }
}
