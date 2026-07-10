import { Effect, Option } from 'effect'

import { type GameStateService, type WeatherService } from '@ts-minecraft/game'
import { type EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { type InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { type HealthService } from '@ts-minecraft/entity/application/health-service'
import { type HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { type XPService } from '@ts-minecraft/entity/application/xp-service'
import { type StatisticsService } from '@ts-minecraft/entity/application/statistics-service'
import { type AchievementService } from '@ts-minecraft/entity/application/achievement-service'
import { type EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
import { type ChunkManagerService, type CropGrowthService, type NetherService } from '@ts-minecraft/world'
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
    readonly statisticsService: StatisticsService
    readonly achievementService: AchievementService
    readonly chestService: ChestService
    readonly furnaceService: FurnaceService
    readonly weatherService: WeatherService
    readonly cropGrowthService: CropGrowthService
    readonly netherService: Pick<NetherService, 'setDimension' | 'deserializePortals'>
    readonly chunkManagerService: Pick<ChunkManagerService, 'setActiveDimension'>
    readonly entityManager: EntityManager
    readonly parkedVehicleService: import('@ts-minecraft/entity/application/parked-vehicle-service').ParkedVehicleService
    readonly gameState: Pick<GameStateService, 'enterBoat' | 'enterMinecart'>
  },
): Effect.Effect<void, never> => {
  const { inventoryService, equipmentService, healthService, hungerService, xpService, statisticsService, achievementService, chestService, furnaceService, weatherService, cropGrowthService, netherService, chunkManagerService, entityManager, parkedVehicleService, gameState } = services
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
    yield* parkedVehicleService.reset()
    yield* statisticsService.reset()
    yield* achievementService.reset()
    // Dimension state is app-scoped too: quitting to title from the nether must
    // not leak 'nether' into the next world. The saved-dimension overlay below
    // re-enters the right dimension for a loaded world.
    yield* netherService.setDimension('overworld')
    yield* chunkManagerService.setActiveDimension('overworld')
    yield* chestService.deserialize([])
    yield* furnaceService.deserialize([])
    // Fresh clear-sky weather; the gated restore below overlays saved weather
    // for a loaded world. Without this a new world inherits the prior world's
    // active thunderstorm until the weather cycle happens to roll it over.
    yield* weatherService.setWeather('clear')

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

    const savedStatistics = Option.getOrNull(worldBootstrap.savedStatistics)
    if (savedStatistics !== null) {
      yield* statisticsService.deserialize(savedStatistics)
    }

    const savedUnlockedAchievements = Option.getOrNull(worldBootstrap.savedUnlockedAchievements)
    if (savedUnlockedAchievements !== null) {
      yield* achievementService.deserialize(savedUnlockedAchievements)
    }

    const savedWeatherState = Option.getOrNull(worldBootstrap.savedWeatherState)
    if (savedWeatherState !== null) {
      yield* weatherService.restore(savedWeatherState)
    }

      // Rebuild per-dimension entity pools: switch the manager to each saved
      // dimension, apply that dimension's snapshots, then land on the dimension
      // the world was saved in (untagged legacy entities default to overworld).
      const savedEntityStates = Option.getOrNull(worldBootstrap.savedEntityStates)
      const savedPortals = Option.getOrNull(worldBootstrap.savedPortals)
      if (savedPortals !== null) {
        yield* netherService.deserializePortals(savedPortals)
      }
      const savedParkedVehicles = Option.getOrNull(worldBootstrap.savedParkedVehicles)
      if (savedParkedVehicles !== null) {
        yield* parkedVehicleService.restore(savedParkedVehicles.map((vehicle) => ({ ...vehicle, position: { ...vehicle.position } })))
      }
      const savedActiveDimension = Option.getOrElse(worldBootstrap.savedActiveDimension, () => 'overworld' as const)
      if (savedEntityStates !== null) {
        const dimensions = ['overworld', 'nether', 'end'] as const
        for (const dimension of dimensions) {
          const entitiesInDimension = savedEntityStates.filter((e) => (e.dimension ?? 'overworld') === dimension)
          if (entitiesInDimension.length === 0) continue
          yield* entityManager.setActiveDimension(dimension)
          for (const entity of entitiesInDimension) {
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
      }
      // Land in the saved dimension across all dimension-aware services so a
      // nether save reloads INTO the nether (previously always overworld).
      yield* entityManager.setActiveDimension(savedActiveDimension)
      if (savedActiveDimension !== 'overworld') {
        yield* netherService.setDimension(savedActiveDimension)
        yield* chunkManagerService.setActiveDimension(savedActiveDimension)
      }
  })
}
