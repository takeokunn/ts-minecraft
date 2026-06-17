import { Effect } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { flushPendingSaves } from './browser-runtime-save-effects'
import { applyPendingResize } from './browser-runtime-resize-effects'

export type BrowserFrameEffectDeps = {
  readonly pendingSaveDirtyChunksRef: import('effect').MutableRef.MutableRef<boolean>
  readonly pendingResizeRef: import('effect').MutableRef.MutableRef<import('effect').Option.Option<import('./browser-runtime-event-handlers').PendingResize>>
  readonly chunkManagerService: import('@ts-minecraft/world').ChunkManagerService
  readonly persistSessionState: Effect.Effect<void, never>
  readonly settingsService: import('@ts-minecraft/game').SettingsService
  readonly renderer: import('three').WebGLRenderer
  readonly camera: import('three').PerspectiveCamera
  readonly composer: import('three/addons/postprocessing/EffectComposer.js').EffectComposer
  readonly composerRT: import('three').WebGLRenderTarget
  readonly worldRendererService: import('@ts-minecraft/rendering').WorldRendererService
  readonly gtaoPass: import('effect').Option.Option<import('three/addons/postprocessing/GTAOPass.js').GTAOPass>
  readonly bloomPass: import('effect').Option.Option<import('three/addons/postprocessing/UnrealBloomPass.js').UnrealBloomPass>
  readonly bokehPass: import('effect').Option.Option<import('three/addons/postprocessing/BokehPass.js').BokehPass>
  readonly smaaPass: import('effect').Option.Option<import('three/addons/postprocessing/SMAAPass.js').SMAAPass>
  readonly godRaysPass: import('effect').Option.Option<import('@ts-minecraft/rendering').GodRaysPass>
  readonly frameHandler: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>
}

export const wrapFrameHandlerWithBrowserEffects = ({
  frameHandler,
  ...deps
}: BrowserFrameEffectDeps): ((deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>) => {
  // Pre-compose the pipe shape, but wrap each step in Effect.suspend so
  // MutableRef reads (pending save flag, pending resize) execute per-frame
  // instead of being eagerly evaluated at wrapper construction time.
  const saveAndResize = Effect.flatMap(
    Effect.suspend(() => flushPendingSaves(deps)),
    () => Effect.suspend(() => applyPendingResize(deps)),
  )

  return (deltaTime) =>
    Effect.flatMap(saveAndResize, () => frameHandler(deltaTime))
}
