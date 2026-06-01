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
// three. The individual passes (UnrealBloomPass, GodRaysPass, BokehPass) remain
// available for presets that do not use the composite shader; when the composite
// shader is active, their `enabled` flag is forced to false.
//
// Preset wiring (resolved by resolveCompositeFlags + preset booleans):
//   low    → CompositePass disabled (no effects), individual passes disabled
//   medium → CompositePass disabled, individual passes disabled
//   high   → CompositePass enabled with { bloom:true }; individual bloom disabled
//   ultra  → CompositePass enabled with { bloom, godRays, bokeh }; individual passes disabled
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

  // GodRaysPass: used when CompositePass is disabled. When CompositePass is active, this pass is
  // force-disabled because its godRays uniform contribution is in the composite shader.
  const godRaysPassInstance = new GodRaysPass()
  const godRaysPassEnabled = initialGraphics.godRaysEnabled && !compositeActive
  godRaysPassInstance.enabled = godRaysPassEnabled
  godRaysPassInstance.setSize(godRaysPassEnabled ? canvas.clientWidth : 1, godRaysPassEnabled ? canvas.clientHeight : 1)
  comp.addPass(godRaysPassInstance)
  const godRays: Option.Option<GodRaysPass> = Option.some(godRaysPassInstance)

  // UnrealBloomPass: same composite toggle semantics as GodRaysPass above.
  const bloomPassInstance = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  )
  const bloomPassEnabled = initialGraphics.bloomEnabled && !compositeActive
  bloomPassInstance.enabled = bloomPassEnabled
  bloomPassInstance.strength = initialGraphics.bloomStrength
  bloomPassInstance.setSize(bloomPassEnabled ? canvas.clientWidth : 1, bloomPassEnabled ? canvas.clientHeight : 1)
  comp.addPass(bloomPassInstance)
  const bloom: Option.Option<UnrealBloomPass> = Option.some(bloomPassInstance)

  // BokehPass: same composite toggle semantics.
  const bokehPassInstance = new BokehPass(scene, camera, {
    focus: BOKEH_FOCUS,
    aperture: BOKEH_APERTURE,
    maxblur: BOKEH_MAXBLUR,
  })
  const bokehPassEnabled = initialGraphics.dofEnabled && !compositeActive
  bokehPassInstance.enabled = bokehPassEnabled
  bokehPassInstance.setSize(bokehPassEnabled ? canvas.clientWidth : 1, bokehPassEnabled ? canvas.clientHeight : 1)
  comp.addPass(bokehPassInstance)
  const bokeh: Option.Option<BokehPass> = Option.some(bokehPassInstance)

  // CompositePass (new): single fragment shader for bloom + godRays + bokeh.
  // Inserted AFTER the individual passes (which are no-ops when active) and
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
