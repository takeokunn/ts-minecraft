import { Effect, Option } from 'effect'
import type { GodRaysPass } from '@ts-minecraft/rendering'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { WebGLRenderer, PerspectiveCamera, WebGLRenderTarget } from 'three'

import type { BrowserRuntimeResizeLayout } from './browser-runtime-resize-layout'

export type BrowserRuntimeResizeRenderingDeps = {
  readonly layout: BrowserRuntimeResizeLayout
  readonly renderer: WebGLRenderer
  readonly camera: PerspectiveCamera
  readonly composer: EffectComposer
  readonly composerRT: WebGLRenderTarget
  readonly gtaoPass: Option.Option<GTAOPass>
  readonly bloomPass: Option.Option<UnrealBloomPass>
  readonly bokehPass: Option.Option<BokehPass>
  readonly smaaPass: Option.Option<SMAAPass>
  readonly godRaysPass: Option.Option<GodRaysPass>
}

export const applyBrowserRuntimeResizeRendering = ({
  layout,
  renderer,
  camera,
  composer,
  composerRT,
  gtaoPass,
  bloomPass,
  bokehPass,
  smaaPass,
  godRaysPass,
}: BrowserRuntimeResizeRenderingDeps): Effect.Effect<void, never> => Effect.sync(() => {
  renderer.setPixelRatio(layout.pixelRatio)
  composer.setPixelRatio(layout.pixelRatio)
  renderer.setSize(layout.displaySize.width, layout.displaySize.height)
  camera.aspect = layout.cameraAspect
  camera.updateProjectionMatrix()
  composerRT.setSize(layout.displaySize.width, layout.displaySize.height)
  composer.setSize(layout.displaySize.width, layout.displaySize.height)
  const gtaoOrNull = Option.getOrNull(gtaoPass)
  const bloomOrNull = Option.getOrNull(bloomPass)
  const bokehOrNull = Option.getOrNull(bokehPass)
  const smaaOrNull = Option.getOrNull(smaaPass)
  const godRaysOrNull = Option.getOrNull(godRaysPass)
  if (gtaoOrNull) gtaoOrNull.setSize(layout.passSizes.gtao.width, layout.passSizes.gtao.height)
  if (bloomOrNull) bloomOrNull.setSize(layout.passSizes.bloom.width, layout.passSizes.bloom.height)
  if (bokehOrNull) bokehOrNull.setSize(layout.passSizes.bokeh.width, layout.passSizes.bokeh.height)
  if (smaaOrNull) smaaOrNull.setSize(layout.passSizes.smaa.width, layout.passSizes.smaa.height)
  if (godRaysOrNull) godRaysOrNull.setSize(layout.passSizes.godRays.width, layout.passSizes.godRays.height)
})
