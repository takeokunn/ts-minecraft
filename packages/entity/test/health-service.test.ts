import { describe,it } from '@effect/vitest'
import { HealthService } from '@ts-minecraft/entity/application/health-service';
import {
  applyDamageToHealth,
  computeFallDamage,
  healHealth,
  tickInvincibility,
} from '@ts-minecraft/entity/domain/player-health-resolution'
import { Array as Arr,Effect } from 'effect'
import { expect } from 'vitest'
import { PlayerHealth } from '../domain/player-health'
import { INVINCIBILITY_TICKS_ON_HIT } from '../application/health-service.config'
// ─── Test helpers ─────────────────────────────────────────────────────────────

const withHealthService = <A>(
  f: (hs: HealthService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.gen(function* () {
    const hs = yield* HealthService
    return yield* f(hs)
  }).pipe(Effect.provide(HealthService.Default))

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
      Effect.gen(function* () {
        const h = yield* hs.getHealth()
        expect(h.current).toBe(20)
        expect(h.max).toBe(20)
        expect(h.invincibilityTicks).toBe(0)
      })
    )
  )
})

describe('HealthService.applyDamage', () => {
  it.effect('reduces health', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(5)
        const h = yield* hs.getHealth()
        expect(h.current).toBe(15)
      })
    )
  )

  it.effect('cannot go below 0', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(100)
        const h = yield* hs.getHealth()
        expect(h.current).toBe(0)
      })
    )
  )

  it.effect('records a lethal damage cause for the death message', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(100, { kind: 'fall' })
        expect(yield* hs.getDeathMessage()).toBe('You hit the ground too hard.')
      })
    )
  )

  it.effect('uses the generic death message when no lethal damage cause is supplied', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(100)
        expect(yield* hs.getDeathMessage()).toBe('You died.')
      })
    )
  )

  it.effect('does not record non-lethal damage causes as death messages', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(5, { kind: 'lava' })
        expect(yield* hs.getDeathMessage()).toBe('You died.')
      })
    )
  )

  it.effect('clears the death cause on reset', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(100, { kind: 'void' })
        yield* hs.reset()
        expect(yield* hs.getDeathMessage()).toBe('You died.')
      })
    )
  )

  it.effect('sets invincibility ticks on hit', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(3)
        const h = yield* hs.getHealth()
        expect(h.invincibilityTicks).toBe(INVINCIBILITY_TICKS_ON_HIT)
      })
    )
  )

  it.effect('zero amount is no-op', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(0)
        const h = yield* hs.getHealth()
        expect(h.current).toBe(20)
        expect(h.invincibilityTicks).toBe(0)
      })
    )
  )

  it.effect('negative amount is no-op', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(-5)
        const h = yield* hs.getHealth()
        expect(h.current).toBe(20)
      })
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
      Effect.gen(function* () {
        yield* hs.heal(50)
        const h = yield* hs.getHealth()
        expect(h.current).toBe(20)
      })
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
      Effect.gen(function* () {
        yield* hs.applyDamage(20)
        expect(yield* hs.isDead()).toBe(true)
      })
    )
  )

  it.effect('false when health is above 0', () =>
    withHealthService((hs) =>
      Effect.gen(function* () {
        yield* hs.applyDamage(5)
        expect(yield* hs.isDead()).toBe(false)
      })
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

describe('HealthService status effects', () => {
  it.effect('Regeneration heals through tick() on its vanilla cadence', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.applyDamage(10)
      yield* health.tick() // burn a tick so invincibility from damage elapses independently
      yield* health.addStatusEffect('REGENERATION', 0, 10)
      for (let i = 0; i < 50; i++) {
        yield* health.tick()
      }
      const after = yield* health.getHealth()
      expect(after.current).toBe(11) // 20 - 10 + 1 regen fire at tick 50
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('Poison damages over time but never below 1 HP', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.applyDamage(17) // 3 HP left
      yield* health.addStatusEffect('POISON', 1, 30)
      for (let i = 0; i < 600; i++) {
        yield* health.tick()
      }
      const after = yield* health.getHealth()
      expect(after.current).toBe(1)
      expect(yield* health.isDead()).toBe(false)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('expired effects disappear from getStatusEffects', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('REGENERATION', 0, 0.1) // 2 ticks
      yield* health.tick()
      yield* health.tick()
      const effects = yield* health.getStatusEffects()
      expect(effects).toHaveLength(0)
    }).pipe(Effect.provide(HealthService.Default)),
  )
})

describe('HealthService absorption (golden hearts)', () => {
  it.effect('applying ABSORPTION fills the pool to 4 HP per level', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 0, 120)
      expect(yield* health.getAbsorption()).toBe(4)
      yield* health.addStatusEffect('ABSORPTION', 3, 120)
      expect(yield* health.getAbsorption()).toBe(16)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('absorption soaks damage before health and grants i-frames on a fully soaked hit', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 0, 120)
      yield* health.applyDamage(3)
      expect(yield* health.getAbsorption()).toBe(1)
      const after = yield* health.getHealth()
      expect(after.current).toBe(20)
      expect(after.invincibilityTicks).toBeGreaterThan(0)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('overflow damage past the pool reaches health', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 0, 120)
      yield* health.applyDamage(10)
      expect(yield* health.getAbsorption()).toBe(0)
      expect((yield* health.getHealth()).current).toBe(14) // 20 - (10 - 4)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('the pool never regenerates and vanishes when the effect expires', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 0, 0.15) // 3 ticks
      yield* health.applyDamage(1)
      expect(yield* health.getAbsorption()).toBe(3)
      yield* health.tick()
      expect(yield* health.getAbsorption()).toBe(3) // still active: no regen, no wipe
      yield* health.tick()
      yield* health.tick()
      expect(yield* health.getAbsorption()).toBe(0) // effect expired → pool gone
      expect((yield* health.getHealth()).current).toBe(20)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('a weaker re-application does not shrink the pool; equal-strength refills it', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 1, 120) // 8 HP
      yield* health.applyDamage(3)
      expect(yield* health.getAbsorption()).toBe(5)
      yield* health.addStatusEffect('ABSORPTION', 0, 120) // weaker: ignored by upsert
      expect(yield* health.getAbsorption()).toBe(5)
      yield* health.addStatusEffect('ABSORPTION', 1, 120) // equal strength: refill
      expect(yield* health.getAbsorption()).toBe(8)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('poison consumes absorption before gnawing health', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 0, 120)
      yield* health.addStatusEffect('POISON', 0, 10) // fires every 25 ticks
      for (let i = 0; i < 100; i++) {
        yield* health.tick()
      }
      // 4 poison fires: all soaked by the 4-HP pool, health untouched.
      expect(yield* health.getAbsorption()).toBe(0)
      expect((yield* health.getHealth()).current).toBe(20)
    }).pipe(Effect.provide(HealthService.Default)),
  )

  it.effect('reset clears the pool', () =>
    Effect.gen(function* () {
      const health = yield* HealthService
      yield* health.addStatusEffect('ABSORPTION', 0, 120)
      yield* health.reset()
      expect(yield* health.getAbsorption()).toBe(0)
    }).pipe(Effect.provide(HealthService.Default)),
  )
})
