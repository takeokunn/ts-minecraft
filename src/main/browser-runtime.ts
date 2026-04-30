import { Effect, MutableRef, Option } from 'effect'
import type { DeltaTimeSecs } from '@/shared/kernel'
import { resolvePreset } from '@/application/settings/settings-service'
import type { SettingsService } from '@/application/settings/settings-service'
import type { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import type { WorldRendererService } from '@/infrastructure/three/world-renderer'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import type { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import type { GodRaysPass } from '@/infrastructure/three/god-rays-pass'
import type { WebGLRenderer, PerspectiveCamera, WebGLRenderTarget } from 'three'

export type PendingResize = { readonly width: number; readonly height: number }

type BrowserEventBridgeDeps = {
  readonly canvas: HTMLCanvasElement
  readonly inputPointerLock: Effect.Effect<void, never>
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
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
  pendingResizeRef,
  pendingSaveDirtyChunksRef,
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
    }
  }

  const handleBeforeUnload = () => {
    MutableRef.set(pendingSaveDirtyChunksRef, true)
  }

  const handleCanvasMouseDown = () => {
    Effect.runFork(inputPointerLock)
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

  return Effect.all([
    chunkManagerService.saveDirtyChunks(),
    persistSessionState,
  ], { concurrency: 'unbounded', discard: true }).pipe(
    Effect.catchAllCause(() => Effect.void),
  )
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

  return Option.match(pendingResize, {
    onNone: () => Effect.void,
    onSome: ({ width, height }) =>
      settingsService.getSettings().pipe(
        Effect.flatMap((settings) => {
          const pixelRatioCap = resolvePreset(settings.graphicsQuality).pixelRatioCap
          return Effect.sync(() => {
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
          }).pipe(
            Effect.andThen(worldRendererService.updateWaterResolution(width, height)),
            Effect.andThen(worldRendererService.resizeRefractionRT(width, height)),
            Effect.andThen(worldRendererService.resizeRefractionCamera(width / height)),
          )
        }),
      ),
  })
}

export const wrapFrameHandlerWithBrowserEffects = ({
  frameHandler,
  ...deps
}: BrowserFrameEffectDeps): ((deltaTime: DeltaTimeSecs) => Effect.Effect<void, never>) =>
  (deltaTime) =>
    flushPendingSaves(deps).pipe(
      Effect.andThen(applyPendingResize(deps)),
      Effect.andThen(frameHandler(deltaTime)),
    )
