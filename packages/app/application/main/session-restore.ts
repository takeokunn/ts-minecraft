import { Effect, Option } from 'effect'

import { type WeatherService } from '@ts-minecraft/game'
import { type EquipmentService, type InventoryService } from '@ts-minecraft/inventory'
import { type HealthService, type HungerService, type XPService } from '@ts-minecraft/entity'
import { type CropGrowthService } from '@ts-minecraft/world'
import { type ChestService, type FurnaceService } from '@ts-minecraft/inventory'

import { restoreSavedPlayerState } from './session-restore-saved-player-state'
import type { WorldBootstrap } from './session-world-loader-metadata'

export const restoreSavedState = (
  worldBootstrap: WorldBootstrap,
  services: {
    readonly inventoryService: InventoryService
    readonly equipmentService: EquipmentService
    readonly healthService: HealthService
    readonly hungerService: HungerService
    readonly xpService: XPService
    readonly chestService: ChestService
    readonly furnaceService: FurnaceService
    readonly weatherService: WeatherService
    readonly cropGrowthService: CropGrowthService
  },
): Effect.Effect<void, never> => {
  const { inventoryService, equipmentService, healthService, hungerService, xpService, chestService, furnaceService, weatherService, cropGrowthService } = services
  return Effect.gen(function* () {
    const savedPlayerState = Option.getOrNull(worldBootstrap.savedPlayerState)
    if (savedPlayerState !== null) {
      yield* restoreSavedPlayerState(savedPlayerState, {
        inventoryService,
        equipmentService,
        healthService,
        hungerService,
        xpService,
        cropGrowthService,
      })
    }

    const savedFurnaceStates = Option.getOrNull(worldBootstrap.savedFurnaceStates)
    if (savedFurnaceStates !== null) {
      yield* furnaceService.deserialize(savedFurnaceStates)
    }

    const savedChestStates = Option.getOrNull(worldBootstrap.savedChestStates)
    if (savedChestStates !== null) {
      yield* chestService.deserialize(savedChestStates)
    }

    const savedWeatherState = Option.getOrNull(worldBootstrap.savedWeatherState)
    if (savedWeatherState !== null) {
      yield* weatherService.restore(savedWeatherState)
    }
  })
}
