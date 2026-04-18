import { Effect, Option, Ref } from 'effect'
import { PlayerHealth } from '@/domain/player-health'
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
    // Single Ref for all health-related state — reset() is atomic
    effect: Ref.make<HealthState>(INITIAL_STATE).pipe(Effect.map((stateRef) => ({

      getHealth: (): Effect.Effect<PlayerHealth, never> =>
        Ref.get(stateRef).pipe(Effect.map((s) => s.health)),

      applyDamage: (amount: number): Effect.Effect<void, never> =>
        Ref.update(stateRef, (s) => ({ ...s, health: applyDamageToHealth(s.health, amount) })),

      heal: (amount: number): Effect.Effect<void, never> =>
        Ref.update(stateRef, (s) => ({ ...s, health: healHealth(s.health, amount) })),

      isDead: (): Effect.Effect<boolean, never> =>
        Ref.get(stateRef).pipe(Effect.map((s) => s.health.current <= 0)),

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

      // Atomic reset: single Ref.set restores both health and fall state simultaneously
      reset: (): Effect.Effect<void, never> =>
        Ref.set(stateRef, INITIAL_STATE),
    })))
  }
) {}
export const HealthServiceLive = HealthService.Default
