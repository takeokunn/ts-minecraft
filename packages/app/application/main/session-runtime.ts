import { Effect, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import type { WebGLRenderTarget } from 'three'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'

import { BiomeService } from '@ts-minecraft/world'
import { RecipeService } from '@ts-minecraft/inventory'
import { PlayerError } from '@ts-minecraft/entity'
import { StorageError } from '@ts-minecraft/world'
import { DebugOverlayService } from '@ts-minecraft/presentation'
import { DeathScreenService } from '@ts-minecraft/presentation'
import { type MoonPhasePort, type SkyMaterialPort, type Position } from '@ts-minecraft/core'

import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import { installQaApi } from '@ts-minecraft/app/main/qa-api'
import { wrapFrameHandlerWithBrowserEffects, type PendingResize } from '@ts-minecraft/app/main/browser-runtime'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import { assembleFrameHandlerDeps } from '@ts-minecraft/app/main/session-runtime-deps'

// Lighting values captured from buildLighting — forwarded to FrameHandlerDeps.lights.
export type SessionLightingSnapshot = {
  readonly light: THREE.DirectionalLight
  readonly ambientLight: THREE.AmbientLight
  readonly sky: THREE.Object3D
  readonly skyPort: SkyMaterialPort
  readonly moonPort: MoonPhasePort
  readonly skyNight: THREE.Color
  readonly skyDay: THREE.Color
  readonly skyCurrent: THREE.Color
}

// All values required by buildSessionRuntime to wire up the frame handlers,
// mount overlays, and wrap the handler with browser-event side effects.
// Separating into three logical groups (scene/GPU, services, extras) keeps
// the structure clear without requiring callers to pre-build FrameHandlerDeps.
export type SessionRuntimeParams = {
  // --- Scene / GPU resources ---
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly composerRT: WebGLRenderTarget
  readonly composer: EffectComposer
  readonly gtaoPass: FrameHandlerDeps['gtaoPass']
  readonly bloomPass: FrameHandlerDeps['bloomPass']
  readonly bokehPass: FrameHandlerDeps['dofPass']
  readonly godRaysPass: FrameHandlerDeps['godRaysPass']
  readonly smaaPass: FrameHandlerDeps['smaaPass']
  readonly lighting: SessionLightingSnapshot
  readonly fpsElement: HTMLElement | null
  readonly healthValueElement: HTMLElement | null
  readonly healthMaxElement: HTMLElement | null
  readonly hungerValueElement: HTMLElement | null
  readonly hungerMaxElement: HTMLElement | null
  readonly xpLevelElement: HTMLElement | null
  readonly xpBarElement: HTMLElement | null
  readonly xpBarMaxElement: HTMLElement | null
  readonly armorValueElement: HTMLElement | null
  readonly airElement: HTMLElement | null
  readonly breakProgressElement: HTMLElement | null
  // --- Session primitives ---
  readonly control: SessionControl
  readonly gamePausedRef: Ref.Ref<boolean>
  // Shared bed-aware respawn point (FR-4). Created once in session.ts (seeded from
  // the saved respawn or the world spawn) so the bed handler, physics-stage,
  // death-screen, and autosave all read/write the same live ref.
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
  readonly pendingResizeRef: MutableRef.MutableRef<Option.Option<PendingResize>>
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly persistSessionState: () => Effect.Effect<void, PlayerError | StorageError>
  // --- Overlay services (not in FrameHandlerServices) ---
  readonly deathScreen: DeathScreenService
  readonly debugOverlay: DebugOverlayService
  readonly biomeService: BiomeService
  readonly recipeService: RecipeService
}

// Builds frame handlers + mounts all per-session overlays (death screen, pause menu,
// debug overlay) then wraps the frame handler with browser-event side effects.
//
// Returns the wrapped frame handler (ready for GameLoopService.start) and the
// maintenance handler (ready for GameLoopService.startMaintenance).
export const buildSessionRuntime = (
  params: SessionRuntimeParams,
  services: FrameHandlerServices,
) =>
  Effect.gen(function* () {
    const {
      renderer,
      scene,
      camera,
      composerRT,
      composer,
      gtaoPass,
      bloomPass,
      bokehPass,
      godRaysPass,
      smaaPass,
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      persistSessionState,
      control,
      deathScreen,
      debugOverlay,
      biomeService,
      recipeService,
      respawnPositionRef,
    } = params

    const {
      gameState,
      playerCameraState,
      blockHighlight,
      inputService,
      blockService,
      hotbarService,
      furnaceService,
      inventoryService,
      inventoryRenderer,
      chunkManagerService,
      timeService,
      settingsService,
      debugFeatureFlags,
      pauseMenu,
      worldRendererService,
      entityManager,
      fpsCounter,
    } = services

    const frameHandlerDeps = assembleFrameHandlerDeps(params)
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(frameHandlerDeps, services)

    yield* installQaApi({
      camera,
      scene,
      playerCameraState,
      blockHighlight,
      inputService,
      inventoryService,
      inventoryRenderer,
      gameState,
      timeService,
      chunkManagerService,
      blockService,
      hotbarService,
      recipeService,
      furnaceService,
      worldRendererService,
      entityManager,
      debugFeatureFlags,
    })

    yield* deathScreen.attach(control, respawnPositionRef)

    // FR-1.4: mount the in-session pause menu. Listens for ESC via the
    // frame-handler input stage (which calls `pauseMenu.openIfClosed(control)`)
    // and drives Resume / Settings / Save & Quit. Listeners + DOM are torn
    // down with the surrounding session scope on quit-to-title.
    yield* pauseMenu.attach(control)

    // FR-1.5: mount the F3 debug overlay. Hidden by default; F3 toggles it.
    // The 4 Hz refresh daemon is forked into the session scope so it tears
    // down with quit-to-title.
    yield* debugOverlay.attach({
      biomeService,
      chunkManager: chunkManagerService,
      gameState,
      timeService,
      cameraState: playerCameraState,
      fpsCounter,
      debugFeatureFlags,
    })

    const frameHandlerWithBrowserEvents = wrapFrameHandlerWithBrowserEffects({
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      chunkManagerService,
      persistSessionState: persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
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
      frameHandler,
    })

    return { frameHandlerWithBrowserEvents, maintenanceHandler }
  })
