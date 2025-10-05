import { describe, expect, it } from '@effect/vitest'
import { DateTime, Effect, Either, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { vi } from 'vitest'
import {
  CropProjection,
  advanceCropGrowth,
  breedCrop,
  describeAggregateSummary,
  describeCrop,
  enrichSoilForCrop,
  hydrateCrop,
  makeCropAggregate,
  makeCropAggregateEither,
  projectCropTrajectory,
  snapshotCrop,
  validateCropAggregate,
  validateCropAggregateEither,
} from './aggregates'
import { DomainConstants } from './types'
import {
  BreedingOutcome,
  HydrationState,
  SoilCondition,
  makeBreedingStats,
  makeGrowthStage,
  makeMoistureLevel,
  makeSoilQuality,
} from './value_objects'
import * as ValueObjects from './value_objects'

const propertyConfig: fc.Parameters = { numRuns: 48 }

const cropInputArbitrary = fc.record({
  id: fc.string({ minLength: 3, maxLength: 12 }).filter((value) => /^[A-Za-z0-9_-]+$/.test(value)),
  stage: fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max }),
  moisture: fc.integer({ min: DomainConstants.moistureLevel.min, max: DomainConstants.moistureLevel.max }),
  soil: fc.integer({ min: DomainConstants.soilQuality.min, max: DomainConstants.soilQuality.max }),
  stats: fc.record({
    fertility: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max, noNaN: true }),
    resilience: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max, noNaN: true }),
    harmony: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max, noNaN: true }),
  }),
})

const makeAggregate = (override?: Partial<fc.TypeOf<typeof cropInputArbitrary>>) =>
  makeCropAggregate({
    id: override?.id ?? 'crop-1',
    stage: override?.stage ?? DomainConstants.growthStage.min,
    moisture: override?.moisture ?? DomainConstants.moistureLevel.min,
    soil: override?.soil ?? DomainConstants.soilQuality.min,
    stats: override?.stats ?? { fertility: 0.5, resilience: 0.5, harmony: 0.5 },
  })

