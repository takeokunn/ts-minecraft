import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'
import { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import { resolveFishingWaitSecs } from '../domain/fishing-resolution'
import { expectSome } from './test-utils'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const withFishingService = <A>(
  f: (fs: FishingService) => Effect.Effect<A, never>,
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const fs = yield* FishingService
    return yield* f(fs)
  }).pipe(Effect.provide(FishingService.Default))

// Deterministic seed — produces a known wait time for precise tick tests.
const TEST_SEED = 42

// ─── Initial state ────────────────────────────────────────────────────────────

describe('FishingService — initial state', () => {
  it.effect('starts idle: isFishing returns false', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const fishing = yield* fs.isFishing()
        expect(fishing).toBe(false)
      })
    )
  )

  it.effect('starts idle: getProgress returns 0', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const progress = yield* fs.getProgress()
        expect(progress).toBe(0)
      })
    )
  )

  it.effect('tick while idle returns Option.none', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const result = yield* fs.tick(1)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  )
})

// ─── cast → casting state ─────────────────────────────────────────────────────

describe('FishingService — after cast', () => {
  it.effect('isFishing returns true after cast', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cast(TEST_SEED)
        const fishing = yield* fs.isFishing()
        expect(fishing).toBe(true)
      })
    )
  )

  it.effect('getProgress returns 0 immediately after cast', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cast(TEST_SEED)
        const progress = yield* fs.getProgress()
        expect(progress).toBe(0)
      })
    )
  )

  it.effect('tick with insufficient elapsed time returns Option.none', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cast(TEST_SEED)
        // targetSecs = resolveFishingWaitSecs(TEST_SEED) with no lure
        const result = yield* fs.tick(1)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  )

  it.effect('getProgress increases after partial tick', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        yield* fs.tick(targetSecs / 2)
        const progress = yield* fs.getProgress()
        expect(progress).toBeCloseTo(0.5, 5)
      })
    )
  )

  it.effect('getProgress is clamped to 1 at full wait time', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        yield* fs.tick(targetSecs - 0.001)
        const progress = yield* fs.getProgress()
        expect(progress).toBeLessThanOrEqual(1)
        expect(progress).toBeGreaterThan(0.99)
      })
    )
  )
})

// ─── catch ────────────────────────────────────────────────────────────────────

describe('FishingService — catch', () => {
  it.effect('tick past targetSecs returns Some(catch result)', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        const result = yield* fs.tick(targetSecs + 0.001)
        const catchResult = expectSome(result)
        expect(typeof catchResult.item).toBe('string')
        expect(catchResult.experience).toBeGreaterThanOrEqual(1)
        expect(catchResult.experience).toBeLessThanOrEqual(6)
      })
    )
  )

  it.effect('returns idle after a catch: isFishing is false', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        yield* fs.tick(targetSecs + 0.001)
        const fishing = yield* fs.isFishing()
        expect(fishing).toBe(false)
      })
    )
  )

  it.effect('subsequent tick after catch returns Option.none (idle again)', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        yield* fs.tick(targetSecs + 0.001)
        const secondTick = yield* fs.tick(1)
        expect(Option.isNone(secondTick)).toBe(true)
      })
    )
  )

  it.effect('multiple ticks accumulate elapsed time and trigger catch', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        // tick in small increments up to just under targetSecs
        yield* fs.tick(targetSecs / 4)
        yield* fs.tick(targetSecs / 4)
        yield* fs.tick(targetSecs / 4)
        const earlyResult = yield* fs.tick(targetSecs / 4 - 0.1)
        expect(Option.isNone(earlyResult)).toBe(true)
        // final tick pushes past the threshold
        const catchResult = yield* fs.tick(0.2)
        expectSome(catchResult)
      })
    )
  )
})

// ─── cancel ───────────────────────────────────────────────────────────────────

describe('FishingService — cancel', () => {
  it.effect('cancel while casting returns to idle', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cast(TEST_SEED)
        yield* fs.cancel()
        const fishing = yield* fs.isFishing()
        expect(fishing).toBe(false)
      })
    )
  )

  it.effect('cancel while idle is a no-op', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cancel()
        const fishing = yield* fs.isFishing()
        expect(fishing).toBe(false)
      })
    )
  )

  it.effect('tick after cancel returns Option.none', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cast(TEST_SEED)
        yield* fs.cancel()
        const result = yield* fs.tick(100)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  )

  it.effect('getProgress returns 0 after cancel', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const targetSecs = resolveFishingWaitSecs(TEST_SEED)
        yield* fs.cast(TEST_SEED)
        yield* fs.tick(targetSecs / 2)
        yield* fs.cancel()
        const progress = yield* fs.getProgress()
        expect(progress).toBe(0)
      })
    )
  )
})

// ─── reset ────────────────────────────────────────────────────────────────────

describe('FishingService — reset', () => {
  it.effect('reset is equivalent to cancel: returns to idle', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        yield* fs.cast(TEST_SEED)
        yield* fs.reset()
        const fishing = yield* fs.isFishing()
        expect(fishing).toBe(false)
      })
    )
  )
})

// ─── lure level ───────────────────────────────────────────────────────────────

describe('FishingService — lure level reduces wait time', () => {
  it.effect('lure level 1 reduces wait, catch triggers earlier', () =>
    withFishingService((fs) =>
      Effect.gen(function* () {
        const normalWait = resolveFishingWaitSecs(TEST_SEED, 0)
        const lureWait = resolveFishingWaitSecs(TEST_SEED, 1)
        expect(lureWait).toBeLessThan(normalWait)

        // Cast with lure and tick at exactly lureWait seconds
        yield* fs.cast(TEST_SEED, 1)
        const result = yield* fs.tick(lureWait + 0.001)
        expectSome(result)
      })
    )
  )
})
