import { Effect } from 'effect';
import type { PlayerId, Position } from '@ts-minecraft/kernel';
import type { Vector3 } from '@ts-minecraft/kernel';
import { PlayerError } from '../domain/errors';
import type { PlayerState } from '../domain/player-state';
declare const PlayerService_base: Effect.Service.Class<PlayerService, "@minecraft/application/PlayerService", {
    readonly effect: Effect.Effect<{
        create: (id: PlayerId, position: Position) => Effect.Effect<void, PlayerError>;
        updatePosition: (id: PlayerId, position: Position) => Effect.Effect<void, PlayerError>;
        updateVelocity: (id: PlayerId, velocity: Vector3) => Effect.Effect<void, PlayerError>;
        getPosition: (id: PlayerId) => Effect.Effect<Position, PlayerError>;
        getVelocity: (id: PlayerId) => Effect.Effect<Vector3, PlayerError>;
        getState: (id: PlayerId) => Effect.Effect<PlayerState, PlayerError>;
    }, never, never>;
}>;
export declare class PlayerService extends PlayerService_base {
}
export declare const PlayerServiceLive: import("effect/Layer").Layer<PlayerService, never, never>;
export {};
//# sourceMappingURL=player-service.d.ts.map