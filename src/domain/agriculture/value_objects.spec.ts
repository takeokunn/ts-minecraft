import { describe, expect, it } from '@effect/vitest'
import { Effect, Either, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { DomainConstants, DomainError } from './types'
import {
  BreedingOutcome,
  HydrationState,
  SoilCondition,
  adjustMoistureLevel,
  adjustSoilQuality,
  advanceGrowthStage,
  describeGrowthStage,
  describeMoisture,
  describeSoil,
  evaluateBreedingOutcome,
  makeBreedingStats,
  makeBreedingStatsEither,
  makeGrowthStage,
  makeMoistureLevel,
  makeSoilQuality,
  mergeBreedingStats,
  summarizeValueObjects,
} from './value_objects'

const propertyConfig: fc.Parameters = { numRuns: 64 }

const stageArbitrary = fc.integer({
  min: DomainConstants.growthStage.min,
  max: DomainConstants.growthStage.max,
})

const moistureArbitrary = fc.integer({
  min: DomainConstants.moistureLevel.min,
  max: DomainConstants.moistureLevel.max,
})

const soilArbitrary = fc.integer({
  min: DomainConstants.soilQuality.min,
  max: DomainConstants.soilQuality.max,
})

const breedingArbitrary = fc.record({
  fertility: fc.float({
    min: DomainConstants.breedingFactor.min,
    max: DomainConstants.breedingFactor.max,
    noNaN: true,
  }),
  resilience: fc.float({
    min: DomainConstants.breedingFactor.min,
    max: DomainConstants.breedingFactor.max,
    noNaN: true,
  }),
  harmony: fc.float({
    min: DomainConstants.breedingFactor.min,
    max: DomainConstants.breedingFactor.max,
    noNaN: true,
  }),
})

const makeStage = (value: number) => Effect.runSync(makeGrowthStage(value))
const makeMoisture = (value: number) => Effect.runSync(makeMoistureLevel(value))
const makeSoil = (value: number) => Effect.runSync(makeSoilQuality(value))

const runEither = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(Effect.either(effect))

const expectFailure = (effect: Effect.Effect<unknown, DomainError>) => {
  const exit = Effect.runSyncExit(effect)
  expect(exit._tag).toBe('Failure')
}

describe('domain/agriculture/value_objects', () => {
  it('makeGrowthStageは範囲内の値を受け入れる (PBT)', () =>
    fc.assert(
      fc.property(stageArbitrary, (value) => {
        const result = runEither(makeGrowthStage(value))
        pipe(
          result,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (stage) => expect(Number(stage)).toBe(value),
          })
        )
      }),
      propertyConfig
    ))

  it('makeMoistureLevelとmakeSoilQualityは範囲を保証する (PBT)', () =>
    fc.assert(
      fc.property(moistureArbitrary, soilArbitrary, (moisture, soil) => {
        const moistureResult = runEither(makeMoistureLevel(moisture))
        const soilResult = runEither(makeSoilQuality(soil))

        pipe(
          moistureResult,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (level) => expect(Number(level)).toBe(moisture),
          })
        )

        pipe(
          soilResult,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (quality) => expect(Number(quality)).toBe(soil),
          })
        )
      }),
      propertyConfig
    ))

  it('advanceGrowthStageは成長段階を上限でクリップし負方向には進まない (PBT)', () =>
    fc.assert(
      fc.property(stageArbitrary, fc.integer({ min: -5, max: 10 }), (value, steps) => {
        const stage = makeStage(value)
        const result = runEither(advanceGrowthStage({ stage, steps }))

        pipe(
          result,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (advanced) => {
              const numeric = Number(advanced)
              const expected =
                steps <= 0 ? Number(stage) : Math.min(Number(stage) + steps, DomainConstants.growthStage.max)
              expect(numeric).toBe(expected)
            },
          })
        )
      }),
      propertyConfig
    ))

  it('adjustMoistureLevelは範囲内にクランプする (PBT)', () =>
    fc.assert(
      fc.property(moistureArbitrary, fc.integer({ min: -10, max: 10 }), (value, delta) => {
        const level = makeMoisture(value)
        const result = runEither(adjustMoistureLevel({ level, delta }))

        pipe(
          result,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (adjusted) => {
              const numeric = Number(adjusted)
              expect(numeric).toBeGreaterThanOrEqual(DomainConstants.moistureLevel.min)
              expect(numeric).toBeLessThanOrEqual(DomainConstants.moistureLevel.max)
            },
          })
        )
      }),
      propertyConfig
    ))

  it('adjustSoilQualityは範囲内にクランプする (PBT)', () =>
    fc.assert(
      fc.property(soilArbitrary, fc.integer({ min: -50, max: 50 }), (value, delta) => {
        const quality = makeSoil(value)
        const result = runEither(adjustSoilQuality({ quality, delta }))

        pipe(
          result,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (adjusted) => {
              const numeric = Number(adjusted)
              expect(numeric).toBeGreaterThanOrEqual(DomainConstants.soilQuality.min)
              expect(numeric).toBeLessThanOrEqual(DomainConstants.soilQuality.max)
            },
          })
        )
      }),
      propertyConfig
    ))

  it('describeGrowthStageは段階ごとに適切なタイプと状態を返す', () => {
    const cases: ReadonlyArray<[number, { type: ReturnType<typeof describeGrowthStage>['type']; tag: string }]> = [
      [DomainConstants.growthStage.min, { type: 'seed', tag: 'Seed' }],
      [2, { type: 'germination', tag: 'Germinating' }],
      [6, { type: 'seedling', tag: 'Seedling' }],
      [10, { type: 'growing', tag: 'Growing' }],
      [14, { type: 'mature', tag: 'Mature' }],
      [DomainConstants.growthStage.max, { type: 'harvestable', tag: 'Harvestable' }],
    ]

    cases.forEach(([value, expectations]) => {
      const stage = makeStage(value)
      const description = describeGrowthStage(stage)
      expect(description.type).toBe(expectations.type)
      expect(description.state._tag).toBe(expectations.tag)
    })
  })

  it('describeMoistureは水分レベルを状態に分類する', () => {
    const samples: ReadonlyArray<[number, HydrationState['_tag']]> = [
      [0, 'Parched'],
      [2, 'Dry'],
      [4, 'Balanced'],
      [6, 'Moist'],
      [7, 'Saturated'],
    ]

    samples.forEach(([value, tag]) => {
      const level = makeMoisture(value)
      const description = describeMoisture(level)
      expect(description._tag).toBe(tag)
    })
  })

  it('describeSoilは土壌品質を状態に分類する', () => {
    const samples: ReadonlyArray<[number, SoilCondition['_tag']]> = [
      [0, 'Depleted'],
      [25, 'Suboptimal'],
      [70, 'Healthy'],
      [90, 'Fertile'],
      [100, 'Exceptional'],
    ]

    samples.forEach(([value, tag]) => {
      const quality = makeSoil(value)
      const description = describeSoil(quality)
      expect(description._tag).toBe(tag)
    })
  })

  it('makeBreedingStatsは範囲を守りつつ生成する (PBT)', () =>
    fc.assert(
      fc.property(breedingArbitrary, (stats) => {
        const result = runEither(makeBreedingStats(stats))
        pipe(
          result,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (breeding) => {
              expect(breeding.fertility).toBeGreaterThanOrEqual(DomainConstants.breedingFactor.min)
              expect(breeding.fertility).toBeLessThanOrEqual(DomainConstants.breedingFactor.max)
              expect(breeding.resilience).toBeGreaterThanOrEqual(DomainConstants.breedingFactor.min)
              expect(breeding.resilience).toBeLessThanOrEqual(DomainConstants.breedingFactor.max)
              expect(breeding.harmony).toBeGreaterThanOrEqual(DomainConstants.breedingFactor.min)
              expect(breeding.harmony).toBeLessThanOrEqual(DomainConstants.breedingFactor.max)
            },
          })
        )
      }),
      propertyConfig
    ))

  it('mergeBreedingStatsは平均値を返し範囲を逸脱しない', () =>
    fc.assert(
      fc.property(breedingArbitrary, breedingArbitrary, (current, partner) => {
        const currentStats = Effect.runSync(makeBreedingStats(current))
        const partnerStats = Effect.runSync(makeBreedingStats(partner))
        const merged = Effect.runSync(mergeBreedingStats(currentStats, partnerStats))
        expect(merged.fertility).toBeCloseTo((currentStats.fertility + partnerStats.fertility) / 2)
        expect(merged.resilience).toBeCloseTo((currentStats.resilience + partnerStats.resilience) / 2)
        expect(merged.harmony).toBeCloseTo((currentStats.harmony + partnerStats.harmony) / 2)
      }),
      propertyConfig
    ))

  it('evaluateBreedingOutcomeはスコアに応じて分類する', () => {
    const elite = evaluateBreedingOutcome({ fertility: 1, resilience: 1, harmony: 1 })
    const stable = evaluateBreedingOutcome({ fertility: 0.6, resilience: 0.6, harmony: 0.6 })
    const fragile = evaluateBreedingOutcome({ fertility: 0.1, resilience: 0.1, harmony: 0.1 })

    expect(elite._tag).toBe(BreedingOutcome.Elite({ score: 1 })._tag)
    expect(stable._tag).toBe(BreedingOutcome.Stable({ score: 0.6 })._tag)
    expect(fragile._tag).toBe(BreedingOutcome.Fragile({ score: 0.1 })._tag)
  })

  it('summarizeValueObjectsは個別の記述関数と整合する', () => {
    const stage = makeStage(10)
    const moisture = makeMoisture(5)
    const soil = makeSoil(85)
    const stats = Effect.runSync(makeBreedingStats({ fertility: 0.8, resilience: 0.9, harmony: 0.85 }))

    const summary = summarizeValueObjects(stage, moisture, soil, stats)

    expect(summary.stage).toStrictEqual(describeGrowthStage(stage))
    expect(summary.hydration).toStrictEqual(describeMoisture(moisture))
    expect(summary.soilCondition).toStrictEqual(describeSoil(soil))
    expect(summary.outcome).toStrictEqual(evaluateBreedingOutcome(stats))
  })

  it('makeBreedingStatsEitherは失敗をEitherで返す', () => {
    const valid = makeBreedingStatsEither({ fertility: 0.5, resilience: 0.5, harmony: 0.5 })
    const invalid = makeBreedingStatsEither({ fertility: 2, resilience: 0.5, harmony: 0.5 })

    pipe(
      valid,
      Either.match({
        onLeft: () => expect(false).toBe(true),
        onRight: (stats) => expect(stats.fertility).toBe(0.5),
      })
    )

    pipe(
      invalid,
      Either.match({
        onLeft: (error) => expect(error._tag).toBe('OutOfRange'),
        onRight: () => expect(false).toBe(true),
      })
    )
  })

  it('異常値を与えると各調整関数は失敗する', () => {
    expectFailure(makeGrowthStage(DomainConstants.growthStage.min - 1))
    expectFailure(makeMoistureLevel(DomainConstants.moistureLevel.max + 1))
    expectFailure(makeSoilQuality(DomainConstants.soilQuality.max + 1))
  })
})
