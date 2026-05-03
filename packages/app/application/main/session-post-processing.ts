import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { GodRaysPass } from '@ts-minecraft/rendering'
import { resolvePreset } from '@ts-minecraft/game'
import {
  GTAO_BLEND_INTENSITY,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  BOKEH_FOCUS, BOKEH_APERTURE, BOKEH_MAXBLUR,
} from '@ts-minecraft/app/main.config'

export const buildPostProcessing = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  canvas: { clientWidth: number; clientHeight: number },
  initialGraphics: ReturnType<typeof resolvePreset>,
) => Effect.sync(() => {
  const rt = new THREE.WebGLRenderTarget(
    canvas.clientWidth,
    canvas.clientHeight,
    { type: THREE.HalfFloatType }
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

  const godRaysPassInstance = new GodRaysPass()
  godRaysPassInstance.enabled = initialGraphics.godRaysEnabled
  godRaysPassInstance.setSize(initialGraphics.godRaysEnabled ? canvas.clientWidth : 1, initialGraphics.godRaysEnabled ? canvas.clientHeight : 1)
  comp.addPass(godRaysPassInstance)
  const godRays: Option.Option<GodRaysPass> = Option.some(godRaysPassInstance)

  const bloomPassInstance = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  )
  bloomPassInstance.enabled = initialGraphics.bloomEnabled
  bloomPassInstance.strength = initialGraphics.bloomStrength
  bloomPassInstance.setSize(initialGraphics.bloomEnabled ? canvas.clientWidth : 1, initialGraphics.bloomEnabled ? canvas.clientHeight : 1)
  comp.addPass(bloomPassInstance)
  const bloom: Option.Option<UnrealBloomPass> = Option.some(bloomPassInstance)

  const bokehPassInstance = new BokehPass(scene, camera, {
    focus: BOKEH_FOCUS,
    aperture: BOKEH_APERTURE,
    maxblur: BOKEH_MAXBLUR,
  })
  bokehPassInstance.enabled = initialGraphics.dofEnabled
  bokehPassInstance.setSize(initialGraphics.dofEnabled ? canvas.clientWidth : 1, initialGraphics.dofEnabled ? canvas.clientHeight : 1)
  comp.addPass(bokehPassInstance)
  const bokeh: Option.Option<BokehPass> = Option.some(bokehPassInstance)

  const smaaPassInstance = new SMAAPass(canvas.clientWidth, canvas.clientHeight)
  smaaPassInstance.enabled = initialGraphics.smaaEnabled
  smaaPassInstance.setSize(initialGraphics.smaaEnabled ? canvas.clientWidth : 1, initialGraphics.smaaEnabled ? canvas.clientHeight : 1)
  comp.addPass(smaaPassInstance)
  const smaa: Option.Option<SMAAPass> = Option.some(smaaPassInstance)

  comp.addPass(new OutputPass())

  return { composerRT: rt, composer: comp, gtaoPass: gtao, godRaysPass: godRays, bloomPass: bloom, bokehPass: bokeh, smaaPass: smaa }
})
