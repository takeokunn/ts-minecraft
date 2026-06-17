import { Effect, MutableRef, Option } from 'effect'
import { resolvePreset } from '@ts-minecraft/game'
import type { SettingsService } from '@ts-minecraft/game'
import type { WorldRendererService, GodRaysPass } from '@ts-minecraft/rendering'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { WebGLRenderer, PerspectiveCamera, WebGLRenderTarget } from 'three'

import type { PendingResize } from './browser-runtime-event-handlers'
import { resolveBrowserRuntimeResizeLayout } from './browser-runtime-resize-layout'
import { applyBrowserRuntimeResizeRendering } from './browser-runtime-resize-effects-rendering'
import { applyBrowserRuntimeResizeWorld } from './browser-runtime-resize-effects-world'

export type BrowserResizeEffectDeps = {
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly settingsService: SettingsService
  readonly renderer: WebGLRenderer
  readonly camera: PerspectiveCamera
  readonly composer: EffectComposer
  readonly composerRT: WebGLRenderTarget
  readonly worldRendererService: WorldRendererService
  readonly gtaoPass: Option.Option<GTAOPass>
  readonly bloomPass: Option.Option<UnrealBloomPass>
  readonly bokehPass: Option.Option<BokehPass>
  readonly smaaPass: Option.Option<SMAAPass>
  readonly godRaysPass: Option.Option<GodRaysPass>
}

export const applyPendingResize = ({
  pendingResizeRef,
  settingsService,
  renderer,
  camera,
  composer,
  composerRT,
  worldRendererService,
  gtaoPass,
  bloomPass,
  bokehPass,
  smaaPass,
  godRaysPass,
}: BrowserResizeEffectDeps): Effect.Effect<void, never> => {
  const pendingResize = MutableRef.get(pendingResizeRef)
  MutableRef.set(pendingResizeRef, Option.none())

  const resizeVal = Option.getOrNull(pendingResize)
  if (resizeVal === null) return Effect.void
  const { width, height } = resizeVal
  return Effect.gen(function* () {
    const settings = yield* settingsService.getSettings()
    const pixelRatioCap = resolvePreset(settings.graphicsQuality).pixelRatioCap
    const layout = resolveBrowserRuntimeResizeLayout({
      width,
      height,
      devicePixelRatio: window.devicePixelRatio,
      pixelRatioCap,
      gtaoEnabled: Option.getOrNull(gtaoPass)?.enabled ?? false,
      bloomEnabled: Option.getOrNull(bloomPass)?.enabled ?? false,
      bokehEnabled: Option.getOrNull(bokehPass)?.enabled ?? false,
      smaaEnabled: Option.getOrNull(smaaPass)?.enabled ?? false,
      godRaysEnabled: Option.getOrNull(godRaysPass)?.enabled ?? false,
    })
    yield* applyBrowserRuntimeResizeRendering({
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
    })
    yield* applyBrowserRuntimeResizeWorld({
      layout,
      worldRendererService,
    })
  })
}
