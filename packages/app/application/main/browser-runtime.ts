import { Effect, MutableRef, Option, Ref } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { resolvePreset } from '@ts-minecraft/game'
import type { FrameHandler, GameLoopService } from '@ts-minecraft/game'
import { performAutoSaveTick } from '@ts-minecraft/app/main/session-autosave'
import type { SettingsService } from '@ts-minecraft/game'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { WorldRendererService, GodRaysPass } from '@ts-minecraft/rendering'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { WebGLRenderer, PerspectiveCamera, WebGLRenderTarget } from 'three'

export type PendingResize = { readonly width: number; readonly height: number }

type BrowserEventBridgeDeps = {
  readonly canvas: HTMLCanvasElement
  readonly inputPointerLock: Effect.Effect<void, never>
  // Pause state: while a menu is open we must NOT re-acquire pointer lock on a
  // canvas click, or pressing ESC would free the cursor only for the next click
  // to immediately re-capture it (focus feels stuck).
  readonly gamePausedRef: Ref.Ref<boolean>
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly gameLoopService?: GameLoopService
  readonly frameHandler?: FrameHandler
}

type BrowserFrameEffectDeps = {
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly chunkManagerService: ChunkManagerService
  readonly persistSessionState: Effect.Effect<void, never>
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
  readonly frameHandler: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>
}

export const installBrowserEventBridge = ({
  canvas,
  inputPointerLock,
  gamePausedRef,
  pendingResizeRef,
  pendingSaveDirtyChunksRef,
  gameLoopService,
  frameHandler,
}: BrowserEventBridgeDeps) => {
  const handleResize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    MutableRef.set(pendingResizeRef, Option.some({ width, height }))
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      MutableRef.set(pendingSaveDirtyChunksRef, true)
      if (gameLoopService) Effect.runFork(gameLoopService.pause())
    } else if (gameLoopService && frameHandler) {
      Effect.runFork(gameLoopService.resume(frameHandler))
    }
  }

  const handleBeforeUnload = () => {
    MutableRef.set(pendingSaveDirtyChunksRef, true)
  }

  const handleCanvasMouseDown = () => {
    // Only (re)acquire pointer lock during active gameplay. When a menu is open
    // (gamePausedRef=true), a click on the canvas/overlay must NOT re-lock —
    // otherwise ESC frees the cursor but the next click re-captures it, making it
    // feel like focus never releases (user report: "ESCでフォーカスがはずれない").
    if (!Effect.runSync(Ref.get(gamePausedRef))) {
      Effect.runFork(inputPointerLock)
    }
  }

  return Effect.acquireRelease(
    Effect.sync(() => {
      window.addEventListener('resize', handleResize)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)
      canvas.addEventListener('mousedown', handleCanvasMouseDown)
    }),
    () => Effect.sync(() => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      canvas.removeEventListener('mousedown', handleCanvasMouseDown)
    }),
  )
}

const flushPendingSaves = ({
  pendingSaveDirtyChunksRef,
  chunkManagerService,
  persistSessionState,
}: Pick<BrowserFrameEffectDeps, 'pendingSaveDirtyChunksRef' | 'chunkManagerService' | 'persistSessionState'>): Effect.Effect<void, never> => {
  const pendingSaveDirtyChunks = MutableRef.get(pendingSaveDirtyChunksRef)
  MutableRef.set(pendingSaveDirtyChunksRef, false)
  if (!pendingSaveDirtyChunks) return Effect.void

  // Shares the autosave-daemon tick: persist chunks + session together, swallowing
  // (and now LOGGING) any failure. Previously this path silently dropped errors;
  // routing through performAutoSaveTick surfaces a failed pending-flush — exactly
  // the save you'd want visible (e.g. on tab-blur) — and keeps a single source for
  // the Effect.all + catchAllCause shape.
  return performAutoSaveTick(chunkManagerService.saveDirtyChunks(), persistSessionState)
}

const applyPendingResize = ({
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
}: Omit<BrowserFrameEffectDeps, 'pendingSaveDirtyChunksRef' | 'chunkManagerService' | 'persistSessionState' | 'frameHandler'>): Effect.Effect<void, never> => {
  const pendingResize = MutableRef.get(pendingResizeRef)
  MutableRef.set(pendingResizeRef, Option.none())

  const resizeVal = Option.getOrNull(pendingResize)
  if (resizeVal === null) return Effect.void
  const { width, height } = resizeVal
  return Effect.gen(function* () {
    const settings = yield* settingsService.getSettings()
    const pixelRatioCap = resolvePreset(settings.graphicsQuality).pixelRatioCap
    yield* Effect.sync(() => {
      const dpr = Math.min(window.devicePixelRatio, pixelRatioCap)
      renderer.setPixelRatio(dpr)
      composer.setPixelRatio(dpr)
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      composerRT.setSize(width, height)
      composer.setSize(width, height)
      const rw = Math.max(1, Math.ceil(width * dpr))
      const rh = Math.max(1, Math.ceil(height * dpr))
      const gtaoOrNull = Option.getOrNull(gtaoPass)
      const bloomOrNull = Option.getOrNull(bloomPass)
      const bokehOrNull = Option.getOrNull(bokehPass)
      const smaaOrNull = Option.getOrNull(smaaPass)
      const godRaysOrNull = Option.getOrNull(godRaysPass)
      if (gtaoOrNull) gtaoOrNull.setSize(gtaoOrNull.enabled ? Math.ceil(rw / 2) : 1, gtaoOrNull.enabled ? Math.ceil(rh / 2) : 1)
      if (bloomOrNull) bloomOrNull.setSize(bloomOrNull.enabled ? rw : 1, bloomOrNull.enabled ? rh : 1)
      if (bokehOrNull) bokehOrNull.setSize(bokehOrNull.enabled ? rw : 1, bokehOrNull.enabled ? rh : 1)
      if (smaaOrNull) smaaOrNull.setSize(smaaOrNull.enabled ? rw : 1, smaaOrNull.enabled ? rh : 1)
      if (godRaysOrNull) godRaysOrNull.setSize(godRaysOrNull.enabled ? rw : 1, godRaysOrNull.enabled ? rh : 1)
    })
    yield* worldRendererService.updateWaterResolution(width, height)
    yield* worldRendererService.resizeRefractionRT(width, height)
    yield* worldRendererService.resizeRefractionCamera(width / height)
  })
}

export const wrapFrameHandlerWithBrowserEffects = ({
  frameHandler,
  ...deps
}: BrowserFrameEffectDeps): ((deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>) => {
  // Pre-compose flushPendingSaves + applyPendingResize into a single Effect
  // to avoid a per-frame Effect.gen generator closure allocation.
  const saveAndResize = Effect.flatMap(flushPendingSaves(deps), () => applyPendingResize(deps))
  
  return (deltaTime) =>
    Effect.flatMap(saveAndResize, () => frameHandler(deltaTime))
}
