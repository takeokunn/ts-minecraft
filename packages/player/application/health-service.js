import { Deferred, Effect, Option, Ref } from 'effect';
import { PlayerHealth } from '../domain/player-health';
import { INVINCIBILITY_TICKS_ON_HIT, PLAYER_MAX_HEALTH, PLAYER_START_HEALTH, FALL_DAMAGE_FREE_BLOCKS } from './health-service.config';
// ─── Initial state ────────────────────────────────────────────────────────────
const INITIAL_STATE = {
    health: new PlayerHealth({ current: PLAYER_START_HEALTH, max: PLAYER_MAX_HEALTH, invincibilityTicks: 0 }),
    fallState: { prevY: Option.none(), isFalling: false },
};
// ─── Pure health transformers ─────────────────────────────────────────────────
export const applyDamageToHealth = (health, amount) => {
    if (amount <= 0)
        return health;
    if (health.current <= 0 || health.invincibilityTicks > 0)
        return health;
    return new PlayerHealth({
        current: Math.max(0, health.current - amount),
        max: health.max,
        invincibilityTicks: INVINCIBILITY_TICKS_ON_HIT,
    });
};
export const healHealth = (health, amount) => {
    if (amount <= 0)
        return health;
    return new PlayerHealth({
        current: Math.min(health.max, health.current + amount),
        max: health.max,
        invincibilityTicks: health.invincibilityTicks,
    });
};
export const tickInvincibility = (health) => health.invincibilityTicks > 0
    ? new PlayerHealth({
        current: health.current,
        max: health.max,
        invincibilityTicks: health.invincibilityTicks - 1,
    })
    : health;
// Minecraft formula: damage = fallDistance - FALL_DAMAGE_FREE_BLOCKS (min 3 blocks free).
export const computeFallDamage = (prevY, currentY, wasFalling, isGrounded) => wasFalling && isGrounded ? Math.max(0, Math.floor(prevY - currentY - FALL_DAMAGE_FREE_BLOCKS)) : 0;
// ─── Service ─────────────────────────────────────────────────────────────────
export class HealthService extends Effect.Service()('@minecraft/application/HealthService', {
    // Single Ref for all health-related state — reset() is atomic.
    // Death is signaled through a one-shot Deferred held in a Ref so reset()
    // can swap in a fresh deferred for the next death cycle. The death-screen
    // service awaits this deferred to drive the overlay; in-frame death detection
    // continues to rely on `isDead()` for synchronous (per-frame) reads.
    effect: Effect.all([
        Ref.make(INITIAL_STATE),
        Deferred.make().pipe(Effect.flatMap((d) => Ref.make(d))),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([stateRef, deathDeferredRef]) => {
        // Atomic damage-with-death-signal: returns true when this damage caused death
        // (i.e. health crossed from > 0 to ≤ 0 on this call). Used internally to
        // fulfill the death deferred exactly once per death.
        const applyDamageInternal = (amount) => Ref.modify(stateRef, (s) => {
            const wasAlive = s.health.current > 0;
            const next = applyDamageToHealth(s.health, amount);
            const justDied = wasAlive && next.current <= 0;
            return [justDied, { ...s, health: next }];
        });
        const signalDeath = () => Ref.get(deathDeferredRef).pipe(Effect.flatMap((d) => Deferred.succeed(d, undefined)), Effect.asVoid);
        return {
            getHealth: () => Ref.get(stateRef).pipe(Effect.map((s) => s.health)),
            applyDamage: (amount) => applyDamageInternal(amount).pipe(Effect.flatMap((justDied) => (justDied ? signalDeath() : Effect.void))),
            heal: (amount) => Ref.update(stateRef, (s) => ({ ...s, health: healHealth(s.health, amount) })),
            isDead: () => Ref.get(stateRef).pipe(Effect.map((s) => s.health.current <= 0)),
            // Single-shot per death cycle: reset() installs a fresh deferred, so the next
            // awaitDeath() waits for the next death rather than resolving immediately.
            awaitDeath: () => Ref.get(stateRef).pipe(Effect.flatMap((s) => 
            /* c8 ignore next 3 */
            s.health.current <= 0
                ? Effect.void
                : Ref.get(deathDeferredRef).pipe(Effect.flatMap(Deferred.await)))),
            tick: () => Ref.update(stateRef, (s) => ({ ...s, health: tickInvincibility(s.health) })),
            processFallDamage: (currentY, isGrounded) => !Number.isFinite(currentY) ? Effect.succeed(0) :
                Ref.modify(stateRef, (s) => {
                    const { prevY: prevYOpt, isFalling: wasFalling } = s.fallState;
                    return Option.match(prevYOpt, {
                        onNone: () => [
                            0,
                            { ...s, fallState: { ...s.fallState, prevY: Option.some(currentY) } },
                        ],
                        onSome: (prevY) => {
                            const falling = currentY < prevY;
                            const damage = computeFallDamage(prevY, currentY, wasFalling, isGrounded);
                            return [
                                damage,
                                { ...s, fallState: { prevY: Option.some(currentY), isFalling: falling } },
                            ];
                        },
                    });
                }),
            // Atomic reset: restores health/fall state AND swaps in a fresh death
            // deferred so the next death cycle can be awaited from scratch.
            reset: () => Effect.all([
                Ref.set(stateRef, INITIAL_STATE),
                Deferred.make().pipe(Effect.flatMap((fresh) => Ref.set(deathDeferredRef, fresh))),
            ], { concurrency: 'unbounded', discard: true }),
        };
    }))
}) {
}
export const HealthServiceLive = HealthService.Default;
//# sourceMappingURL=health-service.js.map