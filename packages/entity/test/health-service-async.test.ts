import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Fiber } from 'effect'
import { HealthService } from '@ts-minecraft/entity'

const withHealthService = <A>(
  f: (hs: HealthService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.flatMap(HealthService, f).pipe(Effect.provide(HealthService.Default))

describe('HealthService.processFallDamage', () => {
  it.effect('first call initializes state and returns 0', () =>
    withHealthService((hs) =>
      hs.processFallDamage(70, true).pipe(
        Effect.map((damage) => expect(damage).toBe(0)),
      )
    )
  )

  it.effect('small fall (< 3 blocks) deals no damage', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.processFallDamage(70, false)
        const damage = yield* hs.processFallDamage(68, true)
        expect(damage).toBe(0)
      })
    )
  )

  it.effect('10-block fall deals 7 damage', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.processFallDamage(80, false) // initialize
        yield* hs.processFallDamage(70, false) // falling
        const damage = yield* hs.processFallDamage(60, true) // land
        expect(damage).toBe(7)
      })
    )
  )

  it.effect('rising after a fall resets isFalling so landing deals no damage', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.processFallDamage(50, false)  // initialize prevY = 50
        yield* hs.processFallDamage(40, false)  // fall → isFalling = true
        yield* hs.processFallDamage(45, false)  // rise → isFalling = false
        const damage = yield* hs.processFallDamage(45, true)  // land while not falling
        expect(damage).toBe(0)
      })
    )
  )
})

describe('HealthService.reset', () => {
  it.effect('restores full health', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(15)
        yield* hs.reset()
        const h = yield* hs.getHealth()
        expect(h.current).toBe(20)
        expect(h.invincibilityTicks).toBe(0)
      })
    )
  )

  it.effect('clears fall state — processFallDamage returns 0 on first call after reset', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.processFallDamage(80, false)
        yield* hs.processFallDamage(70, false)
        const beforeReset = yield* hs.processFallDamage(60, true)
        expect(beforeReset).toBe(7)

        yield* hs.reset()

        const afterReset = yield* hs.processFallDamage(80, true)
        expect(afterReset).toBe(0)
      })
    )
  )
})

describe('HealthService.awaitDeath', () => {
  it.effect('resolves immediately when player is already dead (health <= 0)', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(1000)  // lethal damage → health drops to 0
        // awaitDeath must resolve synchronously when already dead
        yield* hs.awaitDeath()
        const dead = yield* hs.isDead()
        expect(dead).toBe(true)
      })
    )
  )

  it('resolves after lethal damage is applied (Deferred path)', () =>
    Effect.runPromise(
      withHealthService((hs) =>
        Effect.gen(function* () {
          // Fork awaitDeath while player is alive — it waits on a Deferred
          const fiber = yield* Effect.fork(hs.awaitDeath())
          // Kill the player — this triggers the deferred
          yield* hs.applyDamage(1000)
          // Joining fiber must complete (deferred resolved)
          yield* Fiber.join(fiber)
          const dead = yield* hs.isDead()
          expect(dead).toBe(true)
        })
      )
    )
  )

  it('awaitDeath blocks again after reset — fresh Deferred installed', () =>
    Effect.runPromise(
      withHealthService((hs) =>
        Effect.gen(function* () {
          // Trigger first death cycle
          yield* hs.applyDamage(1000)
          yield* hs.awaitDeath()

          // Reset to living state
          yield* hs.reset()
          expect(yield* hs.isDead()).toBe(false)

          // Fork awaitDeath for second death cycle — must block (not resolve immediately)
          const fiber = yield* Effect.fork(hs.awaitDeath())

          // Trigger second death
          yield* hs.applyDamage(1000)

          // Fiber must resolve after second kill (not stuck forever)
          yield* Fiber.join(fiber)
          expect(yield* hs.isDead()).toBe(true)
        })
      )
    )
  )
})