describe('domain/agriculture/aggregates', () => {
  it('makeCropAggregateは有効な入力で成功する (PBT)', () =>
    fc.assert(
      fc.property(cropInputArbitrary, (input) => {
        const aggregate = Effect.runSync(makeCropAggregate(input))
        expect(aggregate.id).toBe(input.id)
        expect(Number(aggregate.stage)).toBe(input.stage)
        expect(Number(aggregate.moisture)).toBe(input.moisture)
        expect(Number(aggregate.soil)).toBe(input.soil)
        expect(aggregate.stats.fertility).toBeCloseTo(input.stats.fertility)
        expect(aggregate.plantedAt).toBeDefined()
        expect(aggregate.updatedAt).toBeDefined()
        expect(aggregate.plantedAt).toStrictEqual(aggregate.updatedAt)
      }),
      propertyConfig
    )
  )

  it('makeCropAggregateEitherは不正な識別子で失敗する', () =>
    Effect.runSync(
      Effect.gen(function* () {
        const valid = yield* makeCropAggregateEither({
          id: 'valid-id',
          stage: DomainConstants.growthStage.min,
          moisture: DomainConstants.moistureLevel.min,
          soil: DomainConstants.soilQuality.min,
          stats: { fertility: 0.5, resilience: 0.5, harmony: 0.5 },
        })
        pipe(
          valid,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (aggregate) => expect(aggregate.id).toBe('valid-id'),
          })
        )

        const invalid = yield* makeCropAggregateEither({
          id: '!',
          stage: DomainConstants.growthStage.min,
          moisture: DomainConstants.moistureLevel.min,
          soil: DomainConstants.soilQuality.min,
          stats: { fertility: 0.5, resilience: 0.5, harmony: 0.5 },
        })

        pipe(
          invalid,
          Either.match({
            onLeft: (error) => expect(error._tag).toBe('ValidationError'),
            onRight: () => expect(false).toBe(true),
          })
        )
      })
    )
  )

  it.effect('hydrate/enrich/advance/breedは状態を更新し更新日時を前進させる', () =>
    Effect.gen(function* () {
      const aggregate = yield* makeAggregate()

      const hydrated = yield* hydrateCrop({ crop: aggregate, delta: 2 })
      expect(Number(hydrated.moisture)).toBe(DomainConstants.moistureLevel.min + 2)
      expect(DateTime.toEpochMillis(hydrated.updatedAt)).toBeGreaterThanOrEqual(
        DateTime.toEpochMillis(aggregate.updatedAt)
      )

      const fertilized = yield* enrichSoilForCrop({ crop: hydrated, delta: 5 })
      expect(Number(fertilized.soil)).toBe(DomainConstants.soilQuality.min + 5)
      expect(DateTime.toEpochMillis(fertilized.updatedAt)).toBeGreaterThanOrEqual(
        DateTime.toEpochMillis(aggregate.updatedAt)
      )

      const advanced = yield* advanceCropGrowth({ crop: fertilized, steps: 3 })
      expect(Number(advanced.stage)).toBe(DomainConstants.growthStage.min + 3)

      const partner = yield* makeBreedingStats({ fertility: 0.6, resilience: 0.4, harmony: 0.8 })
      const bred = yield* breedCrop({ crop: advanced, partner })
      expect(bred.stats.fertility).toBeCloseTo((advanced.stats.fertility + partner.fertility) / 2)
      expect(DateTime.toEpochMillis(bred.updatedAt)).toBeGreaterThanOrEqual(
        DateTime.toEpochMillis(advanced.updatedAt)
      )
    })
  )

  it.effect('describeCropとsnapshotCropは要約を正しく生成する', () =>
    Effect.gen(function* () {
      const aggregate = yield* makeAggregate({
        stage: 10,
        moisture: 5,
        soil: 80,
        stats: { fertility: 0.9, resilience: 0.9, harmony: 0.9 },
      })

      const description = describeCrop(aggregate)
      expect(description.hydration._tag).toBe(HydrationState.Moist({})._tag)
      expect(description.soil._tag).toBe(SoilCondition.Fertile({ bonus: 1 })._tag)
      expect(description.breeding._tag).toBe(BreedingOutcome.Elite({ score: 1 })._tag)

      const snapshot = yield* snapshotCrop(aggregate)
      expect(snapshot.id).toBe(aggregate.id)
      expect(snapshot.summary.hydrationTag).toBe(description.hydration._tag)
      expect(snapshot.summary.growthType).toBe(description.growth.type)
    })
  )

  it('projectCropTrajectoryは成長の進行状況を分類する', () => {
    const aggregate = Effect.runSync(makeAggregate({ stage: 5 }))
    const stable = Effect.runSync(projectCropTrajectory({ crop: aggregate, steps: 0 }))
    expect(stable._tag).toBe(CropProjection.Stable({ remainAt: aggregate.updatedAt })._tag)

    const improved = Effect.runSync(projectCropTrajectory({ crop: aggregate, steps: 3 }))
    expect(improved._tag).toBe(CropProjection.Improving({ projectedStage: aggregate.stage, at: aggregate.updatedAt })._tag)

    const spy = vi.spyOn(ValueObjects, 'advanceGrowthStage')
    spy.mockImplementation(({ stage }) => Effect.succeed(stage))

    const degraded = Effect.runSync(projectCropTrajectory({ crop: aggregate, steps: -5 }))
    expect(degraded._tag).toBe(CropProjection.Stable({ remainAt: aggregate.updatedAt })._tag)

    const decreasedStage = Effect.runSync(makeGrowthStage(1))
    spy.mockImplementation(() => Effect.succeed(decreasedStage))

    const mockedDegrade = Effect.runSync(projectCropTrajectory({ crop: aggregate, steps: 1 }))
    expect(mockedDegrade._tag).toBe(CropProjection.Degrading({ projectedStage: aggregate.stage, at: aggregate.updatedAt })._tag)
    spy.mockRestore()
  })

  it.effect('describeAggregateSummaryはvalue objectsの記述と一致する', () =>
    Effect.gen(function* () {
      const stage = yield* makeGrowthStage(8)
      const moisture = yield* makeMoistureLevel(4)
      const soil = yield* makeSoilQuality(70)
      const stats = yield* makeBreedingStats({ fertility: 0.7, resilience: 0.6, harmony: 0.65 })
      const aggregate = yield* makeAggregate({
        stage: Number(stage),
        moisture: Number(moisture),
        soil: Number(soil),
        stats,
      })

      const summary = describeAggregateSummary(aggregate)
      expect(summary.stage).toStrictEqual(describeCrop(aggregate).growth)
    })
  )

  it.effect('validateCropAggregateは異なるタイムスタンプ形式に対応する', () =>
    Effect.gen(function* () {
      const aggregate = yield* makeAggregate()
      const validatedAggregate = yield* validateCropAggregate(aggregate)
      expect(DateTime.toEpochMillis(validatedAggregate.plantedAt)).toBe(
        DateTime.toEpochMillis(aggregate.plantedAt)
      )
      const payload = {
        id: aggregate.id,
        stage: Number(aggregate.stage),
        moisture: String(Number(aggregate.moisture)),
        soil: Number(aggregate.soil),
        stats: { ...aggregate.stats },
        plantedAt: Date.now(),
        updatedAt: new Date(),
      }

      const validated = yield* validateCropAggregate(payload)
      expect(validated.id).toBe(aggregate.id)

      const withIso = { ...payload, updatedAt: new Date().toISOString() }
      const validatedIso = yield* validateCropAggregate(withIso)
      expect(validatedIso.updatedAt).toBeDefined()
    })
  )

  it('validateCropAggregateEitherは不正な構造を検出する', () => {
    Effect.runSync(
      Effect.gen(function* () {
        const failure = yield* validateCropAggregateEither({ stats: 'invalid' })
        pipe(
          failure,
          Either.match({
            onLeft: (error) => expect(error._tag).toBe('SchemaViolation'),
            onRight: () => expect(false).toBe(true),
          })
        )

        const invalidStats = yield* validateCropAggregateEither({
          id: 'crop',
          stage: DomainConstants.growthStage.min,
          moisture: DomainConstants.moistureLevel.min,
          soil: DomainConstants.soilQuality.min,
          stats: { fertility: 2, resilience: 0, harmony: 0 },
          plantedAt: Date.now(),
          updatedAt: Date.now(),
        })

        pipe(
          invalidStats,
          Either.match({
            onLeft: (error) => expect(error._tag).toBe('OutOfRange'),
            onRight: () => expect(false).toBe(true),
          })
        )
      })
    )
  })
})
