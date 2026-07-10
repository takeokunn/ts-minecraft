import { Clock, Effect, MutableRef } from 'effect'

import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { TimeService } from '@ts-minecraft/game'
import { WeatherService } from '@ts-minecraft/game'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { StatisticsService } from '@ts-minecraft/entity/application/statistics-service'
import { AchievementService } from '@ts-minecraft/entity/application/achievement-service'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { PlayerError } from '@ts-minecraft/entity/domain/errors'
import { StorageService, CropGrowthService, NetherService } from '@ts-minecraft/world'
import { StorageError } from '@ts-minecraft/world'
import { DEFAULT_PLAYER_ID, WorldId, type Position } from '@ts-minecraft/core'

import type { WorldBootstrap } from './session-world-loader-metadata'
import { buildSessionSaveMetadata } from './session-save-metadata'
import { buildSessionSavePlayerState } from './session-save-player-state'

export type PersistSessionStateDeps = {
  readonly gameState: GameStateService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly statisticsService: StatisticsService
  readonly achievementService: AchievementService
  readonly timeService: TimeService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
  readonly gameModeService: GameModeService
  readonly weatherService: WeatherService
  readonly storageService: StorageService
  readonly cropGrowthService: CropGrowthService
  readonly netherService: NetherService
  readonly entityManager: EntityManager
  readonly worldBootstrap: WorldBootstrap
  readonly worldId: WorldId
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
}

export const buildPersistSessionState = (deps: PersistSessionStateDeps) => (): Effect.Effect<void, PlayerError | StorageError> => {
  const { gameState, inventoryService, equipmentService, healthService, hungerService, xpService, statisticsService, achievementService, timeService, chestService, furnaceService, gameModeService, weatherService, storageService, cropGrowthService, netherService, entityManager, worldBootstrap, worldId, respawnPositionRef } = deps
  return Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis
    const playerPosition = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
    const inventory = yield* inventoryService.serialize()
    const equipment = yield* equipmentService.serialize()
    const health = yield* healthService.getHealth()
    const hunger = yield* hungerService.getHunger()
    const xp = yield* xpService.getXP()
    const timeOfDay = yield* timeService.getTimeOfDay()
    const chestStates = yield* chestService.serialize()
    const furnaceStates = yield* furnaceService.serialize()
    const gameMode = yield* gameModeService.get()
    const isBoating = yield* gameState.isBoating()
    const isMinecarting = yield* gameState.isMinecarting()
    const mountedVehicle = isBoating ? 'BOAT' : isMinecarting ? 'MINECART' : undefined
    const cropAges = yield* cropGrowthService.serialize()
    const weatherState = yield* weatherService.serialize()
    // Entities from ALL dimensions, tagged so the load can rebuild the pools.
    const entityStates = (yield* entityManager.getEntitiesAllDimensions()).map(({ dimension, entity }) => ({
      ...entity,
      dimension,
    }))
    const activeDimension = yield* netherService.getDimension()
    const statistics = yield* statisticsService.serialize()
    const unlockedAchievements = yield* achievementService.serialize()
    const metadata = buildSessionSaveMetadata({
      worldBootstrap,
      lastPlayed: new Date(nowMs),
      playerState: buildSessionSavePlayerState({
        position: playerPosition,
        health: health.current,
        inventory,
        timeOfDay,
        hunger: { foodLevel: hunger.foodLevel, saturation: hunger.saturation },
        totalXP: xp.totalXP,
        equipment,
        mountedVehicle,
        respawnPosition: MutableRef.get(respawnPositionRef),
        cropAges,
      }),
      chestStates,
      furnaceStates,
      weatherState,
      entityStates,
      statistics,
      unlockedAchievements,
      activeDimension,
      gameMode,
    })
    yield* storageService.saveWorldMetadata(worldId, metadata)
  })
}
