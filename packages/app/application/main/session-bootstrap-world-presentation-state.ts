import { Effect } from 'effect'

import { GameStateService, TimeService, WeatherService } from '@ts-minecraft/game'
import { ChestService, EquipmentService, FurnaceService, InventoryService } from '@ts-minecraft/inventory'
import { HealthService, HungerService, PlayerCameraStateService, XPService } from '@ts-minecraft/entity'
import { type WorldBootstrap } from '@ts-minecraft/app/main/session-world-loader-metadata'
import type { SpawnSelection } from '@ts-minecraft/app/main/spawn-selection'

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
