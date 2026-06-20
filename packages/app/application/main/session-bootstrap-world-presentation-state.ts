import { Effect } from 'effect'

import { GameStateService, TimeService, WeatherService } from '@ts-minecraft/game'
import { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { type WorldBootstrap } from '@ts-minecraft/app/main/session-world-loader-metadata'
import type { SpawnSelection } from '@ts-minecraft/app/main/spawn-selection-search'

import { restoreSavedState } from '@ts-minecraft/app/main/session-restore'
import { initializeSessionBootstrapWorldPresentationPlayer } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-player'
import { initializeSessionBootstrapWorldPresentationTime } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-time'

export type SessionBootstrapWorldPresentationStateDeps = {
  readonly worldBootstrap: WorldBootstrap
  readonly initialSpawnSelection: SpawnSelection
  readonly initialSettings: { readonly dayLengthSeconds: number }
  readonly gameState: GameStateService
  readonly playerCameraState: PlayerCameraStateService
  readonly timeService: TimeService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
  readonly weatherService: WeatherService
  readonly cropGrowthService: import('@ts-minecraft/world').CropGrowthService
  readonly spawnPosition: { readonly x: number; readonly y: number; readonly z: number }
}

export const initializeSessionBootstrapWorldPresentationState = ({
  worldBootstrap,
  initialSpawnSelection,
  initialSettings,
  gameState,
  playerCameraState,
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
  spawnPosition,
}: SessionBootstrapWorldPresentationStateDeps) =>
  Effect.gen(function* () {
    yield* gameState.initialize(spawnPosition)
    yield* initializeSessionBootstrapWorldPresentationPlayer({
      worldBootstrap,
      initialSpawnSelection,
      playerCameraState,
    })

    yield* restoreSavedState(worldBootstrap, {
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      chestService,
      furnaceService,
      weatherService,
      cropGrowthService,
    })

    yield* initializeSessionBootstrapWorldPresentationTime({
      initialSettings,
      timeService,
    })
  })
