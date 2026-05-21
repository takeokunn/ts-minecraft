import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { GodRaysPass, CompositePass, resolveCompositeFlags, compositeFlagsAnyEnabled } from '@ts-minecraft/rendering'
import { resolvePreset } from '@ts-minecraft/game'
import {
  GTAO_BLEND_INTENSITY,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  BOKEH_FOCUS, BOKEH_APERTURE, BOKEH_MAXBLUR,
} from '@ts-minecraft/app/main.config'

// FR-4.3: When `useCompositePass` is true, Bloom + GodRays + Bokeh are merged
// into a single CompositePass that runs ONE full-screen read/write instead of
// three. The legacy passes (UnrealBloomPass, GodRaysPass, BokehPass) are still
// instantiated and added to the composer for backward compatibility (resize
// handling, frame-handler hooks), but their `enabled` flag is forced to false.
//
// Preset wiring (resolved by resolveCompositeFlags + preset booleans):
//   low    → CompositePass disabled (no effects), legacy passes disabled
//   medium → CompositePass disabled, legacy passes disabled
//   high   → CompositePass enabled with { bloom:true }; legacy bloom disabled
//   ultra  → CompositePass enabled with { bloom, godRays, bokeh }; legacy all disabled
//
// SSIM > 0.95 requirement: shader includes equivalent #ifdef blocks per effect;
// disabled effects produce zero instructions (no overdraw).

export const buildPostProcessing = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  canvas: { clientWidth: number; clientHeight: number },
  initialGraphics: ReturnType<typeof resolvePreset>,
  options: { readonly useCompositePass?: boolean } = {},
) => Effect.sync(() => {
  const useCompositePass = options.useCompositePass ?? false
  const compositeFlags = resolveCompositeFlags(initialGraphics)
  const compositeActive = useCompositePass && compositeFlagsAnyEnabled(compositeFlags)

  const rt = new THREE.WebGLRenderTarget(
    canvas.clientWidth,
    canvas.clientHeight,
    { type: initialGraphics.composerRtType }
  )
  const comp = new EffectComposer(renderer, rt)
  comp.addPass(new RenderPass(scene, camera))

  const gtaoPassInstance = new GTAOPass(scene, camera, canvas.clientWidth, canvas.clientHeight)
  gtaoPassInstance.blendIntensity = GTAO_BLEND_INTENSITY
  gtaoPassInstance.enabled = initialGraphics.ssaoEnabled
  gtaoPassInstance.setSize(
    initialGraphics.ssaoEnabled ? Math.ceil(canvas.clientWidth / 2) : 1,
    initialGraphics.ssaoEnabled ? Math.ceil(canvas.clientHeight / 2) : 1,
  )
  comp.addPass(gtaoPassInstance)
  const gtao: Option.Option<GTAOPass> = Option.some(gtaoPassInstance)

  // GodRaysPass (legacy): kept for backward compatibility / fallback when
  // CompositePass is disabled. When CompositePass is active, this pass is
  // force-disabled because its godRays uniform contribution is in the composite shader.
  const godRaysPassInstance = new GodRaysPass()
  const godRaysLegacyEnabled = initialGraphics.godRaysEnabled && !compositeActive
  godRaysPassInstance.enabled = godRaysLegacyEnabled
  godRaysPassInstance.setSize(godRaysLegacyEnabled ? canvas.clientWidth : 1, godRaysLegacyEnabled ? canvas.clientHeight : 1)
  comp.addPass(godRaysPassInstance)
  const godRays: Option.Option<GodRaysPass> = Option.some(godRaysPassInstance)

  // UnrealBloomPass (legacy): same migration semantics as GodRaysPass above.
  const bloomPassInstance = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  )
  const bloomLegacyEnabled = initialGraphics.bloomEnabled && !compositeActive
  bloomPassInstance.enabled = bloomLegacyEnabled
  bloomPassInstance.strength = initialGraphics.bloomStrength
  bloomPassInstance.setSize(bloomLegacyEnabled ? canvas.clientWidth : 1, bloomLegacyEnabled ? canvas.clientHeight : 1)
  comp.addPass(bloomPassInstance)
  const bloom: Option.Option<UnrealBloomPass> = Option.some(bloomPassInstance)

  // BokehPass (legacy): same migration semantics.
  const bokehPassInstance = new BokehPass(scene, camera, {
    focus: BOKEH_FOCUS,
    aperture: BOKEH_APERTURE,
    maxblur: BOKEH_MAXBLUR,
  })
  const bokehLegacyEnabled = initialGraphics.dofEnabled && !compositeActive
  bokehPassInstance.enabled = bokehLegacyEnabled
  bokehPassInstance.setSize(bokehLegacyEnabled ? canvas.clientWidth : 1, bokehLegacyEnabled ? canvas.clientHeight : 1)
  comp.addPass(bokehPassInstance)
  const bokeh: Option.Option<BokehPass> = Option.some(bokehPassInstance)

  // CompositePass (new): single fragment shader for bloom + godRays + bokeh.
  // Inserted AFTER the legacy passes (which are now no-ops when active) and
  // BEFORE SMAA so anti-aliasing operates on the final composited image.
  const composite: Option.Option<CompositePass> = compositeActive
    ? Option.some((() => {
        const cp = new CompositePass(canvas.clientWidth, canvas.clientHeight, compositeFlags, {
          bloomIntensity: initialGraphics.bloomStrength,
          bokehFocus: BOKEH_FOCUS,
          bokehAperture: BOKEH_APERTURE,
          bokehMaxBlur: BOKEH_MAXBLUR,
        })
        cp.enabled = true
        comp.addPass(cp)
        return cp
      })())
    : Option.none()

  const smaaPassInstance = new SMAAPass(canvas.clientWidth, canvas.clientHeight)
  smaaPassInstance.enabled = initialGraphics.smaaEnabled
  smaaPassInstance.setSize(initialGraphics.smaaEnabled ? canvas.clientWidth : 1, initialGraphics.smaaEnabled ? canvas.clientHeight : 1)
  comp.addPass(smaaPassInstance)
  const smaa: Option.Option<SMAAPass> = Option.some(smaaPassInstance)

  comp.addPass(new OutputPass())

  return {
    composerRT: rt,
    composer: comp,
    gtaoPass: gtao,
    godRaysPass: godRays,
    bloomPass: bloom,
    bokehPass: bokeh,
    smaaPass: smaa,
    compositePass: composite,
  }
})
