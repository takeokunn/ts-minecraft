import { describe,it } from '@effect/vitest'
import {
HealthService,
applyDamageToHealth,
computeFallDamage,
healHealth,
tickInvincibility,
} from '@ts-minecraft/entity'
import { Array as Arr,Effect } from 'effect'
import { expect } from 'vitest'
import { PlayerHealth } from '../domain/player-health'
import { INVINCIBILITY_TICKS_ON_HIT } from '../application/health-service.config'
// ─── Test helpers ─────────────────────────────────────────────────────────────

const withHealthService = <A>(
  f: (hs: HealthService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.flatMap(HealthService, f).pipe(Effect.provide(HealthService.Default))

// ─── applyDamageToHealth — pure ───────────────────────────────────────────────

describe('applyDamageToHealth', () => {
  const cases: ReadonlyArray<readonly [string, number, number, number, number, number]> = [
    ['reduces health by amount',          20, 0,  5,  15, 10],
    ['clamps at 0 on overkill',           20, 0,  100, 0, 10],
    ['zero amount is no-op',              20, 0,  0,  20,  0],
    ['negative amount is no-op',          20, 0, -5,  20,  0],
    ['no damage during invincibility',    15, 10, 5,  15, 10],
    ['no damage when already dead',        0,  0,  5,   0,  0],
  ]

  Arr.forEach(cases, ([label, current, invTicks, amount, expectedCurrent, expectedTicks]) => {
    it(label, () => {
      const h = new PlayerHealth({ current, max: 20, invincibilityTicks: invTicks })
      const result = applyDamageToHealth(h, amount)
      expect(result.current).toBe(expectedCurrent)
      expect(result.invincibilityTicks).toBe(expectedTicks)
    })
  })
})

// ─── healHealth — pure ────────────────────────────────────────────────────────

describe('healHealth', () => {
  const cases: ReadonlyArray<readonly [string, number, number, number]> = [
    ['increases health by amount',    10, 5, 15],
    ['clamps at max',                 18, 5, 20],
    ['zero amount is no-op',          10, 0, 10],
    ['negative amount is no-op',      10, -5, 10],
    ['full health stays at max',      20, 3, 20],
  ]

  Arr.forEach(cases, ([label, current, amount, expected]) => {
    it(label, () => {
      const h = new PlayerHealth({ current, max: 20, invincibilityTicks: 0 })
      expect(healHealth(h, amount).current).toBe(expected)
    })
  })
})

// ─── tickInvincibility — pure ─────────────────────────────────────────────────

describe('tickInvincibility', () => {
  it('decrements ticks when > 0', () => {
    const h = new PlayerHealth({ current: 15, max: 20, invincibilityTicks: 10 })
    expect(tickInvincibility(h).invincibilityTicks).toBe(9)
  })

  it('returns same instance when ticks are already 0', () => {
    const h = new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 })
    expect(tickInvincibility(h)).toBe(h)
  })
})

// ─── computeFallDamage — pure ─────────────────────────────────────────────────

describe('computeFallDamage', () => {
  const cases: ReadonlyArray<readonly [string, number, number, boolean, boolean, number]> = [
    ['small fall (2 blocks) → no damage',         70, 68, true,  true,  0],
    ['exact 3-block fall → no damage',            70, 67, true,  true,  0],
    ['4-block fall → 1 damage',                   70, 66, true,  true,  1],
    ['10-block fall → 7 damage',                  70, 60, true,  true,  7],
    // Fractional falls: vanilla rounds UP (ceil), so these guard against a floor regression.
    ['fractional 3.5-block fall → ceil = 1 damage', 70, 66.5, true, true, 1],
    ['fractional 4.5-block fall → ceil = 2 damage', 70, 65.5, true, true, 2],
    ['not grounded → no damage even if falling',  70, 60, true,  false, 0],
    ['was not falling → no damage on landing',    70, 60, false, true,  0],
  ]

  Arr.forEach(cases, ([label, prevY, currentY, wasFalling, isGrounded, expected]) => {
    it(label, () => {
      expect(computeFallDamage(prevY, currentY, wasFalling, isGrounded)).toBe(expected)
    })
  })
})

