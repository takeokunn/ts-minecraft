import { Effect } from 'effect'

import { buildPersistSessionState } from '@ts-minecraft/app/main/session-persist'
import { buildSessionBootstrapWorldState } from '@ts-minecraft/app/main/session-bootstrap-world-state'
import { initializeSessionBootstrapWorldPresentation } from '@ts-minecraft/app/main/session-bootstrap-world-presentation'
import { prepareInitialTerrain } from '@ts-minecraft/app/main/session-loading-gates-terrain'
import type { SessionBootstrapWorldDeps } from '@ts-minecraft/app/main/session-bootstrap-world-deps'

export const buildSessionBootstrapWorldOrchestration = ({
  state,
  terrain,
  presentation,
}: SessionBootstrapWorldDeps) =>
  Effect.gen(function* () {
    const {
      bootCtx,
      worldOpenRequest,
      initialGameMode,
      chunkManagerService,
      gameModeService,
    } = state
    const {
      bootCtx: terrainBootCtx,
      loadingScreen,
      scene,
      canvas,
      initialSettings,
      worldRendererService,
    } = terrain
    const {
      gameState,
      playerCameraState,
      particleSystem,
      blockHighlight,
      hotbarRenderer,
      crosshair,
      controlsHint,
      timeService,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      statisticsService,
      achievementService,
      chestService,
      furnaceService,
      weatherService,
      cropGrowthService,
      netherService,
      entityManager,
      parkedVehicleService,
    } = presentation

    yield* gameModeService.set(initialGameMode)
    const {
      worldBootstrap,
      initialSpawnSelection,
      initialChunkLoadAnchor,
      respawnPositionRef,
      spawnPosition,
    } = yield* buildSessionBootstrapWorldState({
      bootCtx,
      worldOpenRequest,
      initialGameMode,
      chunkManagerService,
      gameModeService,
    })

    yield* chunkManagerService.setActiveWorldId(worldOpenRequest.worldId)
    yield* prepareInitialTerrain({
      chunkManagerService,
      worldRendererService,
      terrainPool: terrainBootCtx.terrainPool,
      loadingScreen,
      scene,
      anchor: initialChunkLoadAnchor,
      renderDistance: initialSettings.renderDistance,
    })

    const persistSessionState = buildPersistSessionState({
      gameState,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      statisticsService,
      achievementService,
      timeService,
      chestService,
      furnaceService,
      gameModeService,
      weatherService,
      storageService: bootCtx.storageService,
      netherService,
      parkedVehicleService,
      cropGrowthService,
      entityManager,
      worldBootstrap,
      worldId: worldOpenRequest.worldId,
      respawnPositionRef,
    })

    yield* initializeSessionBootstrapWorldPresentation({
      worldBootstrap,
      initialSpawnSelection,
      initialSettings: {
        dayLengthSeconds: initialSettings.dayLengthSeconds,
      },
      scene,
      canvas,
      gameState,
      playerCameraState,
      blockHighlight,
      hotbarRenderer,
      particleSystem,
      timeService,
      crosshair,
      controlsHint,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      statisticsService,
      achievementService,
      chestService,
      furnaceService,
      weatherService,
      cropGrowthService,
      netherService,
      chunkManagerService,
      entityManager,
      parkedVehicleService,
      spawnPosition,
    })

    return { respawnPositionRef, persistSessionState, worldSeed: worldBootstrap.seed }
  })
