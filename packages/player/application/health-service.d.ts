import { Effect } from 'effect';
import { PlayerHealth } from '../domain/player-health';
export declare const applyDamageToHealth: (health: PlayerHealth, amount: number) => PlayerHealth;
export declare const healHealth: (health: PlayerHealth, amount: number) => PlayerHealth;
export declare const tickInvincibility: (health: PlayerHealth) => PlayerHealth;
export declare const computeFallDamage: (prevY: number, currentY: number, wasFalling: boolean, isGrounded: boolean) => number;
declare const HealthService_base: Effect.Service.Class<HealthService, "@minecraft/application/HealthService", {
    readonly effect: Effect.Effect<{
        getHealth: () => Effect.Effect<PlayerHealth, never>;
        applyDamage: (amount: number) => Effect.Effect<void, never>;
        heal: (amount: number) => Effect.Effect<void, never>;
        isDead: () => Effect.Effect<boolean, never>;
        awaitDeath: () => Effect.Effect<void, never>;
        tick: () => Effect.Effect<void, never>;
        processFallDamage: (currentY: number, isGrounded: boolean) => Effect.Effect<number, never>;
        reset: () => Effect.Effect<void, never>;
    }, never, never>;
}>;
export declare class HealthService extends HealthService_base {
}
export declare const HealthServiceLive: import("effect/Layer").Layer<HealthService, never, never>;
export {};
//# sourceMappingURL=health-service.d.ts.map