// ─── HealthService integration ────────────────────────────────────────────────

describe('HealthService initial state', () => {
  it.effect('starts at full health (20/20)', () =>
    withHealthService((hs) =>
      hs.getHealth().pipe(Effect.map((h) => {
        expect(h.current).toBe(20)
        expect(h.max).toBe(20)
        expect(h.invincibilityTicks).toBe(0)
      }))
    )
  )
})

describe('HealthService.applyDamage', () => {
  it.effect('reduces health', () =>
    withHealthService((hs) =>
      hs.applyDamage(5).pipe(
        Effect.andThen(hs.getHealth()),
        Effect.map((h) => expect(h.current).toBe(15)),
      )
    )
  )

  it.effect('cannot go below 0', () =>
    withHealthService((hs) =>
      hs.applyDamage(100).pipe(
        Effect.andThen(hs.getHealth()),
        Effect.map((h) => expect(h.current).toBe(0)),
      )
    )
  )

  it.effect('sets invincibility ticks on hit', () =>
    withHealthService((hs) =>
      hs.applyDamage(3).pipe(
        Effect.andThen(hs.getHealth()),
        Effect.map((h) => expect(h.invincibilityTicks).toBe(INVINCIBILITY_TICKS_ON_HIT)),
      )
    )
  )

  it.effect('zero amount is no-op', () =>
    withHealthService((hs) =>
      hs.applyDamage(0).pipe(
        Effect.andThen(hs.getHealth()),
        Effect.map((h) => {
          expect(h.current).toBe(20)
          expect(h.invincibilityTicks).toBe(0)
        }),
      )
    )
  )

  it.effect('negative amount is no-op', () =>
    withHealthService((hs) =>
      hs.applyDamage(-5).pipe(
        Effect.andThen(hs.getHealth()),
        Effect.map((h) => expect(h.current).toBe(20)),
      )
    )
  )

  it.effect('second hit during invincibility is ignored', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(3)   // health → 17, invincibilityTicks → INVINCIBILITY_TICKS_ON_HIT
        yield* hs.applyDamage(2)   // ignored
        const after = yield* hs.getHealth()
        expect(after.current).toBe(17)
        expect(after.invincibilityTicks).toBe(INVINCIBILITY_TICKS_ON_HIT)
      })
    )
  )
})

describe('HealthService.heal', () => {
  it.effect('increases health after damage', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(10)
        yield* hs.heal(5)
        const h = yield* hs.getHealth()
        expect(h.current).toBe(15)
      })
    )
  )

  it.effect('cannot exceed max', () =>
    withHealthService((hs) =>
      hs.heal(50).pipe(
        Effect.andThen(hs.getHealth()),
        Effect.map((h) => expect(h.current).toBe(20)),
      )
    )
  )

  it.effect('negative amount is no-op', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(8)
        const before = yield* hs.getHealth()
        yield* hs.heal(-5)
        const after = yield* hs.getHealth()
        expect(after.current).toBe(before.current)
      })
    )
  )
})

describe('HealthService.isDead', () => {
  it.effect('true when health reaches 0', () =>
    withHealthService((hs) =>
      hs.applyDamage(20).pipe(
        Effect.andThen(hs.isDead()),
        Effect.map((dead) => expect(dead).toBe(true)),
      )
    )
  )

  it.effect('false when health is above 0', () =>
    withHealthService((hs) =>
      hs.applyDamage(5).pipe(
        Effect.andThen(hs.isDead()),
        Effect.map((dead) => expect(dead).toBe(false)),
      )
    )
  )
})

describe('HealthService.tick', () => {
  it.effect('decrements invincibilityTicks', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(1)
        yield* hs.tick()
        const h = yield* hs.getHealth()
        expect(h.invincibilityTicks).toBe(9)
      })
    )
  )

  it.effect('ticks clamp at 0 and do not go negative', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(5)
        const { invincibilityTicks } = yield* hs.getHealth()
        yield* Effect.forEach(Arr.makeBy(invincibilityTicks + 5, () => undefined), () => hs.tick(), { concurrency: 1 })
        const after = yield* hs.getHealth()
        expect(after.invincibilityTicks).toBe(0)
      })
    )
  )
})
