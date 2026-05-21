import { Clock, Effect, Option } from 'effect';
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel';
// Builds a thunk that serializes and persists full session state to storage.
// The thunk is called by the auto-save daemon, the pause menu "Save & Quit"
// action, and the best-effort flush before session teardown.
export const buildPersistSessionState = (deps) => () => {
    const { gameState, inventoryService, healthService, timeService, furnaceService, gameModeService, storageService, worldBootstrap, worldId } = deps;
    return Effect.gen(function* () {
        const nowMs = yield* Clock.currentTimeMillis;
        const playerPosition = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID);
        const inventory = yield* inventoryService.serialize();
        const health = yield* healthService.getHealth();
        const timeOfDay = yield* timeService.getTimeOfDay();
        const furnaceStates = yield* furnaceService.serialize();
        const gameMode = yield* gameModeService.get();
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
        });
    });
};
// Restores player inventory, health, and furnace state from a saved world bootstrap.
// Called once at session start after chunks are loaded and game state is initialized.
export const restoreSavedState = (worldBootstrap, services) => {
    const { inventoryService, healthService, furnaceService } = services;
    return Effect.gen(function* () {
        yield* Option.match(worldBootstrap.savedPlayerState, {
            onNone: () => Effect.void,
            onSome: (saved) => Effect.gen(function* () {
                yield* inventoryService.deserialize(saved.inventory);
                yield* healthService.reset();
                const resetHealth = yield* healthService.getHealth();
                const damageToApply = Math.max(0, resetHealth.current - saved.health);
                if (damageToApply > 0) {
                    yield* healthService.applyDamage(damageToApply);
                }
            }),
        });
        yield* Option.match(worldBootstrap.savedFurnaceStates, {
            onNone: () => Effect.void,
            onSome: (saved) => furnaceService.deserialize(saved),
        });
    });
};
//# sourceMappingURL=../../../../dist/packages/app/application/main/session-save.js.map