import { Clock, Effect, MutableRef, Option } from 'effect'

import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { TimeService } from '@ts-minecraft/game'
import { InventoryService, EquipmentService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { HealthService, HungerService, XPService } from '@ts-minecraft/entity'
import { PlayerError } from '@ts-minecraft/entity'
import { StorageService, CropGrowthService } from '@ts-minecraft/world'
import { StorageError } from '@ts-minecraft/world'
import { DEFAULT_PLAYER_ID, WorldId, type Position } from '@ts-minecraft/core'

import type { WorldBootstrap } from '@ts-minecraft/app/main/session-world-loader'

export type PersistSessionStateDeps = {
  readonly gameState: GameStateService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly timeService: TimeService
  readonly furnaceService: FurnaceService
  readonly gameModeService: GameModeService
  readonly storageService: StorageService
  readonly cropGrowthService: CropGrowthService
  readonly worldBootstrap: WorldBootstrap
  readonly worldId: WorldId
  readonly respawnPositionRef: MutableRef.MutableRef<Position>
}

export const buildPersistSessionState = (deps: PersistSessionStateDeps) => (): Effect.Effect<void, PlayerError | StorageError> => {
  const { gameState, inventoryService, equipmentService, healthService, hungerService, xpService, timeService, furnaceService, gameModeService, storageService, cropGrowthService, worldBootstrap, worldId, respawnPositionRef } = deps
  return Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis
    const playerPosition = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
    const inventory = yield* inventoryService.serialize()
    const equipment = yield* equipmentService.serialize()
    const health = yield* healthService.getHealth()
    const hunger = yield* hungerService.getHunger()
    const xp = yield* xpService.getXP()
    const timeOfDay = yield* timeService.getTimeOfDay()
    const furnaceStates = yield* furnaceService.serialize()
    const gameMode = yield* gameModeService.get()
    const cropAges = yield* cropGrowthService.serialize()
    yield* storageService.saveWorldMetadata(worldId, {
      seed: worldBootstrap.seed,
      createdAt: worldBootstrap.createdAt,
      lastPlayed: new Date(nowMs),
      playerSpawn: worldBootstrap.baseSpawnPosition,
      playerState: {
        position: playerPosition,
        health: health.current,
        inventory,
        timeOfDay,
        hunger: { foodLevel: hunger.foodLevel, saturation: hunger.saturation },
        totalXP: xp.totalXP,
        equipment,
        respawnPosition: MutableRef.get(respawnPositionRef),
        cropAges,
      },
      furnaceStates,
      gameMode,
      saveVersion: 1,
    })
  })
}

export const restoreSavedState = (
  worldBootstrap: WorldBootstrap,
  services: {
    readonly inventoryService: InventoryService
    readonly equipmentService: EquipmentService
    readonly healthService: HealthService
    readonly hungerService: HungerService
    readonly xpService: XPService
    readonly furnaceService: FurnaceService
    readonly cropGrowthService: CropGrowthService
  },
): Effect.Effect<void, never> => {
  const { inventoryService, equipmentService, healthService, hungerService, xpService, furnaceService, cropGrowthService } = services
  return Effect.gen(function* () {
    const savedPlayerState = Option.getOrNull(worldBootstrap.savedPlayerState)
    if (savedPlayerState !== null) {
      const saved = savedPlayerState
      yield* inventoryService.deserialize(saved.inventory)
      yield* healthService.reset()
      const resetHealth = yield* healthService.getHealth()
      const damageToApply = Math.max(0, resetHealth.current - saved.health)
      if (damageToApply > 0) {
        yield* healthService.applyDamage(damageToApply)
      }
      if (saved.hunger != null) {
        yield* hungerService.restore(saved.hunger.foodLevel, saved.hunger.saturation)
      }
      // Restore XP (default 0 for pre-XP saves via schema).
      yield* xpService.setTotalXP(saved.totalXP ?? 0)
      // Restore equipment (default empty record for pre-equipment saves).
      yield* equipmentService.deserialize(
        (saved.equipment ?? {}) as Parameters<typeof equipmentService.deserialize>[0],
      )
      if (saved.cropAges != null) {
        yield* cropGrowthService.restore(saved.cropAges)
      }
    }

    const savedFurnaceStates = Option.getOrNull(worldBootstrap.savedFurnaceStates)
    if (savedFurnaceStates !== null) {
      yield* furnaceService.deserialize(savedFurnaceStates)
    }
  })
}
