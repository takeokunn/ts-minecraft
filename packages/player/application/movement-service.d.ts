import { Effect, Schema } from 'effect';
import type { Vector3 } from '@ts-minecraft/kernel';
import { MetersPerSec } from '@ts-minecraft/kernel';
import { PlayerInputService } from './player-input-service';
export declare const MovementInputSchema: Schema.Struct<{
    forward: typeof Schema.Boolean;
    backward: typeof Schema.Boolean;
    left: typeof Schema.Boolean;
    right: typeof Schema.Boolean;
    jump: typeof Schema.Boolean;
    sprint: typeof Schema.Boolean;
}>;
export type MovementInput = Schema.Schema.Type<typeof MovementInputSchema>;
export declare const DEFAULT_WALK_SPEED: MetersPerSec;
export declare const DEFAULT_SPRINT_SPEED: MetersPerSec;
export declare const DEFAULT_JUMP_VELOCITY: MetersPerSec;
export declare const computeVelocity: (input: MovementInput, yaw: number, isGrounded: boolean) => {
    x: number;
    y: number;
    z: number;
};
declare const MovementService_base: Effect.Service.Class<MovementService, "@minecraft/application/MovementService", {
    readonly effect: Effect.Effect<{
        getInput: () => Effect.Effect<MovementInput, never>;
        calculateVelocity: (input: MovementInput, yaw: number, isGrounded: boolean) => Effect.Effect<Vector3, never>;
        update: (yaw: number, isGrounded: boolean) => Effect.Effect<Vector3, never>;
    }, never, PlayerInputService>;
}>;
export declare class MovementService extends MovementService_base {
}
export declare const MovementServiceLive: import("effect/Layer").Layer<MovementService, never, PlayerInputService>;
export {};
//# sourceMappingURL=movement-service.d.ts.map