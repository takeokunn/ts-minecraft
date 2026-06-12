import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { CropGrowthService, CropGrowthServiceLive } from '@ts-minecraft/world'
import { CROP_MAX_AGE, BONE_MEAL_ADVANCE } from '@ts-minecraft/world'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const withCropService = <A>(
  f: (cs: CropGrowthService) => Effect.Effect<A, never>,
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const cs = yield* CropGrowthService
    return yield* f(cs)
  }).pipe(Effect.provide(CropGrowthServiceLive))

const at = (x: number, y: number, z: number) => ({ x, y, z })

// ─── plant + harvest — basic lifecycle ───────────────────────────────────────

describe('CropGrowthService — plant / harvest', () => {
  it.effect('freshly planted crop is not ripe', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        const ripe = yield* cs.harvest(at(0, 64, 0))
        expect(ripe).toBe(false)
      })
    )
  )

  it.effect('untracked position is treated as ripe on harvest (world-generated crops)', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        const ripe = yield* cs.harvest(at(10, 64, 10))
        expect(ripe).toBe(true)
      })
    )
  )

  it.effect('harvest removes the crop from tracking (re-harvest returns ripe again)', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.harvest(at(0, 64, 0))
        const secondHarvest = yield* cs.harvest(at(0, 64, 0))
        // After removal, position is untracked → defaults to ripe
        expect(secondHarvest).toBe(true)
      })
    )
  )

  it.effect('two crops at different positions are independent', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.plant(at(5, 64, 5))
        const ripe1 = yield* cs.harvest(at(0, 64, 0))
        const ripe2 = yield* cs.harvest(at(5, 64, 5))
        expect(ripe1).toBe(false)
        expect(ripe2).toBe(false)
      })
    )
  )
})

// ─── tickAll — growth progression ────────────────────────────────────────────

describe('CropGrowthService — tickAll', () => {
  it.effect('one tick advances age and crop is not yet ripe', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.tickAll()
        // age=1, CROP_MAX_AGE=2 → still immature
        const ripe = yield* cs.harvest(at(0, 64, 0))
        expect(ripe).toBe(false)
      })
    )
  )

  it.effect(`${CROP_MAX_AGE} ticks bring crop to maturity`, () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        for (let i = 0; i < CROP_MAX_AGE; i++) yield* cs.tickAll()
        const ripe = yield* cs.harvest(at(0, 64, 0))
        expect(ripe).toBe(true)
      })
    )
  )

  it.effect('tickAll is a no-op beyond CROP_MAX_AGE (clamps, no overflow)', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        for (let i = 0; i < CROP_MAX_AGE + 5; i++) yield* cs.tickAll()
        const ripe = yield* cs.harvest(at(0, 64, 0))
        expect(ripe).toBe(true)
      })
    )
  )

  it.effect('tickAll advances all tracked crops in one call', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.plant(at(1, 64, 0))
        yield* cs.tickAll()
        // One more tick: both ripen together
        yield* cs.tickAll()
        const ripe1 = yield* cs.harvest(at(0, 64, 0))
        const ripe2 = yield* cs.harvest(at(1, 64, 0))
        expect(ripe1).toBe(true)
        expect(ripe2).toBe(true)
      })
    )
  )
})

// ─── advanceByBoneMeal ───────────────────────────────────────────────────────

describe('CropGrowthService — advanceByBoneMeal', () => {
  it.effect('bone meal on fresh crop advances it by BONE_MEAL_ADVANCE stages', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        const newAge = yield* cs.advanceByBoneMeal(at(0, 64, 0))
        expect(newAge).toBe(BONE_MEAL_ADVANCE)
      })
    )
  )

  it.effect('bone meal is enough to ripen a fresh crop in one use (BONE_MEAL_ADVANCE ≥ CROP_MAX_AGE)', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.advanceByBoneMeal(at(0, 64, 0))
        const ripe = yield* cs.harvest(at(0, 64, 0))
        expect(ripe).toBe(true)
      })
    )
  )

  it.effect('bone meal on untracked position returns CROP_MAX_AGE (treats as already ripe)', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        const age = yield* cs.advanceByBoneMeal(at(99, 64, 99))
        expect(age).toBe(CROP_MAX_AGE)
      })
    )
  )

  it.effect('bone meal clamps at CROP_MAX_AGE even when current + BONE_MEAL_ADVANCE would exceed it', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.tickAll() // age=1
        const age = yield* cs.advanceByBoneMeal(at(0, 64, 0))
        expect(age).toBe(CROP_MAX_AGE)
        expect(age).not.toBeGreaterThan(CROP_MAX_AGE)
      })
    )
  )
})

// ─── serialize / restore ──────────────────────────────────────────────────────

describe('CropGrowthService — serialize / restore', () => {
  it.effect('serialize returns empty record when no crops tracked', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        const data = yield* cs.serialize()
        expect(Object.keys(data)).toHaveLength(0)
      })
    )
  )

  it.effect('serialize captures current ages', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.tickAll() // age=1
        const data = yield* cs.serialize()
        expect(data['0,64,0']).toBe(1)
      })
    )
  )

  it.effect('restore loads ages and subsequent operations see them', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.restore({ '0,64,0': 1, '5,64,5': 0 })
        // age=1 → one more tick ripens it
        yield* cs.tickAll()
        const ripe1 = yield* cs.harvest(at(0, 64, 0))
        const ripe2 = yield* cs.harvest(at(5, 64, 5))
        expect(ripe1).toBe(true)
        expect(ripe2).toBe(false) // still needs 1 more tick
      })
    )
  )

  it.effect('restore overwrites previous state', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        yield* cs.plant(at(0, 64, 0))
        yield* cs.restore({}) // clear everything
        const ripe = yield* cs.harvest(at(0, 64, 0))
        // No tracked crop → defaults to ripe
        expect(ripe).toBe(true)
      })
    )
  )

  it.effect('serialize after restore returns the restored data', () =>
    withCropService((cs) =>
      Effect.gen(function* () {
        const saved = { '1,64,1': 0, '2,64,2': 2 }
        yield* cs.restore(saved)
        const data = yield* cs.serialize()
        expect(data['1,64,1']).toBe(0)
        expect(data['2,64,2']).toBe(2)
      })
    )
  )
})
