import { Clock, Effect, Option } from 'effect'

import { GameStateService } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { TimeService } from '@ts-minecraft/game'
import { InventoryService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/furnace'
import { HealthService } from '@ts-minecraft/player'
import { PlayerError } from '@ts-minecraft/player'
import { StorageService } from '@ts-minecraft/world-state'
import { StorageError } from '@ts-minecraft/world-state'
import { DEFAULT_PLAYER_ID, WorldId } from '@ts-minecraft/kernel'

import type { WorldBootstrap } from '@ts-minecraft/app/main/session-world-loader'

export type PersistSessionStateDeps = {
  readonly gameState: GameStateService
  readonly inventoryService: InventoryService
  readonly healthService: HealthService
  readonly timeService: TimeService
  readonly furnaceService: FurnaceService
  readonly gameModeService: GameModeService
  readonly storageService: StorageService
  readonly worldBootstrap: WorldBootstrap
  readonly worldId: WorldId
}

// Builds a thunk that serializes and persists full session state to storage.
// The thunk is called by the auto-save daemon, the pause menu "Save & Quit"
// action, and the best-effort flush before session teardown.
export const buildPersistSessionState = (deps: PersistSessionStateDeps) => (): Effect.Effect<void, PlayerError | StorageError> => {
  const { gameState, inventoryService, healthService, timeService, furnaceService, gameModeService, storageService, worldBootstrap, worldId } = deps
  return Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis
    const playerPosition = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
    const inventory = yield* inventoryService.serialize()
    const health = yield* healthService.getHealth()
    const timeOfDay = yield* timeService.getTimeOfDay()
    const furnaceStates = yield* furnaceService.serialize()
    const gameMode = yield* gameModeService.get()
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
      },
      furnaceStates,
      gameMode,
      saveVersion: 1,
    })
  })
}

// Restores player inventory, health, and furnace state from a saved world bootstrap.
// Called once at session start after chunks are loaded and game state is initialized.
export const restoreSavedState = (
  worldBootstrap: WorldBootstrap,
  services: {
    readonly inventoryService: InventoryService
    readonly healthService: HealthService
    readonly furnaceService: FurnaceService
  },
): Effect.Effect<void, never> => {
  const { inventoryService, healthService, furnaceService } = services
  return Effect.gen(function* () {
    yield* Option.match(worldBootstrap.savedPlayerState, {
      onNone: () => Effect.void,
      onSome: (saved) =>
        Effect.gen(function* () {
          yield* inventoryService.deserialize(saved.inventory)
          yield* healthService.reset()
          const resetHealth = yield* healthService.getHealth()
          const damageToApply = Math.max(0, resetHealth.current - saved.health)
          if (damageToApply > 0) {
            yield* healthService.applyDamage(damageToApply)
          }
        }),
    })

    yield* Option.match(worldBootstrap.savedFurnaceStates, {
      onNone: () => Effect.void,
      onSome: (saved) => furnaceService.deserialize(saved),
    })
  })
}
