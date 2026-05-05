import { Effect } from 'effect';
import { GameModeSchema, GameMode, DEFAULT_GAME_MODE } from '@ts-minecraft/kernel';
export { GameModeSchema, DEFAULT_GAME_MODE };
export type { GameMode };
declare const GameModeService_base: Effect.Service.Class<GameModeService, "@minecraft/application/GameModeService", {
    readonly effect: Effect.Effect<{
        get: () => Effect.Effect<GameMode, never>;
        set: (mode: GameMode) => Effect.Effect<void, never>;
        isCreative: () => Effect.Effect<boolean, never>;
        isSurvival: () => Effect.Effect<boolean, never>;
    }, never, never>;
}>;
export declare class GameModeService extends GameModeService_base {
}
export declare const GameModeServiceLive: import("effect/Layer").Layer<GameModeService, never, never>;
//# sourceMappingURL=game-mode-service.d.ts.map