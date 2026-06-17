import { Clock, Effect, MutableRef } from 'effect'

import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { TimeService } from '@ts-minecraft/game'
import { WeatherService } from '@ts-minecraft/game'
import { InventoryService, EquipmentService } from '@ts-minecraft/inventory'
import { ChestService, FurnaceService } from '@ts-minecraft/inventory'
import { HealthService, HungerService, XPService } from '@ts-minecraft/entity'
import { PlayerError } from '@ts-minecraft/entity'
import { StorageService, CropGrowthService } from '@ts-minecraft/world'
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
  readonly timeService: TimeService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
  readonly gameModeService: GameModeService
  readonly weatherService: WeatherService
  readonly storageService: StorageService
  readonly cropGrowthService: CropGrowthService
  readonly worldBootstrap: WorldBootstrap
  readonly worldId: WorldId
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
}

export const buildPersistSessionState = (deps: PersistSessionStateDeps) => (): Effect.Effect<void, PlayerError | StorageError> => {
  const { gameState, inventoryService, equipmentService, healthService, hungerService, xpService, timeService, chestService, furnaceService, gameModeService, weatherService, storageService, cropGrowthService, worldBootstrap, worldId, respawnPositionRef } = deps
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
    const cropAges = yield* cropGrowthService.serialize()
    const weatherState = yield* weatherService.serialize()
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
        respawnPosition: MutableRef.get(respawnPositionRef),
        cropAges,
      }),
      chestStates,
      furnaceStates,
      weatherState,
      gameMode,
    })
    yield* storageService.saveWorldMetadata(worldId, metadata)
  })
}
