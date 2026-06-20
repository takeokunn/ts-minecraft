import { Effect, Option } from 'effect'

import { type WeatherService } from '@ts-minecraft/game'
import { type EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { type InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { type HealthService } from '@ts-minecraft/entity/application/health-service'
import { type HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { type XPService } from '@ts-minecraft/entity/application/xp-service'
import { type CropGrowthService } from '@ts-minecraft/world'
import { type ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { type FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'

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
