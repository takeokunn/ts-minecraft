import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect, vi } from 'vitest'
import * as THREE from 'three'

import { buildSessionRuntimeBundle } from '@ts-minecraft/app/main/session-bootstrap-runtime'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'

const makeService = (id: string) => ({ id } as never)

describe('session-bootstrap-runtime', () => {
  it.effect('assembles the runtime bundle from grouped inputs', () =>
    Effect.gen(function* () {
      const getElementById = vi.fn().mockReturnValue(null)
      vi.stubGlobal('document', { getElementById })

      const renderer = makeService('renderer')
      const perfHud = makeService('perf-hud')
      const settingsService = makeService('settings')
      const soundManager = makeService('sound')
      const musicManager = makeService('music')
      const control = makeService('control')
      const respawnPositionRef = makeService('respawn-position')
      const persistSessionState = vi.fn(() => Effect.void)
      const deathScreen = makeService('death-screen')
      const debugOverlay = makeService('debug-overlay')
      const biomeService = makeService('biome')
      const recipeService = makeService('recipe')
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()
      const composerRT = makeService('composer-rt')
      const composer = makeService('composer')
      const lighting = makeService('lighting')
      const services = {
        sceneService: makeService('scene'),
        cameraService: makeService('camera'),
        gameState: makeService('game-state'),
        playerCameraState: makeService('player-camera'),
        firstPersonCamera: makeService('first-person'),
        thirdPersonCamera: makeService('third-person'),
        crosshair: makeService('crosshair'),
        blockHighlight: makeService('block-highlight'),
        inputService: makeService('input'),
        blockService: makeService('block'),
        biomeService: makeService('biome-service'),
        hotbarService: makeService('hotbar'),
        hotbarRenderer: makeService('hotbar-renderer'),
        chunkManagerService: makeService('chunk-manager'),
        timeService: makeService('time'),
        weatherService: makeService('weather'),
        recipeService: makeService('recipe-service'),
        debugFeatureFlags: makeService('debug-flags'),
        debugOverlay: makeService('debug-overlay-service'),
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
        gameModeService: makeService('game-mode'),
      } satisfies SessionBootstrapServices

      const bundle = yield* buildSessionRuntimeBundle({
        bootCtx: {
          renderer,
          perfHud,
          settingsService,
          soundManager,
          musicManager,
        },
        rendering: {
          scene,
          camera,
          composerRT,
          composer,
          gtaoPass: makeService('gtao'),
          bloomPass: makeService('bloom'),
          bokehPass: makeService('bokeh'),
          godRaysPass: makeService('god-rays'),
          smaaPass: makeService('smaa'),
          lighting,
        },
        state: {
          control,
          respawnPositionRef,
          persistSessionState,
        },
        overlays: {
          deathScreen,
          debugOverlay,
          biomeService,
          recipeService,
        },
        services,
      })

      expect(bundle.runtimeParams.rendering.renderer).toBe(renderer)
      expect(bundle.runtimeParams.rendering.scene).toBe(scene)
      expect(bundle.runtimeParams.state.control).toBe(control)
      expect(bundle.runtimeParams.state.respawnPositionRef).toBe(respawnPositionRef)
      expect(bundle.runtimeParams.overlays.deathScreen).toBe(deathScreen)
      expect(bundle.runtimeParams.overlays.debugOverlay).toBe(debugOverlay)
      expect(bundle.runtimeServices.gameMode).toBe(services.gameModeService)
      expect(bundle.runtimeServices.perfHud).toBe(perfHud)
      expect(vi.isMockFunction(getElementById)).toBe(true)
      expect(getElementById).toHaveBeenCalledWith('fps-value')
    })
  )
})
