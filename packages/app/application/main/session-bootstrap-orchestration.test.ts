import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect, vi } from 'vitest'

import { buildLighting } from '@ts-minecraft/app/main/session-lighting'
import { buildSessionRuntimeBundle } from '@ts-minecraft/app/main/session-bootstrap-runtime'
import { buildSessionBootstrapWorldOrchestration } from '@ts-minecraft/app/main/session-bootstrap-world-orchestration'
import { buildSessionBootstrapScene } from '@ts-minecraft/app/main/session-bootstrap-scene'
import { buildSessionBootstrapStartupState } from '@ts-minecraft/app/main/session-bootstrap/startup'
import { buildSessionBootstrapOrchestration } from './session-bootstrap-orchestration'

vi.mock('@ts-minecraft/app/main/session-lighting', () => ({
  buildLighting: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap-runtime', () => ({
  buildSessionRuntimeBundle: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap-world-orchestration', () => ({
  buildSessionBootstrapWorldOrchestration: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap-scene', () => ({
  buildSessionBootstrapScene: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap/startup', () => ({
  buildSessionBootstrapStartupState: vi.fn(),
}))

describe('buildSessionBootstrapOrchestration', () => {
  it('preserves the top-level bootstrap sequence and wires the composed bundle', async () => {
    const callOrder: string[] = []
    const control = { id: 'control' } as never
    const initialSettings = {
      renderDistance: 8,
      dayLengthSeconds: 1200,
    } as never
    const initialGraphics = { quality: 'high' } as never
    const scene = { id: 'scene' } as never
    const camera = { id: 'camera' } as never
    const composerRT = { id: 'composer-rt' } as never
    const composer = { id: 'composer' } as never
    const gtaoPass = { id: 'gtao' } as never
    const godRaysPass = { id: 'god-rays' } as never
    const bloomPass = { id: 'bloom' } as never
    const bokehPass = { id: 'bokeh' } as never
    const smaaPass = { id: 'smaa' } as never
    const respawnPositionRef = { id: 'respawn-position' } as never
    const persistSessionState = { id: 'persist-session-state' } as never
    const lighting = { id: 'lighting' } as never
    const runtimeParams = { id: 'runtime-params' } as never
    const runtimeServices = { id: 'runtime-services' } as never
    const connectionPanel = { id: 'connection-panel' } as never
    const chatPanel = { id: 'chat-panel' } as never
    const playerListPanel = { id: 'player-list-panel' } as never
    const multiplayerService = Option.some({ id: 'multiplayer' } as never)
    const entityManager = { id: 'entity-manager' } as never

    vi.mocked(buildSessionBootstrapStartupState).mockImplementation(() => {
      callOrder.push('startup')
      return Effect.succeed({ control, initialSettings, initialGraphics })
    })
    vi.mocked(buildSessionBootstrapScene).mockImplementation(() => {
      callOrder.push('scene')
      return Effect.succeed({
        scene,
        camera,
        composerRT,
        composer,
        gtaoPass,
        godRaysPass,
        bloomPass,
        bokehPass,
        smaaPass,
      })
    })
    vi.mocked(buildSessionBootstrapWorldOrchestration).mockImplementation(() => {
      callOrder.push('world')
      return Effect.succeed({ respawnPositionRef, persistSessionState })
    })
    vi.mocked(buildLighting).mockImplementation(() => {
      callOrder.push('lighting')
      return Effect.succeed(lighting)
    })
    vi.mocked(buildSessionRuntimeBundle).mockImplementation(({ rendering, overlays, services }) => {
      callOrder.push('runtime')
      expect(rendering.lighting).toBe(lighting)
      expect(overlays.connectionPanel).toBe(connectionPanel)
      expect(overlays.chatPanel).toBe(chatPanel)
      expect(overlays.playerListPanel).toBe(playerListPanel)
      expect(services.multiplayerService).toBe(multiplayerService)
      return Effect.succeed({ runtimeParams, runtimeServices })
    })

    const result = await Effect.runPromise(buildSessionBootstrapOrchestration({
      bootCtx: {
        canvas: { clientWidth: 1024, clientHeight: 768 } as HTMLCanvasElement,
        renderer: { id: 'renderer' } as never,
        perfHud: { id: 'perf-hud' } as never,
        settingsService: { getSettings: vi.fn() } as never,
        soundManager: { id: 'sound' } as never,
        musicManager: { id: 'music' } as never,
        terrainPool: { id: 'terrain-pool' } as never,
        storageService: { id: 'storage' } as never,
        noiseService: { id: 'noise' } as never,
      },
      worldId: 'world-1' as never,
      initialGameMode: 'survival' as never,
      startupMultiplayerConnection: Option.none(),
      initialSeed: 1234,
      gameLoopService: { id: 'game-loop' } as never,
      loadingScreen: { id: 'loading' } as never,
      deathScreen: { id: 'death' } as never,
      services: {
        rendering: {
          sceneService: { id: 'scene-service' } as never,
          cameraService: { id: 'camera-service' } as never,
          worldRendererService: { id: 'world-renderer' } as never,
          particleSystem: { id: 'particle-system' } as never,
        },
        world: {
          chunkManagerService: { id: 'chunk-manager' } as never,
          biomeService: { id: 'biome' } as never,
          cropGrowthService: { id: 'crop-growth' } as never,
        },
        gameplay: {
          gameState: { id: 'game-state' } as never,
          timeService: { id: 'time' } as never,
          weatherService: { id: 'weather' } as never,
          gameModeService: { id: 'game-mode' } as never,
        },
        presentation: {
          debugOverlay: { id: 'debug-overlay' } as never,
          connectionPanel,
          chatPanel,
          playerListPanel,
          blockHighlight: { id: 'block-highlight' } as never,
          crosshair: { id: 'crosshair' } as never,
          hotbarRenderer: { id: 'hotbar-renderer' } as never,
        },
        inventory: {
          recipeService: { id: 'recipe' } as never,
          inventoryService: { id: 'inventory' } as never,
          equipmentService: { id: 'equipment' } as never,
          chestService: { id: 'chest' } as never,
          furnaceService: { id: 'furnace' } as never,
        },
        entity: {
          playerCameraState: { id: 'player-camera' } as never,
          healthService: { id: 'health' } as never,
          hungerService: { id: 'hunger' } as never,
          xpService: { id: 'xp' } as never,
          entityManager,
        },
        multiplayer: {
          multiplayerService,
        },
      } as never,
    } satisfies Parameters<typeof buildSessionBootstrapOrchestration>[0]))

    expect(callOrder).toEqual(['startup', 'scene', 'world', 'lighting', 'runtime'])
    expect(buildSessionBootstrapStartupState).toHaveBeenCalledOnce()
    expect(buildSessionBootstrapScene).toHaveBeenCalledOnce()
    expect(buildSessionBootstrapWorldOrchestration).toHaveBeenCalledOnce()
    expect(vi.mocked(buildSessionBootstrapWorldOrchestration).mock.calls[0]?.[0].presentation.entityManager).toBe(entityManager)
    expect(buildSessionBootstrapWorldOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      state: expect.objectContaining({ initialSeed: 1234 }),
    }))
    expect(buildLighting).toHaveBeenCalledOnce()
    expect(buildSessionRuntimeBundle).toHaveBeenCalledOnce()
    expect(result).toEqual({
      bootCtx: expect.anything(),
      gameLoopService: expect.anything(),
      loadingScreen: expect.anything(),
      terrainPool: expect.anything(),
      runtimeParams,
      runtimeServices,
      control,
    })
  })
})
