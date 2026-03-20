import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
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
  // PlayerHealth schema's between(0, 20) constraint. The Schema.Class
  // constructor throws a ParseError as a defect. This test documents that
  // applyDamage with a negative value is a defect (not a typed error).
  it.effect('applyDamage with negative amount causes a defect (Schema.Class constructor rejects value > 20)', () =>
    Effect.gen(function* () {
      const hs = yield* HealthService
      // applyDamage(-5) computes Math.max(0, 20 - (-5)) = 25, which exceeds
      // the schema bound. Wrapping in Effect.sandbox lets us observe the defect.
      const exit = yield* hs.applyDamage(-5).pipe(Effect.sandbox, Effect.either)
      // Must fail — either as a typed error or a defect
      expect(exit._tag).toBe('Left')
    }).pipe(Effect.provide(HealthService.Default))
  )
})
