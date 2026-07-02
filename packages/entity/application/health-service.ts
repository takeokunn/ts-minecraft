import { Deferred, Effect, Option, Ref } from 'effect'
import { PlayerHealth } from '../domain/player-health'
import {
  advanceStatusEffectsOneTick,
  makeStatusEffect,
  upsertStatusEffect,
  type ActiveStatusEffect,
  type StatusEffectType,
} from '../domain/status-effect'
import {
  applyDamageToHealth,
  computeFallDamage,
  healHealth,
  tickInvincibility,
} from '../domain/player-health-resolution'
import { type PlayerDamageCause, describePlayerDeath } from '../domain/player-damage-cause'
import { PLAYER_MAX_HEALTH, PLAYER_START_HEALTH } from './health-service.config'

// ─── Types ────────────────────────────────────────────────────────────────────

// `prevY` is the previous frame's Y; `fallDistance` accumulates total descent since
// the player last touched ground (reset on landing or any upward motion), so fall
// damage reflects the WHOLE fall — a single frame's drop is capped at ~1.6 blocks
// (terminal velocity × dt) and could never reach the 3-block damage threshold alone.
type FallState = { readonly prevY: Option.Option<number>; readonly fallDistance: number }

type HealthState = {
  readonly health: PlayerHealth
  readonly fallState: FallState
  readonly lastDeathCause: Option.Option<PlayerDamageCause>
  readonly statusEffects: ReadonlyArray<ActiveStatusEffect>
}

const DEFAULT_DAMAGE_CAUSE: PlayerDamageCause = { kind: 'generic' }


// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: HealthState = {
  health: new PlayerHealth({ current: PLAYER_START_HEALTH, max: PLAYER_MAX_HEALTH, invincibilityTicks: 0 }),
  fallState: { prevY: Option.none(), fallDistance: 0 },
  lastDeathCause: Option.none(),
  statusEffects: [],
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class HealthService extends Effect.Service<HealthService>()(
  '@minecraft/application/HealthService',
  {
    // Single Ref for all health-related state — reset() is atomic.
    // Death is signaled through a one-shot Deferred held in a Ref so reset()
    // can swap in a fresh deferred for the next death cycle. The death-screen
    // service awaits this deferred to drive the overlay; in-frame death detection
    // continues to rely on `isDead()` for synchronous (per-frame) reads.
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<HealthState>(INITIAL_STATE)
      const initialDeferred = yield* Deferred.make<void, never>()
      const deathDeferredRef = yield* Ref.make(initialDeferred)
      // Atomic damage-with-death-signal: returns true when this damage caused death
      // (i.e. health crossed from > 0 to ≤ 0 on this call). Used internally to
      // fulfill the death deferred exactly once per death.
      const applyDamageInternal = (
        amount: number,
        cause: PlayerDamageCause = DEFAULT_DAMAGE_CAUSE,
      ): Effect.Effect<boolean, never> =>
        Ref.modify(stateRef, (s) => {
          const wasAlive = s.health.current > 0
          const next = applyDamageToHealth(s.health, amount)
          const justDied = wasAlive && next.current <= 0
          return [
            justDied,
            {
              ...s,
              health: next,
              lastDeathCause: justDied ? Option.some(cause) : s.lastDeathCause,
            },
          ] as const
        })

      const signalDeath = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const d = yield* Ref.get(deathDeferredRef)
          yield* Deferred.succeed(d, undefined)
        })

      return {
        getHealth: (): Effect.Effect<PlayerHealth, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef)
            return s.health
          }),

        applyDamage: (amount: number, cause?: PlayerDamageCause): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const justDied = yield* applyDamageInternal(amount, cause)
            if (justDied) yield* signalDeath()
          }),

        heal: (amount: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({ ...s, health: healHealth(s.health, amount) })),

        isDead: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef)
            return s.health.current <= 0
          }),

        getDeathMessage: (): Effect.Effect<string, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef)
            return describePlayerDeath(Option.getOrNull(s.lastDeathCause))
          }),

        // Single-shot per death cycle: reset() installs a fresh deferred, so the next
        // awaitDeath() waits for the next death rather than resolving immediately.
        awaitDeath: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef)
            /* c8 ignore next 2 -- immediately resolves when already dead */
            if (s.health.current <= 0) return
            yield* Deferred.await(yield* Ref.get(deathDeferredRef))
          }),

        // Runs on the fixed HEALTH_TICK cadence (one game tick): invincibility
        // countdown plus the status-effect ticker. Regeneration heals through
        // the normal heal path; poison bypasses invincibility frames but can
        // never kill (vanilla: poison floors at 1 HP).
        tick: (): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => {
            const ticked = advanceStatusEffectsOneTick(s.statusEffects)
            let health = tickInvincibility(s.health)
            if (ticked.healAmount > 0) {
              health = healHealth(health, ticked.healAmount)
            }
            if (ticked.poisonDamage > 0 && health.current > 1) {
              health = new PlayerHealth({
                current: Math.max(1, health.current - ticked.poisonDamage),
                max: health.max,
                invincibilityTicks: health.invincibilityTicks,
              })
            }
            return { ...s, health, statusEffects: ticked.effects }
          }),

        addStatusEffect: (
          type: StatusEffectType,
          amplifier: number,
          durationSecs: number,
        ): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({
            ...s,
            statusEffects: upsertStatusEffect(s.statusEffects, makeStatusEffect(type, amplifier, durationSecs)),
          })),

        getStatusEffects: (): Effect.Effect<ReadonlyArray<ActiveStatusEffect>, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef)
            return s.statusEffects
          }),

        processFallDamage: (currentY: number, isGrounded: boolean): Effect.Effect<number, never> =>
          /* c8 ignore next -- non-finite Y guard: physics always produces finite positions */
          !Number.isFinite(currentY) ? Effect.succeed(0) :
          Ref.modify(stateRef, (s): readonly [number, HealthState] => {
            const { prevY: prevYOpt, fallDistance } = s.fallState
            const prevY = Option.getOrNull(prevYOpt)
            if (prevY === null) {
              return [0, { ...s, fallState: { prevY: Option.some(currentY), fallDistance: 0 } }]
            }
            // Accumulate the descent across frames; any upward motion cancels the
            // running fall (vanilla resets fallDistance on ascent). Damage is
            // assessed only on the landing frame, from the TOTAL accumulated drop.
            const frameDrop = prevY - currentY
            // Descent (or a stationary landing frame) accumulates; only genuine
            // upward motion cancels the running fall — so reaching the ground a
            // frame before `isGrounded` registers does not discard the descent.
            const accumulated = frameDrop < 0 ? 0 : fallDistance + frameDrop
            // Pass `currentY + accumulated` so computeFallDamage measures the full
            // fall (prevY − currentY === accumulated) without changing its contract.
            const damage = computeFallDamage(currentY + accumulated, currentY, accumulated > 0, isGrounded)
            return [
              damage,
              { ...s, fallState: { prevY: Option.some(currentY), fallDistance: isGrounded ? 0 : accumulated } },
            ]
          }),

        // Atomic reset: restores health/fall state AND swaps in a fresh death
        // deferred so the next death cycle can be awaited from scratch.
        reset: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(stateRef, INITIAL_STATE)
            const fresh = yield* Deferred.make<void, never>()
            yield* Ref.set(deathDeferredRef, fresh)
          }),
      }
    }),
  }
) {}
