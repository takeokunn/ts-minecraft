import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { CropGrowthService } from './crop-growth-service'

const runWith = <A>(eff: Effect.Effect<A, never, CropGrowthService>) =>
  Effect.runPromise(Effect.provide(eff, CropGrowthService.Default))

describe('CropGrowthService.serialize', () => {
  it('returns an empty Record when nothing has been planted', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        return yield* svc.serialize()
      }),
    )
    expect(result).toEqual({})
  })

  it('includes planted crops at their current age', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.plant({ x: 1, y: 64, z: 2 })
        yield* svc.tickAll()        // age 0 → 1
        return yield* svc.serialize()
      }),
    )
    expect(result['1,64,2']).toBe(1)
  })

  it('does not include harvested crops', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.plant({ x: 3, y: 64, z: 4 })
        yield* svc.harvest({ x: 3, y: 64, z: 4 })
        return yield* svc.serialize()
      }),
    )
    expect(result['3,64,4']).toBeUndefined()
  })
})

describe('CropGrowthService.restore', () => {
  it('restores crop ages from a plain Record', async () => {
    const cropAges = { '5,64,6': 1, '7,64,8': 2 }
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.restore(cropAges)
        return yield* svc.serialize()
      }),
    )
    expect(result).toEqual(cropAges)
  })

  it('restored ripe crop (age 2) is harvestable', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.restore({ '0,64,0': 2 })
        return yield* svc.harvest({ x: 0, y: 64, z: 0 })
      }),
    )
    expect(result).toBe(true)
  })

  it('restored young crop (age 0) is not harvestable', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.restore({ '0,64,0': 0 })
        return yield* svc.harvest({ x: 0, y: 64, z: 0 })
      }),
    )
    expect(result).toBe(false)
  })

  it('replaces existing tracking state on restore', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.plant({ x: 9, y: 64, z: 9 })
        yield* svc.restore({ '1,64,1': 2 })  // wiped: 9,64,9 gone; only 1,64,1 at age 2
        return yield* svc.serialize()
      }),
    )
    expect(result['9,64,9']).toBeUndefined()
    expect(result['1,64,1']).toBe(2)
  })
})

describe('CropGrowthService.advanceByBoneMeal', () => {
  it('advances a young crop (age 0) by 2 → ripe (age 2)', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.plant({ x: 0, y: 64, z: 0 })
        return yield* svc.advanceByBoneMeal({ x: 0, y: 64, z: 0 })
      }),
    )
    expect(result).toBe(2)
  })

  it('clamps at CROP_MAX_AGE (already ripe stays at 2)', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        yield* svc.restore({ '0,64,0': 2 })
        return yield* svc.advanceByBoneMeal({ x: 0, y: 64, z: 0 })
      }),
    )
    expect(result).toBe(2)
  })

  it('untracked crop (world-generated) is treated as max age and stays at 2', async () => {
    const result = await runWith(
      Effect.gen(function* () {
        const svc = yield* CropGrowthService
        return yield* svc.advanceByBoneMeal({ x: 5, y: 64, z: 5 })
      }),
    )
    expect(result).toBe(2)
  })
})
