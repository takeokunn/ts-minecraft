import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'

const mocks = vi.hoisted(() => ({
  createFrameHandlers: vi.fn(),
  installSessionRuntimeOverlays: vi.fn(),
  wrapFrameHandlerWithBrowserEffects: vi.fn(),
  assembleFrameHandlerDeps: vi.fn(),
}))

vi.mock('@ts-minecraft/app/frame-handler', () => ({
  createFrameHandlers: mocks.createFrameHandlers,
}))

vi.mock('@ts-minecraft/app/main/session-runtime-overlays', () => ({
  installSessionRuntimeOverlays: mocks.installSessionRuntimeOverlays,
}))

vi.mock('@ts-minecraft/app/main/browser-runtime-effects', () => ({
  wrapFrameHandlerWithBrowserEffects: mocks.wrapFrameHandlerWithBrowserEffects,
}))

vi.mock('@ts-minecraft/app/main/session-runtime-deps/frame-handler', () => ({
  assembleFrameHandlerDeps: mocks.assembleFrameHandlerDeps,
}))

import { buildSessionRuntime } from '@ts-minecraft/app/main/session-runtime'

describe('buildSessionRuntime', () => {
  it('builds the runtime from assembled deps and mounts all session overlays', async () => {
    const frameHandler = vi.fn(() => Effect.void)
    const maintenanceHandler = vi.fn(() => Effect.void)
    const wrappedFrameHandler = vi.fn(() => Effect.void)
    const assembledDeps = { tag: 'assembled-deps' }
    const chunkManagerService = { tag: 'chunk-manager-service' } as never
    const settingsService = { tag: 'settings-service' } as never
    const worldRendererService = { tag: 'world-renderer-service' } as never
    const pendingResizeRef = MutableRef.make(Option.none())
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    const persistSessionState = vi.fn(() => Effect.succeed(undefined))
    const params = {
      rendering: {
        renderer: { tag: 'renderer' } as never,
        scene: { tag: 'scene' } as never,
        camera: { tag: 'camera' } as never,
        composerRT: { tag: 'composer-rt' } as never,
        composer: { tag: 'composer' } as never,
        gtaoPass: Option.none(),
        bloomPass: Option.none(),
        bokehPass: Option.none(),
        godRaysPass: Option.none(),
        smaaPass: Option.none(),
        lighting: { tag: 'lighting' } as never,
      },
      hud: {
        fpsElement: { tag: 'fps' } as never,
        healthValueElement: { tag: 'health-value' } as never,
        healthMaxElement: { tag: 'health-max' } as never,
        hungerValueElement: { tag: 'hunger-value' } as never,
        hungerMaxElement: { tag: 'hunger-max' } as never,
        xpLevelElement: { tag: 'xp-level' } as never,
        xpBarElement: { tag: 'xp-bar' } as never,
        xpBarMaxElement: { tag: 'xp-bar-max' } as never,
        armorValueElement: { tag: 'armor-value' } as never,
        airElement: { tag: 'air' } as never,
        breakProgressElement: { tag: 'break-progress' } as never,
      },
      state: {
        pendingResizeRef,
        pendingSaveDirtyChunksRef,
        persistSessionState,
        gamePausedRef: { tag: 'game-paused' } as never,
      },
      overlays: { deathScreen: { tag: 'death-screen' } as never, debugOverlay: { tag: 'debug-overlay' } as never, biomeService: { tag: 'biome-service' } as never, recipeService: { tag: 'recipe-service' } as never },
    }
    const services = {
      chunkManagerService,
      settingsService,
      worldRendererService,
      gameState: { tag: 'game-state' } as never,
      playerCameraState: { tag: 'player-camera-state' } as never,
      blockHighlight: { tag: 'block-highlight' } as never,
      inputService: { tag: 'input-service' } as never,
      blockService: { tag: 'block-service' } as never,
      hotbarService: { tag: 'hotbar-service' } as never,
      furnaceService: { tag: 'furnace-service' } as never,
      inventoryService: { tag: 'inventory-service' } as never,
      inventoryRenderer: { tag: 'inventory-renderer' } as never,
      timeService: { tag: 'time-service' } as never,
      debugFeatureFlags: { tag: 'debug-feature-flags' } as never,
      pauseMenu: { tag: 'pause-menu' } as never,
      entityManager: { tag: 'entity-manager' } as never,
      fpsCounter: { tag: 'fps-counter' } as never,
    }

    mocks.assembleFrameHandlerDeps.mockReturnValue(assembledDeps)
    mocks.createFrameHandlers.mockReturnValue(Effect.succeed({ frameHandler, maintenanceHandler }))
    mocks.installSessionRuntimeOverlays.mockReturnValue(Effect.void)
    mocks.wrapFrameHandlerWithBrowserEffects.mockReturnValue(wrappedFrameHandler)

    const runtime = await Effect.runPromise(buildSessionRuntime(params as never, services as never))

    expect(mocks.assembleFrameHandlerDeps).toHaveBeenCalledOnce()
    expect(mocks.assembleFrameHandlerDeps).toHaveBeenCalledWith(params)
    expect(mocks.createFrameHandlers).toHaveBeenCalledOnce()
    expect(mocks.createFrameHandlers).toHaveBeenCalledWith(assembledDeps, services)
    expect(mocks.installSessionRuntimeOverlays).toHaveBeenCalledOnce()
    expect(mocks.installSessionRuntimeOverlays).toHaveBeenCalledWith(params, services)
    expect(mocks.wrapFrameHandlerWithBrowserEffects).toHaveBeenCalledOnce()
    expect(mocks.wrapFrameHandlerWithBrowserEffects).toHaveBeenCalledWith(expect.objectContaining({
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      chunkManagerService,
      settingsService,
      renderer: params.rendering.renderer,
      camera: params.rendering.camera,
      composer: params.rendering.composer,
      composerRT: params.rendering.composerRT,
      worldRendererService,
      gtaoPass: params.rendering.gtaoPass,
      bloomPass: params.rendering.bloomPass,
      bokehPass: params.rendering.bokehPass,
      smaaPass: params.rendering.smaaPass,
      godRaysPass: params.rendering.godRaysPass,
      frameHandler,
    }))
    expect(runtime).toEqual({
      frameHandlerWithBrowserEvents: wrappedFrameHandler,
      maintenanceHandler,
    })
  })
})
