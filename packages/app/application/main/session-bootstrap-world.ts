import { Effect } from 'effect'
import type * as THREE from 'three'

import { GameModeService, GameStateService, TimeService, WeatherService, type GameMode } from '@ts-minecraft/game'
import { ChestService, EquipmentService, FurnaceService, InventoryService } from '@ts-minecraft/inventory'
import { HealthService, HungerService, PlayerCameraStateService, XPService } from '@ts-minecraft/entity'
import { CrosshairService } from '@ts-minecraft/presentation'
import { LoadingScreenService } from '@ts-minecraft/presentation'
import { BlockHighlightService } from '@ts-minecraft/presentation'
import { HotbarRendererService } from '@ts-minecraft/presentation'
import { ParticleSystemService } from '@ts-minecraft/rendering'
import { WorldId } from '@ts-minecraft/core'
import { ChunkManagerService, CropGrowthService } from '@ts-minecraft/world'

import type { BootContext } from '@ts-minecraft/app/main/boot'
import { buildPersistSessionState } from '@ts-minecraft/app/main/session-persist'
import { buildSessionBootstrapWorldState } from '@ts-minecraft/app/main/session-bootstrap-world-state'
import { initializeSessionBootstrapWorldPresentation } from '@ts-minecraft/app/main/session-bootstrap-world-presentation'
import { prepareInitialTerrain } from '@ts-minecraft/app/main/session-loading-gates-terrain'

export type SessionBootstrapWorldDeps = {
  readonly bootCtx: Pick<BootContext, 'storageService' | 'noiseService' | 'terrainPool'>
  readonly worldId: WorldId
  readonly initialGameMode: GameMode
  readonly initialSettings: { readonly renderDistance: number; readonly dayLengthSeconds: number }
  readonly loadingScreen: LoadingScreenService
  readonly scene: THREE.Scene
  readonly canvas: HTMLCanvasElement
  readonly chunkManagerService: ChunkManagerService
  readonly worldRendererService: import('@ts-minecraft/rendering').WorldRendererService
  readonly gameState: GameStateService
  readonly playerCameraState: PlayerCameraStateService
  readonly particleSystem: ParticleSystemService
  readonly blockHighlight: BlockHighlightService
  readonly hotbarRenderer: HotbarRendererService
  readonly crosshair: CrosshairService
  readonly timeService: TimeService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
  readonly weatherService: WeatherService
  readonly cropGrowthService: CropGrowthService
  readonly gameModeService: GameModeService
}

export const buildSessionBootstrapWorld = ({
  bootCtx,
  worldId,
  initialGameMode,
  initialSettings,
  loadingScreen,
  scene,
  canvas,
  chunkManagerService,
  worldRendererService,
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
  gameModeService,
}: SessionBootstrapWorldDeps) =>
  Effect.gen(function* () {
    yield* gameModeService.set(initialGameMode)
    const { worldBootstrap, initialSpawnSelection, initialChunkLoadAnchor, respawnPositionRef, spawnPosition } = yield* buildSessionBootstrapWorldState({
      bootCtx: {
        storageService: bootCtx.storageService,
        noiseService: bootCtx.noiseService,
      },
      worldId,
      initialGameMode,
      chunkManagerService,
      gameModeService,
    })

    yield* chunkManagerService.setActiveWorldId(worldId)
    yield* prepareInitialTerrain({
      chunkManagerService,
      worldRendererService,
      terrainPool: bootCtx.terrainPool,
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
