import { Deferred, Effect, Option, Ref } from 'effect'
import { PlayerHealth } from '@ts-minecraft/domain'
import { INVINCIBILITY_TICKS_ON_HIT, PLAYER_MAX_HEALTH, PLAYER_START_HEALTH, FALL_DAMAGE_FREE_BLOCKS } from './health-service.config'

// ─── Types ────────────────────────────────────────────────────────────────────

type FallState = { readonly prevY: Option.Option<number>; readonly isFalling: boolean }

type HealthState = {
  readonly health: PlayerHealth
  readonly fallState: FallState
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: HealthState = {
  health: new PlayerHealth({ current: PLAYER_START_HEALTH, max: PLAYER_MAX_HEALTH, invincibilityTicks: 0 }),
  fallState: { prevY: Option.none(), isFalling: false },
}

// ─── Pure health transformers ─────────────────────────────────────────────────

export const applyDamageToHealth = (health: PlayerHealth, amount: number): PlayerHealth => {
  if (amount <= 0) return health
  if (health.current <= 0 || health.invincibilityTicks > 0) return health
  return new PlayerHealth({
    current: Math.max(0, health.current - amount),
    max: health.max,
    invincibilityTicks: INVINCIBILITY_TICKS_ON_HIT,
  })
}

export const healHealth = (health: PlayerHealth, amount: number): PlayerHealth => {
  if (amount <= 0) return health
  return new PlayerHealth({
    current: Math.min(health.max, health.current + amount),
    max: health.max,
    invincibilityTicks: health.invincibilityTicks,
  })
}

export const tickInvincibility = (health: PlayerHealth): PlayerHealth =>
  health.invincibilityTicks > 0
    ? new PlayerHealth({
        current: health.current,
        max: health.max,
        invincibilityTicks: health.invincibilityTicks - 1,
      })
    : health

/**
 * Compute fall damage on landing.
 * Minecraft formula: damage = fallDistance - 3 (min 3 blocks to take damage).
 */
export const computeFallDamage = (
  prevY: number,
  currentY: number,
  wasFalling: boolean,
  isGrounded: boolean,
): number =>
  wasFalling && isGrounded ? Math.max(0, Math.floor(prevY - currentY - FALL_DAMAGE_FREE_BLOCKS)) : 0

// ─── Service ─────────────────────────────────────────────────────────────────

export class HealthService extends Effect.Service<HealthService>()(
  '@minecraft/application/HealthService',
  {
    // Single Ref for all health-related state — reset() is atomic.
    // Death is signaled through a one-shot Deferred held in a Ref so reset()
    // can swap in a fresh deferred for the next death cycle. The death-screen
    // service awaits this deferred to drive the overlay; in-frame death detection
    // continues to rely on `isDead()` for synchronous (per-frame) reads.
    effect: Effect.all([
      Ref.make<HealthState>(INITIAL_STATE),
      Deferred.make<void, never>().pipe(Effect.flatMap((d) => Ref.make(d))),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([stateRef, deathDeferredRef]) => {
      // Atomic damage-with-death-signal: returns true when this damage caused death
      // (i.e. health crossed from > 0 to ≤ 0 on this call). Used internally to
      // fulfill the death deferred exactly once per death.
      const applyDamageInternal = (amount: number): Effect.Effect<boolean, never> =>
        Ref.modify(stateRef, (s) => {
          const wasAlive = s.health.current > 0
          const next = applyDamageToHealth(s.health, amount)
          const justDied = wasAlive && next.current <= 0
          return [justDied, { ...s, health: next }] as const
        })

      const signalDeath = (): Effect.Effect<void, never> =>
        Ref.get(deathDeferredRef).pipe(
          Effect.flatMap((d) => Deferred.succeed(d, undefined)),
          Effect.asVoid,
        )

      return {
        getHealth: (): Effect.Effect<PlayerHealth, never> =>
          Ref.get(stateRef).pipe(Effect.map((s) => s.health)),

        applyDamage: (amount: number): Effect.Effect<void, never> =>
          applyDamageInternal(amount).pipe(
            Effect.flatMap((justDied) => (justDied ? signalDeath() : Effect.void)),
          ),

        heal: (amount: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({ ...s, health: healHealth(s.health, amount) })),

        isDead: (): Effect.Effect<boolean, never> =>
          Ref.get(stateRef).pipe(Effect.map((s) => s.health.current <= 0)),

        /**
         * Block until the player dies. Resolves immediately if already dead.
         * Single-shot per death cycle: after `reset()` a fresh deferred is installed,
         * so the next `awaitDeath()` call waits for the next death.
         */
        awaitDeath: (): Effect.Effect<void, never> =>
          Ref.get(stateRef).pipe(
            Effect.flatMap((s) =>
              s.health.current <= 0
                ? Effect.void
                : Ref.get(deathDeferredRef).pipe(Effect.flatMap(Deferred.await)),
            ),
          ),

        tick: (): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({ ...s, health: tickInvincibility(s.health) })),

        processFallDamage: (currentY: number, isGrounded: boolean): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const { fallState: { prevY: prevYOpt, isFalling: wasFalling } } = yield* Ref.get(stateRef)

            return yield* Option.match(prevYOpt, {
              onNone: () =>
                Ref.update(stateRef, (s) => ({
                  ...s,
                  fallState: { ...s.fallState, prevY: Option.some(currentY) },
                })).pipe(Effect.as(0)),

              onSome: (prevY) => {
                const falling = currentY < prevY
                const damage = computeFallDamage(prevY, currentY, wasFalling, isGrounded)
                return Ref.update(stateRef, (s) => ({
                  ...s,
                  fallState: { prevY: Option.some(currentY), isFalling: falling },
                })).pipe(Effect.as(damage))
              },
            })
          }),

        // Atomic reset: restores health/fall state AND swaps in a fresh death
        // deferred so the next death cycle can be awaited from scratch.
        reset: (): Effect.Effect<void, never> =>
          Effect.all(
            [
              Ref.set(stateRef, INITIAL_STATE),
              Deferred.make<void, never>().pipe(Effect.flatMap((fresh) => Ref.set(deathDeferredRef, fresh))),
            ],
            { concurrency: 'unbounded', discard: true },
          ),
      }
    }))
  }
) {}
export const HealthServiceLive = HealthService.Default
