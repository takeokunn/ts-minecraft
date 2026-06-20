import { describe,it } from '@effect/vitest'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { Effect } from 'effect'
import { expect } from 'vitest'

describe('player/health-service — fall damage', () => {
  it.effect('processFallDamage returns > 0 after simulated fall of 10 blocks then grounded', () =>
    Effect.gen(function* () {
      const healthService = yield* HealthService

      // Frame 1: player at Y=10 (not grounded, prevY not set yet)
      const d0 = yield* healthService.processFallDamage(10, false)

      // Frame 2: player at Y=5 (falling, not grounded) — descent accumulates
      const d1 = yield* healthService.processFallDamage(5, false)

      // Frame 3: player lands at Y=0, grounded. The full fall is Y=10 → Y=0 = 10
      // blocks (accumulated across frames), so damage = ceil(10 - 3) = 7.
      const d2 = yield* healthService.processFallDamage(0, true)

      const totalDamage = d0 + d1 + d2
      expect(totalDamage).toBeGreaterThan(0)
      expect(totalDamage).toBe(7) // ceil(10 - 3) — the whole fall, not just the last frame
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('processFallDamage returns 0 when fall distance is exactly 3 blocks (safe threshold)', () =>
    Effect.gen(function* () {
      const healthService = yield* HealthService

      // Frame 1: set prevY=3
      yield* healthService.processFallDamage(3, false)
      // Frame 2: falling from 3 to 0 (distance=3), sets isFallingRef=true
      yield* healthService.processFallDamage(0, false)
      // Frame 3: land (grounded), fallDistance = 3, damage = floor(3-3) = 0
      const damage = yield* healthService.processFallDamage(0, true)

      expect(damage).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('processFallDamage returns 0 when fall distance is 4 blocks and landing is not grounded', () =>
    Effect.gen(function* () {
      const healthService = yield* HealthService

      yield* healthService.processFallDamage(10, false) // set prevY
      yield* healthService.processFallDamage(5, false)  // falling
      // Landing check: isGrounded=false → no damage
      const damage = yield* healthService.processFallDamage(0, false)

      expect(damage).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )
})
