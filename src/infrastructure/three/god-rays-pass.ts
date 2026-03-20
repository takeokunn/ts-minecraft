/**
 * GodRaysPass — screen-space radial blur to simulate crepuscular light shafts.
 *
 * Algorithm: radial blur from a sun screen-position UV toward the edges.
 * Implemented as a custom Three.js postprocessing Pass using ShaderPass.
 */
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const GOD_RAYS_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// NUM_SAMPLES is a compile-time constant to allow full loop unrolling by the GLSL compiler.
// Using a uniform int would prevent unrolling and cause dynamic branching on some GPU drivers.
const NUM_SAMPLES = 60

const GOD_RAYS_FRAG = /* glsl */`
  #define NUM_SAMPLES ${NUM_SAMPLES}

  uniform sampler2D tDiffuse;
  uniform vec2 sunScreenPos;
  uniform float exposure;
  uniform float decay;
  uniform float density;
  uniform float weight;

  varying vec2 vUv;

  void main() {
    vec2 texCoord = vUv;
    vec2 deltaTexCoord = (texCoord - sunScreenPos) * (1.0 / float(NUM_SAMPLES)) * density;

    float illuminationDecay = 1.0;
    vec4 color = vec4(0.0);

    for (int i = 0; i < NUM_SAMPLES; i++) {
      texCoord -= deltaTexCoord;
      vec4 s = texture2D(tDiffuse, texCoord);
      s *= illuminationDecay * weight;
      color += s;
      illuminationDecay *= decay;
    }

    color *= exposure;
    gl_FragColor = texture2D(tDiffuse, vUv) + color;
  }
`

export class GodRaysPass extends Pass {
  private readonly material: THREE.ShaderMaterial
  private readonly fsQuad: FullScreenQuad

  /** Sun position in screen UV space [0,1] — update each frame before render. */
  readonly sunScreenPos: THREE.Vector2

  constructor() {
    super()

    this.sunScreenPos = new THREE.Vector2(0.5, 0.8)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        sunScreenPos: { value: this.sunScreenPos },
        exposure: { value: 0.3 },
        decay: { value: 0.96 },
        density: { value: 0.84 },
        weight: { value: 0.5 },
      },
      vertexShader: GOD_RAYS_VERT,
      fragmentShader: GOD_RAYS_FRAG,
    })

    this.fsQuad = new FullScreenQuad(this.material)
  }

  override setSize(_width: number, _height: number): void {
    // No resolution-dependent uniforms currently — override present for EffectComposer resize support
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
