import { Effect, MutableRef } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  installQaApi: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/qa-api', () => ({
  installQaApi: mocks.installQaApi,
}))

import { installSessionRuntimeOverlays } from '@ts-minecraft/app/main/session-runtime-overlays'

describe('installSessionRuntimeOverlays', () => {
  it('installs the QA API and mounts the per-session overlays', async () => {
    const respawnPositionRef = MutableRef.make({ x: 1, y: 2, z: 3 })
    const control = { tag: 'control' } as never
    const deathScreen = {
      attach: vi.fn(() => Effect.void),
    }
    const pauseMenu = {
      attach: vi.fn(() => Effect.void),
    }
    const debugOverlay = {
      attach: vi.fn(() => Effect.void),
    }
    const biomeService = { tag: 'biome-service' } as never
    const recipeService = { tag: 'recipe-service' } as never
    const gameState = { tag: 'game-state' } as never
    const playerCameraState = { tag: 'player-camera-state' } as never
    const blockHighlight = { tag: 'block-highlight' } as never
    const inputService = { tag: 'input-service' } as never
    const blockService = { tag: 'block-service' } as never
    const hotbarService = { tag: 'hotbar-service' } as never
    const furnaceService = { tag: 'furnace-service' } as never
    const inventoryService = { tag: 'inventory-service' } as never
    const inventoryRenderer = { tag: 'inventory-renderer' } as never
    const chunkManagerService = { tag: 'chunk-manager-service' } as never
    const timeService = { tag: 'time-service' } as never
    const debugFeatureFlags = { tag: 'debug-feature-flags' } as never
    const fpsCounter = { tag: 'fps-counter' } as never
    const params = {
      rendering: {
        camera: { tag: 'camera' } as never,
        scene: { tag: 'scene' } as never,
      },
      state: {
        control,
        respawnPositionRef,
      },
      overlays: {
        deathScreen,
        debugOverlay,
        biomeService,
        recipeService,
      },
    }
    const services = {
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
      debugFeatureFlags,
      pauseMenu,
      worldRendererService: { tag: 'world-renderer-service' } as never,
      entityManager: { tag: 'entity-manager' } as never,
      fpsCounter,
    }

    mocks.installQaApi.mockReturnValue(Effect.void)

    await Effect.runPromise(installSessionRuntimeOverlays(params as never, services as never))

    expect(mocks.installQaApi).toHaveBeenCalledOnce()
    expect(mocks.installQaApi).toHaveBeenCalledWith({
      camera: params.rendering.camera,
      scene: params.rendering.scene,
      playerCameraState,
      blockHighlight,
      inputService,
      blockService,
      hotbarService,
      furnaceService,
      inventoryService,
      inventoryRenderer,
      gameState,
      timeService,
      chunkManagerService,
      recipeService,
      worldRendererService: services.worldRendererService,
      entityManager: services.entityManager,
      debugFeatureFlags,
    })
    expect(deathScreen.attach).toHaveBeenCalledOnce()
    expect(deathScreen.attach).toHaveBeenCalledWith(control, respawnPositionRef)
    expect(pauseMenu.attach).toHaveBeenCalledOnce()
    expect(pauseMenu.attach).toHaveBeenCalledWith(control)
    expect(debugOverlay.attach).toHaveBeenCalledOnce()
    expect(debugOverlay.attach).toHaveBeenCalledWith({
      biomeService,
      chunkManager: chunkManagerService,
      gameState,
      timeService,
      cameraState: playerCameraState,
      fpsCounter,
      debugFeatureFlags,
    })
  })
})
