import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'

import { buildSessionRuntimeServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'

const makeService = (id: string) => ({ id } as never)

describe('session-bootstrap-runtime-services', () => {
  it('maps bootstrap services into frame handler services without extra work', () => {
    const perfHud = makeService('perf-hud')
    const settingsService = makeService('settings')
    const soundManager = makeService('sound')
    const musicManager = makeService('music')
    const gameModeService = makeService('game-mode')
    const multiplayerService = Option.some(makeService('multiplayer'))
    const remotePlayerRenderer = makeService('remote-player-renderer')
    const services = {
      sceneService: makeService('scene'),
      cameraService: makeService('camera'),
      gameState: makeService('game-state'),
      playerCameraState: makeService('player-camera'),
      firstPersonCamera: makeService('first-person'),
      thirdPersonCamera: makeService('third-person'),
      crosshair: makeService('crosshair'),
      damageOverlay: makeService('damage-overlay'),
      blockHighlight: makeService('block-highlight'),
      inputService: makeService('input'),
      blockService: makeService('block'),
      biomeService: makeService('biome'),
      hotbarService: makeService('hotbar'),
      hotbarRenderer: makeService('hotbar-renderer'),
      chunkManagerService: makeService('chunk-manager'),
      timeService: makeService('time'),
      weatherService: makeService('weather'),
      recipeService: makeService('recipe'),
      debugFeatureFlags: makeService('debug-flags'),
      debugOverlay: makeService('debug-overlay'),
      connectionPanel: makeService('connection-panel'),
      chatPanel: makeService('chat-panel'),
      settingsOverlay: makeService('settings-overlay'),
      pauseMenu: makeService('pause-menu'),
      inventoryRenderer: makeService('inventory-renderer'),
      inventoryService: makeService('inventory'),
      equipmentService: makeService('equipment'),
      fpsCounter: makeService('fps-counter'),
      healthService: makeService('health'),
      hungerService: makeService('hunger'),
      xpService: makeService('xp'),
      fishingService: makeService('fishing'),
      droppedItemService: makeService('dropped-item'),
      droppedXpOrbService: makeService('dropped-xp-orb'),
      worldRendererService: makeService('world-renderer'),
      entityRenderer: makeService('entity-renderer'),
      droppedItemRenderer: makeService('dropped-item-renderer'),
      droppedXpOrbRenderer: makeService('dropped-xp-orb-renderer'),
      chunkMeshService: makeService('chunk-mesh'),
      particleSystem: makeService('particle-system'),
      entityManager: makeService('entity-manager'),
      mobSpawner: makeService('mob-spawner'),
      villageService: makeService('village'),
      tradingPresentation: makeService('trading'),
      redstoneService: makeService('redstone'),
      cropGrowthService: makeService('crop-growth'),
      fluidService: makeService('fluid'),
      chestService: makeService('chest'),
      furnaceService: makeService('furnace'),
      netherService: makeService('nether'),
      gameModeService,
      multiplayerService,
    } satisfies SessionBootstrapServices

    const runtimeServices = buildSessionRuntimeServices({
      bootCtx: {
        perfHud,
        settingsService,
        soundManager,
        musicManager,
      },
      rendering: { remotePlayerRenderer },
      services,
    })

    expect(runtimeServices.gameState).toBe(services.gameState)
    expect(runtimeServices.gameMode).toBe(gameModeService)
    expect(runtimeServices.damageOverlay).toBe(services.damageOverlay)
    expect(runtimeServices.settingsService).toBe(settingsService)
    expect(runtimeServices.soundManager).toBe(soundManager)
    expect(runtimeServices.musicManager).toBe(musicManager)
    expect(runtimeServices.perfHud).toBe(perfHud)
    expect(runtimeServices.biomeService).toBe(services.biomeService)
    expect(runtimeServices.droppedXpOrbRenderer).toBe(services.droppedXpOrbRenderer)
    expect(runtimeServices.remotePlayerRenderer).toBe(remotePlayerRenderer)
    expect(runtimeServices.multiplayer).toBe(multiplayerService)
  })
})
