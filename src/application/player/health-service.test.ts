import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import { HealthService } from '@/application/player/health-service'

describe('HealthService', () => {
  it.effect('starts at full health', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(20)
      expect(health['max']).toBe(20)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('applyDamage reduces health', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(5)
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(15)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('applyDamage cannot go below 0', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(100)
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('heal increases health', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(10)
      yield* hs.heal(5)
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(15)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('heal cannot exceed max', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.heal(50)
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(20)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('isDead returns true when current === 0', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(20)
      const dead = yield* hs.isDead()
      expect(dead).toBe(true)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('isDead returns false when health is above 0', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(5)
      const dead = yield* hs.isDead()
      expect(dead).toBe(false)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('invincibilityTicks decrements on tick', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(1) // sets invincibilityTicks to 10
      const before = yield* hs.getHealth()
      expect(before['invincibilityTicks']).toBe(10)
      yield* hs.tick()
      const after = yield* hs.getHealth()
      expect(after['invincibilityTicks']).toBe(9)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('processFallDamage returns 0 for small falls (< 3 blocks)', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      // First call initializes prevY
      yield* hs.processFallDamage(70, false)
      // Fall 2 blocks (below 3-block threshold)
      const damage = yield* hs.processFallDamage(68, true)
      expect(damage).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('processFallDamage returns correct damage for large falls', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      // Initialize prevY at high position, mark as falling
      yield* hs.processFallDamage(80, false)
      // Fall 10 blocks while falling (not grounded yet)
      yield* hs.processFallDamage(70, false)
      // Land — was falling, now grounded; fallDistance = 70-60 = 10, damage = floor(10-3) = 7
      const damage = yield* hs.processFallDamage(60, true)
      expect(damage).toBe(7)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('reset restores full health', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(15)
      yield* hs.reset()
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(20)
      expect(health['invincibilityTicks']).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('applyDamage sets invincibilityTicks on damage', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(3)
      const health = yield* hs.getHealth()
      expect(health['invincibilityTicks']).toBe(10)
    }).pipe(Effect.provide(HealthService.Default))
  )

  // C3: applyDamage(0) is a no-op
  it.effect('applyDamage(0) leaves health unchanged at full', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(0)
      const health = yield* hs.getHealth()
      expect(health['current']).toBe(20)
      expect(health['max']).toBe(20)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('applyDamage(0) does not change invincibilityTicks', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(0)
      const health = yield* hs.getHealth()
      // amount is 0, so the condition `amount > 0` is false — ticks stay at 0
      expect(health['invincibilityTicks']).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('applyDamage(0) after taking damage leaves health unchanged', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(8)
      const before = yield* hs.getHealth()
      yield* hs.applyDamage(0)
      const after = yield* hs.getHealth()
      expect(after['current']).toBe(before['current'])
    }).pipe(Effect.provide(HealthService.Default))
  )

  // C3: negative damage — Math.max(0, 20 - (-5)) = 25, which violates
  // Guard: applyDamage with a non-positive amount is a no-op.
  // Previously this caused a Schema.Class defect because Math.max(0, 20-(-5))=25
  // exceeded the between(0,20) bound. The amount<=0 early-return prevents that.
  it.effect('applyDamage with negative amount is a no-op (health unchanged)', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(-5)
      const health = yield* hs.getHealth()
      expect(health.current).toBe(20)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('heal with negative amount is a no-op (health unchanged)', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(8)
      const before = yield* hs.getHealth()
      yield* hs.heal(-5)
      const after = yield* hs.getHealth()
      expect(after.current).toBe(before.current)
    }).pipe(Effect.provide(HealthService.Default))
  )

  it.effect('applyDamage during invincibilityTicks still reduces health (caller must gate it)', () =>
    // Documents that HealthService does NOT internally gate applyDamage on invincibilityTicks.
    // The invincibility window is a signal to the caller; enforcement is the caller's responsibility.
    Effect.gen(function* () {
      const hs = yield* HealthService
      yield* hs.applyDamage(3)   // health → 17, invincibilityTicks → 10
      const mid = yield* hs.getHealth()
      expect(mid.invincibilityTicks).toBe(10)
      yield* hs.applyDamage(2)   // still applies while ticks > 0
      const after = yield* hs.getHealth()
      expect(after.current).toBe(15)
    }).pipe(Effect.provide(HealthService.Default))
  )

  // ---------------------------------------------------------------------------
  // Task 3: reset clears prevYRef
  // ---------------------------------------------------------------------------

  describe('reset clears internal refs', () => {
    it.effect('processFallDamage returns 0 immediately after reset (prevYRef cleared)', () =>
      Effect.gen(function* () {
        const hs = yield* HealthService

        // Initialize prevYRef and set isFallingRef to true
        yield* hs.processFallDamage(80, false)  // prevY = 80
        yield* hs.processFallDamage(70, false)  // prevY = 70, isFalling = true (70 < 80)
        // Trigger fall damage to confirm state is active
        const damageBeforeReset = yield* hs.processFallDamage(60, true)  // wasFalling=true, grounded → damage = floor(70-60-3) = 7
        expect(damageBeforeReset).toBe(7)

        // Reset clears prevYRef to Option.none() and isFallingRef to false
        yield* hs.reset()

        // After reset, prevYRef is None → processFallDamage returns 0 immediately on first call
        const damageAfterReset = yield* hs.processFallDamage(80, true)
        expect(damageAfterReset).toBe(0)
      }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect('invincibilityTicks clamps to 0 and does not go negative after many ticks', () =>
      Effect.gen(function* () {
        const hs = yield* HealthService

        yield* hs.applyDamage(5)  // invincibilityTicks → 10
        const healthAfterDamage = yield* hs.getHealth()
        const initialTicks = healthAfterDamage['invincibilityTicks']
        expect(initialTicks).toBe(10)

        // Tick initialTicks + 5 extra times (more than enough to reach 0)
        yield* Effect.forEach(Arr.makeBy(initialTicks + 5, () => undefined), () => hs.tick(), { concurrency: 1 })

        const healthAfterTicks = yield* hs.getHealth()
        // tick() only decrements when > 0, so it should clamp at 0 and not go negative
        expect(healthAfterTicks['invincibilityTicks']).toBe(0)
      }).pipe(Effect.provide(HealthService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Task 4: rising after a fall resets isFalling → no damage on landing
  // ---------------------------------------------------------------------------

  it.effect('rising after a fall resets isFalling so landing does not trigger damage', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService

      // Step 1: initialize prevY = 50
      yield* hs.processFallDamage(50, false)

      // Step 2: fall to 40 → currentY(40) < prevY(50) → isFalling = true
      yield* hs.processFallDamage(40, false)

      // Step 3: rise to 45 → currentY(45) > prevY(40) → falling = false → isFalling set to false
      yield* hs.processFallDamage(45, false)

      // Step 4: ground at 45 — wasFalling is false (was reset in step 3), so no damage
      const damage = yield* hs.processFallDamage(45, true)
      expect(damage).toBe(0)
    }).pipe(Effect.provide(HealthService.Default))
  )
})
