import { Effect, Schema } from 'effect';
import { PlayerService, PlayerError, MovementService, PlayerCameraStateService } from '@ts-minecraft/player';
import { DeltaTimeSecs, PlayerId, Position } from '@ts-minecraft/kernel';
import { PhysicsService } from '@ts-minecraft/physics';
import { ChunkManagerService } from '@ts-minecraft/terrain';
import { InventoryService } from '@ts-minecraft/inventory';
import { GameStateError } from '../domain/errors';
import { GameModeService } from './game-mode-service';
export declare const PLAYER_BODY_ID = "player";
export declare const TimingStateSchema: Schema.Struct<{
    lastFrameTime: Schema.filter<Schema.filter<typeof Schema.Number>>;
    deltaTime: Schema.brand<Schema.filter<Schema.filter<typeof Schema.Number>>, "DeltaTimeSecs">;
    frameCount: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type TimingState = Schema.Schema.Type<typeof TimingStateSchema>;
declare const GameStateService_base: Effect.Service.Class<GameStateService, "@minecraft/application/GameStateService", {
    readonly effect: Effect.Effect<{
        initialize: (spawnPosition: Position) => Effect.Effect<void, GameStateError>;
        update: (deltaTime: DeltaTimeSecs) => Effect.Effect<void, GameStateError>;
        respawn: (spawnPosition: Position) => Effect.Effect<void, GameStateError>;
        getTiming: () => Effect.Effect<TimingState, never>;
        getPlayerPosition: (playerId: PlayerId) => Effect.Effect<Position, PlayerError>;
        getCameraRotation: () => Effect.Effect<{
            yaw: number;
            pitch: number;
        }, never>;
        isPlayerGrounded: () => Effect.Effect<boolean, never>;
    }, never, GameModeService | PlayerCameraStateService | MovementService | PlayerService | PhysicsService | ChunkManagerService | InventoryService>;
}>;
export declare class GameStateService extends GameStateService_base {
}
export declare const GameStateServiceLive: import("effect/Layer").Layer<GameStateService, never, GameModeService | PlayerCameraStateService | MovementService | PlayerService | PhysicsService | ChunkManagerService | InventoryService>;
export {};
//# sourceMappingURL=game-state-service.d.ts.map