import { describe, it } from '@effect/vitest'
import {
  HungerService,
  PlayerHunger,
  addExhaustionToHunger,
  advanceFoodTimer,
  eatFood,
  applyExhaustionCascade,
} from '@ts-minecraft/entity'
import { Array as Arr, Effect } from 'effect'
import { expect } from 'vitest'
import {
  FOOD_TICK_INTERVAL,
  START_FOOD_LEVEL,
  START_SATURATION,
} from '../application/hunger-service.config'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const withHungerService = <A>(
  f: (hs: HungerService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.flatMap(HungerService, f).pipe(Effect.provide(HungerService.Default))

const full = () => new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 0 })

// ─── addExhaustionToHunger — pure ─────────────────────────────────────────────

describe('addExhaustionToHunger', () => {
  it('accumulates below the threshold without draining food', () => {
    const r = addExhaustionToHunger(full(), 1)
    expect(r.exhaustion).toBe(1)
    expect(r.saturation).toBe(5)
    expect(r.foodLevel).toBe(20)
  })

  it('zero amount is a no-op', () => {
    const h = full()
    expect(addExhaustionToHunger(h, 0)).toBe(h)
  })

  it('negative amount is a no-op', () => {
    const h = full()
    expect(addExhaustionToHunger(h, -5)).toBe(h)
  })

  it('non-finite amount is a no-op (guards against an Infinity-exhaustion stack overflow)', () => {
    const h = full()
    expect(addExhaustionToHunger(h, Infinity)).toBe(h)
    expect(addExhaustionToHunger(h, Number.NaN)).toBe(h)
  })

  it('one full threshold drains a saturation point first', () => {
    const r = addExhaustionToHunger(full(), 4)
    expect(r.saturation).toBe(4)
    expect(r.foodLevel).toBe(20)
    expect(r.exhaustion).toBe(0)
  })

  it('drains foodLevel once saturation is exhausted', () => {
    const drySat = new PlayerHunger({ foodLevel: 20, saturation: 0, exhaustion: 0 })
    const r = addExhaustionToHunger(drySat, 4)
    expect(r.foodLevel).toBe(19)
    expect(r.saturation).toBe(0)
  })

  it('a large add cascades fully — no residue ≥ threshold stranded', () => {
    // 5 saturation + 20 foodLevel = 25 points to drain = 100 exhaustion.
    const r = addExhaustionToHunger(full(), 100)
    expect(r.foodLevel).toBe(0)
    expect(r.saturation).toBe(0)
    expect(r.exhaustion).toBeLessThan(4)
  })

  // The model's central coupling: saturation is a reserve BEHIND foodLevel and
  // must never exceed it. The cascade drains saturation before foodLevel, so it
  // must preserve `saturation <= foodLevel` from any valid starting state — for
  // any exhaustion amount, across all three food tiers. (eatFood's invariant is
  // tested separately; this pins the cascade side.)
  it('preserves saturation <= foodLevel through any cascade', () => {
    for (const foodLevel of [1, 5, 10, 20]) {
      for (const saturation of [0, Math.floor(foodLevel / 2), foodLevel]) {
        for (const amount of [1, 4, 8, 50, 100, 250]) {
          const start = new PlayerHunger({ foodLevel, saturation, exhaustion: 0 })
          const r = addExhaustionToHunger(start, amount)
          expect(r.saturation).toBeLessThanOrEqual(r.foodLevel)
          expect(r.saturation).toBeGreaterThanOrEqual(0)
          expect(r.foodLevel).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})

// ─── applyExhaustionCascade — pure ────────────────────────────────────────────

describe('applyExhaustionCascade', () => {
  it('drains saturation when exhaustion reaches 4', () => {
    const h = new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 4 })
    const r = applyExhaustionCascade(h)
    expect(r.saturation).toBe(4)
    expect(r.exhaustion).toBe(0)
  })

  it('returns the same state when exhaustion is below threshold', () => {
    const h = new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 2 })
    const r = applyExhaustionCascade(h)
    expect(r.saturation).toBe(5)
    expect(r.exhaustion).toBe(2)
  })
})

// ─── eatFood — pure ───────────────────────────────────────────────────────────

describe('eatFood', () => {
  it('restores foodLevel and saturation (bread: 5 food, 0.6 modifier)', () => {
    const hungry = new PlayerHunger({ foodLevel: 10, saturation: 0, exhaustion: 0 })
    const r = eatFood(hungry, 5, 0.6)
    expect(r.foodLevel).toBe(15)
    expect(r.saturation).toBeCloseTo(6) // 5 * 0.6 * 2
  })

  it('clamps foodLevel at the maximum', () => {
    const r = eatFood(full(), 5, 0.6)
    expect(r.foodLevel).toBe(20)
  })

  it('never lets saturation exceed foodLevel', () => {
    const tiny = new PlayerHunger({ foodLevel: 2, saturation: 0, exhaustion: 0 })
    const r = eatFood(tiny, 1, 1.0) // would gain 2 saturation, but foodLevel only 3
    expect(r.saturation).toBeLessThanOrEqual(r.foodLevel)
  })

  it('zero or negative food is a no-op', () => {
    const h = full()
    expect(eatFood(h, 0, 0.6)).toBe(h)
    expect(eatFood(h, -3, 0.6)).toBe(h)
  })
})

// ─── advanceFoodTimer — pure ──────────────────────────────────────────────────

describe('advanceFoodTimer', () => {
  it('returns "none" and bumps the timer before the interval', () => {
    const [effect, state] = advanceFoodTimer({ hunger: full(), tickTimer: 0 })
    expect(effect).toBe('none')
    expect(state.tickTimer).toBe(1)
  })

  it('regenerates when well-fed at the interval boundary, charging exhaustion', () => {
    const [effect, state] = advanceFoodTimer({ hunger: full(), tickTimer: FOOD_TICK_INTERVAL - 1 })
    expect(effect).toBe('regen')
    expect(state.tickTimer).toBe(0)
    // EXHAUSTION_PER_REGEN (6) cascades: drains 1 saturation, leaves exhaustion 2.
    expect(state.hunger.saturation).toBe(START_SATURATION - 1)
  })

  it('does NOT regen (or charge exhaustion) when canRegen is false, even when well-fed', () => {
    // Full health → canRegen false → an idle player must not drain food (vanilla).
    const [effect, state] = advanceFoodTimer({ hunger: full(), tickTimer: FOOD_TICK_INTERVAL - 1 }, FOOD_TICK_INTERVAL, 18, 6, 4, false)
    expect(effect).toBe('none')
    expect(state.hunger.saturation).toBe(START_SATURATION) // unchanged — no exhaustion charged
  })

  it('starves when foodLevel is empty at the interval boundary', () => {
    const starving = new PlayerHunger({ foodLevel: 0, saturation: 0, exhaustion: 0 })
    const [effect] = advanceFoodTimer({ hunger: starving, tickTimer: FOOD_TICK_INTERVAL - 1 })
    expect(effect).toBe('starve')
  })

  it('does nothing at the boundary when food is mid-range', () => {
    const mid = new PlayerHunger({ foodLevel: 10, saturation: 0, exhaustion: 0 })
    const [effect] = advanceFoodTimer({ hunger: mid, tickTimer: FOOD_TICK_INTERVAL - 1 })
    expect(effect).toBe('none')
  })
})

// ─── HungerService integration ────────────────────────────────────────────────

describe('HungerService initial state', () => {
  it.effect('starts full with the spawn saturation reserve', () =>
    withHungerService((hs) =>
      hs.getHunger().pipe(Effect.map((h) => {
        expect(h.foodLevel).toBe(START_FOOD_LEVEL)
        expect(h.saturation).toBe(START_SATURATION)
        expect(h.exhaustion).toBe(0)
      }))
    )
  )
})

describe('HungerService.eat / addExhaustion', () => {
  it.effect('eating after draining restores foodLevel', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        yield* hs.addExhaustion(100) // drains to empty
        yield* hs.eat(8, 0.8)        // cooked meat-ish
        const h = yield* hs.getHunger()
        expect(h.foodLevel).toBe(8)
      })
    )
  )
})

