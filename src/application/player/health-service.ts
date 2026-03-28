import { Effect, Option, Ref } from 'effect'
import { PlayerHealth } from '@/domain/player-health'

type FallState = { readonly prevY: Option.Option<number>; readonly isFalling: boolean }

type HealthState = {
  readonly health: PlayerHealth
  readonly fallState: FallState
}

const INITIAL_STATE: HealthState = {
  health: new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 }),
  fallState: { prevY: Option.none(), isFalling: false },
}

export class HealthService extends Effect.Service<HealthService>()(
  '@minecraft/application/HealthService',
  {
    effect: Effect.gen(function* () {
      // Single Ref for all health-related state — reset() is atomic, coupling is explicit
      const stateRef = yield* Ref.make<HealthState>(INITIAL_STATE)

      return {
        getHealth: (): Effect.Effect<PlayerHealth, never> =>
          Ref.get(stateRef).pipe(Effect.map((s) => s.health)),

        applyDamage: (amount: number): Effect.Effect<void, never> =>
          amount <= 0
            ? Effect.void
            : Ref.update(stateRef, (s) => ({
                ...s,
                health: new PlayerHealth({
                  current: Math.max(0, s.health.current - amount),
                  max: s.health.max,
                  invincibilityTicks: 10,
                }),
              })),

        heal: (amount: number): Effect.Effect<void, never> =>
          amount <= 0
            ? Effect.void
            : Ref.update(stateRef, (s) => ({
                ...s,
                health: new PlayerHealth({
                  current: Math.min(s.health.max, s.health.current + amount),
                  max: s.health.max,
                  invincibilityTicks: s.health.invincibilityTicks,
                }),
              })),

        isDead: (): Effect.Effect<boolean, never> =>
          Ref.get(stateRef).pipe(Effect.map((s) => s.health.current <= 0)),

        tick: (): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) =>
            s.health.invincibilityTicks > 0
              ? {
                  ...s,
                  health: new PlayerHealth({
                    current: s.health.current,
                    max: s.health.max,
                    invincibilityTicks: s.health.invincibilityTicks - 1,
                  }),
                }
              : s
          ),

        // Called each frame with current player Y position and grounded state.
        // Returns fall damage to apply (0 if no damage).
        processFallDamage: (currentY: number, isGrounded: boolean): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const { fallState: { prevY: prevYOpt, isFalling: wasFalling } } = yield* Ref.get(stateRef)

            return yield* Option.match(prevYOpt, {
              onNone: () => Effect.gen(function* () {
                // First frame: just record current Y, no damage possible yet
                yield* Ref.update(stateRef, (s) => ({
                  ...s,
                  fallState: { ...s.fallState, prevY: Option.some(currentY) },
                }))
                return 0
              }),
              onSome: (prevY) => Effect.gen(function* () {
                const falling = currentY < prevY
                yield* Ref.update(stateRef, (s) => ({
                  ...s,
                  fallState: { prevY: Option.some(currentY), isFalling: falling },
                }))
                // Landing detection: was falling, now grounded
                // Minecraft formula: damage = fallDistance - 3 (min 3 blocks to take damage)
                return wasFalling && isGrounded
                  ? Math.max(0, Math.floor(prevY - currentY - 3))
                  : 0
              }),
            })
          }),

        // Atomic reset: single Ref.set restores both health and fall state simultaneously
        reset: (): Effect.Effect<void, never> =>
          Ref.set(stateRef, INITIAL_STATE),
      }
    }),
  }
) {}
export const HealthServiceLive = HealthService.Default
