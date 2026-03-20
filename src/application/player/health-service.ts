import { Effect, Option, Ref } from 'effect'
import { PlayerHealth } from '@/domain/player-health'

export class HealthService extends Effect.Service<HealthService>()(
  '@minecraft/application/HealthService',
  {
    effect: Effect.gen(function* () {
      const healthRef = yield* Ref.make(new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 }))

      // Track previous Y for fall distance detection
      const prevYRef = yield* Ref.make<Option.Option<number>>(Option.none())
      const isFallingRef = yield* Ref.make(false)

      return {
        getHealth: (): Effect.Effect<PlayerHealth> => Ref.get(healthRef),

        applyDamage: (amount: number): Effect.Effect<void> =>
          amount <= 0
            ? Effect.void
            : Ref.update(healthRef, h => new PlayerHealth({
                current: Math.max(0, h.current - amount),
                max: h.max,
                invincibilityTicks: 10,
              })),

        heal: (amount: number): Effect.Effect<void> =>
          amount <= 0
            ? Effect.void
            : Ref.update(healthRef, h => new PlayerHealth({
                current: Math.min(h.max, h.current + amount),
                max: h.max,
                invincibilityTicks: h.invincibilityTicks,
              })),

        isDead: (): Effect.Effect<boolean> =>
          Ref.get(healthRef).pipe(Effect.map(h => h.current <= 0)),

        tick: (): Effect.Effect<void> =>
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
        processFallDamage: (currentY: number, isGrounded: boolean): Effect.Effect<number> =>
          Effect.gen(function* () {
            const prevYOpt = yield* Ref.get(prevYRef)
            const wasFalling = yield* Ref.get(isFallingRef)

            // Update previous Y
            yield* Ref.set(prevYRef, Option.some(currentY))

            if (Option.isNone(prevYOpt)) return 0

            const prevY = prevYOpt.value
            const falling = currentY < prevY
            yield* Ref.set(isFallingRef, falling)

            // Landing detection: was falling, now grounded
            if (wasFalling && isGrounded) {
              const fallDistance = prevY - currentY
              // Minecraft formula: damage = fallDistance - 3 (min 3 blocks to take damage)
              const damage = Math.max(0, Math.floor(fallDistance - 3))
              return damage
            }

            return 0
          }),

        reset: (): Effect.Effect<void> =>
          Effect.all([
            Ref.set(healthRef, new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 })),
            Ref.set(prevYRef, Option.none()),
            Ref.set(isFallingRef, false),
          ], { discard: true }),
      }
    }),
  }
) {}
export const HealthServiceLive = HealthService.Default
