import { Effect, Option } from 'effect'

import { type GameStateService, type WeatherService } from '@ts-minecraft/game'
import { type EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { type InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { type HealthService } from '@ts-minecraft/entity/application/health-service'
import { type HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { type XPService } from '@ts-minecraft/entity/application/xp-service'
import { type EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
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
    readonly entityManager: EntityManager
    readonly gameState: Pick<GameStateService, 'enterBoat' | 'enterMinecart'>
  },
): Effect.Effect<void, never> => {
  const { inventoryService, equipmentService, healthService, hungerService, xpService, chestService, furnaceService, weatherService, cropGrowthService, entityManager, gameState } = services
  return Effect.gen(function* () {
    // Establish clean per-world state FIRST, then overlay saved state below.
    // These services are app-scoped singletons reused across worlds (only the
    // session fiber unwinds to the title loop), so without this a brand-new
    // world — which has no saved state to restore — inherits the previous
    // world's inventory, XP, equipment, mobs, and container contents. Restore
    // paths below (deserialize / setTotalXP / applyEntitySnapshot) overwrite
    // these defaults for a loaded world, so the reset is a no-op cost there.
    yield* inventoryService.clear()
    yield* equipmentService.reset()
    yield* xpService.reset()
    yield* healthService.reset()
    yield* hungerService.reset()
    yield* entityManager.clear()
    yield* chestService.deserialize([])
    yield* furnaceService.deserialize([])

    const savedPlayerState = Option.getOrNull(worldBootstrap.savedPlayerState)
    if (savedPlayerState !== null) {
      yield* restoreSavedPlayerState(savedPlayerState, {
        inventoryService,
        equipmentService,
        healthService,
        hungerService,
        xpService,
        cropGrowthService,
        gameState,
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

      const savedEntityStates = Option.getOrNull(worldBootstrap.savedEntityStates)
      if (savedEntityStates !== null) {
        for (const entity of savedEntityStates) {
          yield* entityManager.applyEntitySnapshot({
            entityId: EntityId.make(entity.entityId),
            entityType: entity.type,
            position: entity.position,
            health: entity.health,
            alive: entity.health > 0,
            ...(entity.velocity !== undefined ? { velocity: entity.velocity } : {}),
            ...(entity.rotation !== undefined ? { rotation: entity.rotation } : {}),
            ...(entity.isBaby !== undefined ? { isBaby: entity.isBaby } : {}),
            ...(entity.fuseSecs !== undefined ? { fuseSecs: entity.fuseSecs } : {}),
            ...(entity.fireSecs !== undefined ? { fireSecs: entity.fireSecs } : {}),
          })
        }
      }
  })
}
