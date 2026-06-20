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
      worldId,
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
      timeService,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      chestService,
      furnaceService,
      weatherService,
      cropGrowthService,
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
      worldId,
      initialGameMode,
      chunkManagerService,
      gameModeService,
    })

    yield* chunkManagerService.setActiveWorldId(worldId)
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
      timeService,
      chestService,
      furnaceService,
      gameModeService,
      weatherService,
      storageService: bootCtx.storageService,
      cropGrowthService,
      worldBootstrap,
      worldId,
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
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      chestService,
      furnaceService,
      weatherService,
      cropGrowthService,
      spawnPosition,
    })

    return { respawnPositionRef, persistSessionState }
  })
