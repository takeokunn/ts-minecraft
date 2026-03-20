import { Effect, Option, Ref } from 'effect'
import { PlayerHealth } from '@/domain/player-health'

type FallState = { readonly prevY: Option.Option<number>; readonly isFalling: boolean }
const INITIAL_FALL_STATE: FallState = { prevY: Option.none(), isFalling: false }

export class HealthService extends Effect.Service<HealthService>()(
  '@minecraft/application/HealthService',
  {
    effect: Effect.gen(function* () {
      const healthRef = yield* Ref.make(new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 }))

      // Track previous Y and falling state atomically
      const fallStateRef = yield* Ref.make<FallState>(INITIAL_FALL_STATE)

      return {
        getHealth: (): Effect.Effect<PlayerHealth, never> => Ref.get(healthRef),

        applyDamage: (amount: number): Effect.Effect<void, never> =>
          amount <= 0
            ? Effect.void
            : Ref.update(healthRef, h => new PlayerHealth({
                current: Math.max(0, h.current - amount),
                max: h.max,
                invincibilityTicks: 10,
              })),

        heal: (amount: number): Effect.Effect<void, never> =>
          amount <= 0
            ? Effect.void
            : Ref.update(healthRef, h => new PlayerHealth({
                current: Math.min(h.max, h.current + amount),
                max: h.max,
                invincibilityTicks: h.invincibilityTicks,
              })),

        isDead: (): Effect.Effect<boolean, never> =>
          Ref.get(healthRef).pipe(Effect.map(h => h.current <= 0)),

        tick: (): Effect.Effect<void, never> =>
          Ref.update(healthRef, h => h.invincibilityTicks > 0
            ? new PlayerHealth({
                current: h.current,
                max: h.max,
                invincibilityTicks: h.invincibilityTicks - 1,
              })
            : h
          ),

        // Called each frame with current player Y position and grounded state.
        // Returns fall damage to apply (0 if no damage).
        processFallDamage: (currentY: number, isGrounded: boolean): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const { prevY: prevYOpt, isFalling: wasFalling } = yield* Ref.get(fallStateRef)

            if (Option.isNone(prevYOpt)) {
              // First frame: just record current Y, no damage possible yet
              yield* Ref.update(fallStateRef, (s) => ({ ...s, prevY: Option.some(currentY) }))
              return 0
            }

            const prevY = prevYOpt.value
            const falling = currentY < prevY

            // Atomically update both prevY and isFalling
            yield* Ref.update(fallStateRef, (_s) => ({
              prevY: Option.some(currentY),
              isFalling: falling,
            }))

            // Landing detection: was falling, now grounded
            if (wasFalling && isGrounded) {
              const fallDistance = prevY - currentY
              // Minecraft formula: damage = fallDistance - 3 (min 3 blocks to take damage)
              const damage = Math.max(0, Math.floor(fallDistance - 3))
              return damage
            }

            return 0
          }),

        reset: (): Effect.Effect<void, never> =>
          Effect.all([
            Ref.set(healthRef, new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 })),
            Ref.set(fallStateRef, INITIAL_FALL_STATE),
          ], { discard: true, concurrency: 'unbounded' }),
      }
    }),
  }
) {}
export const HealthServiceLive = HealthService.Default
