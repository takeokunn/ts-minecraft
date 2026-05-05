import { describe,it } from '@effect/vitest'
import { HealthService } from '@ts-minecraft/player'
import { Effect } from 'effect'
import { expect } from 'vitest'

describe('player/health-service — fall damage', () => {
  it.effect('processFallDamage returns > 0 after simulated fall of 10 blocks then grounded', () =>
    Effect.gen(function* () {
      const healthService = yield* HealthService

      // Frame 1: player at Y=10 (not grounded, not falling yet — prevY not set)
      const d0 = yield* healthService.processFallDamage(10, false)

      // Frame 2: player at Y=5 (falling, not grounded) → sets isFallingRef=true
      const d1 = yield* healthService.processFallDamage(5, false)

      // Frame 3: player at Y=0 (grounded after falling from 5→0 = 5 blocks)
      // wasFalling=true, isGrounded=true → damage = floor(5 - 3) = 2
      const d2 = yield* healthService.processFallDamage(0, true)

      const totalDamage = d0 + d1 + d2
      expect(totalDamage).toBeGreaterThan(0)
      expect(totalDamage).toBe(2) // floor(5 - 3) = 2
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