describe('HungerService.tick', () => {
  it.effect('emits "none" until the interval, then "regen" when well-fed', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          Arr.makeBy(FOOD_TICK_INTERVAL, () => undefined),
          () => hs.tick(true),
          { concurrency: 1 },
        )
        expect(Arr.every(Arr.take(results, FOOD_TICK_INTERVAL - 1), (r) => r === 'none')).toBe(true)
        expect(results[FOOD_TICK_INTERVAL - 1]).toBe('regen')
      })
    )
  )

  it.effect('does not regen (or drain food) at the interval when canRegen is false', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(
          Arr.makeBy(FOOD_TICK_INTERVAL, () => undefined),
          () => hs.tick(false), // full health → regen suppressed
          { concurrency: 1 },
        )
        expect(Arr.every(results, (r) => r === 'none')).toBe(true)
        const h = yield* hs.getHunger()
        expect(h.foodLevel).toBe(START_FOOD_LEVEL)
        expect(h.saturation).toBe(START_SATURATION) // no exhaustion charged while full
      })
    )
  )

  it.effect('emits "starve" at the interval once the player is starving', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        yield* hs.addExhaustion(100) // foodLevel → 0
        const results = yield* Effect.forEach(
          Arr.makeBy(FOOD_TICK_INTERVAL, () => undefined),
          () => hs.tick(true),
          { concurrency: 1 },
        )
        expect(results[FOOD_TICK_INTERVAL - 1]).toBe('starve')
      })
    )
  )
})

describe('HungerService.restore', () => {
  it.effect('sets foodLevel and saturation to the restored values', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        yield* hs.restore(8, 3)
        const h = yield* hs.getHunger()
        expect(h.foodLevel).toBe(8)
        expect(h.saturation).toBe(3)
        expect(h.exhaustion).toBe(0)
      })
    )
  )

  it.effect('clamps saturation to never exceed the restored foodLevel', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        yield* hs.restore(4, 19) // saturation would exceed foodLevel
        const h = yield* hs.getHunger()
        expect(h.saturation).toBeLessThanOrEqual(h.foodLevel)
      })
    )
  )

  it.effect('clamps foodLevel into the valid 0..20 range', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        yield* hs.restore(99, 0)
        const h = yield* hs.getHunger()
        expect(h.foodLevel).toBe(20)
      })
    )
  )
})

describe('HungerService.reset', () => {
  it.effect('restores the initial spawn state', () =>
    withHungerService((hs) =>
      Effect.gen(function* () {
        yield* hs.addExhaustion(100)
        yield* hs.reset()
        const h = yield* hs.getHunger()
        expect(h.foodLevel).toBe(START_FOOD_LEVEL)
        expect(h.saturation).toBe(START_SATURATION)
      })
    )
  )
})
