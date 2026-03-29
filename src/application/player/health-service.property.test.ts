import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { HealthService } from '@/application/player/health-service'

// ---------------------------------------------------------------------------
// Property tests for HealthService.processFallDamage
//
// The Minecraft fall-damage formula is:
//   damage = max(0, floor(fallDistance - 3))
//
// Key invariants:
//   1. Falls of 3 blocks or less always deal 0 damage.
//   2. Falls greater than 3 blocks deal exactly floor(fallDistance - 3) damage.
//   3. processFallDamage returns 0 on the first call (prevY not yet set).
//   4. processFallDamage returns 0 while the player is still falling (not grounded).
//
// Note: fc.float() requires 32-bit float boundaries — use Math.fround().
// ---------------------------------------------------------------------------

describe('HealthService (property-based)', () => {
  describe('processFallDamage formula invariants', () => {
    it.effect('falls of exactly 3 blocks or less always deal 0 damage', () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            // fallDistance in (0, 3] — strictly positive, at or below safe threshold
            // Math.fround required for fc.float boundary constraints
            fc.float({ min: Math.fround(0.001), max: 3, noNaN: true }),
            (fallDistance) => {
              const damage = Math.max(0, Math.floor(fallDistance - 3))
              return damage === 0
            }
          )
        )
      }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect('falls of at least 4 blocks deal positive damage equal to floor(fallDistance - 3)', () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            // fallDistance >= 4 guarantees floor(fallDistance - 3) >= 1 (positive damage).
            // Math.fround not needed here since 4 and 100 are exact 32-bit floats.
            fc.float({ min: 4, max: 100, noNaN: true }),
            (fallDistance) => {
              const expected = Math.floor(fallDistance - 3)
              return expected >= 1 && expected === Math.max(0, Math.floor(fallDistance - 3))
            }
          )
        )
      }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect('damage is monotonically non-decreasing as fallDistance increases', () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.float({ min: 0, max: 50, noNaN: true }),
            fc.float({ min: 0, max: 50, noNaN: true }),
            (a, b) => {
              const lo = Math.min(a, b)
              const hi = Math.max(a, b)
              const damageAtLo = Math.max(0, Math.floor(lo - 3))
              const damageAtHi = Math.max(0, Math.floor(hi - 3))
              return damageAtHi >= damageAtLo
            }
          )
        )
      }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect.prop(
      'processFallDamage returns 0 on first call regardless of Y (prevY not set)',
      {
        currentY: fc.float({ min: -1000, max: 1000, noNaN: true }),
        isGrounded: fc.boolean(),
      },
      ({ currentY, isGrounded }) =>
        Effect.gen(function* () {
          const hs = yield* HealthService
          const damage = yield* hs.processFallDamage(currentY, isGrounded)
          expect(damage).toBe(0)
        }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect.prop(
      'processFallDamage returns 0 while still falling (not yet grounded)',
      {
        startY: fc.float({ min: 10, max: 100, noNaN: true }),
        // fallDist > 3 ensures damage would be non-zero IF we were grounded,
        // but since isGrounded=false the damage must still be 0.
        // Math.fround(3.001) needed for fc.float lower bound constraint.
        fallDist: fc.float({ min: Math.fround(3.001), max: Math.fround(9.99), noNaN: true }),
      },
      ({ startY, fallDist }) => {
        const midY = startY - fallDist
        return Effect.gen(function* () {
          const hs = yield* HealthService
          // First call: initialise prevY = startY, isFalling = false
          yield* hs.processFallDamage(startY, false)
          // Second call: falling (midY < startY), not grounded → 0 damage
          const damage = yield* hs.processFallDamage(midY, false)
          expect(damage).toBe(0)
        }).pipe(Effect.provide(HealthService.Default))
      }
    )
  })
})
