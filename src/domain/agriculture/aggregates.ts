import { Clock, Data, DateTime, Effect, Either, Match, pipe } from 'effect'
import * as Schema from '@effect/schema/Schema'
import {
  BreedingOutcome,
  BreedingStats,
  DomainError,
  GrowthStage,
  HydrationState,
  Identifier,
  MoistureLevel,
  SchemaViolation,
  SoilCondition,
  SoilQuality,
  adjustMoistureLevel,
  adjustSoilQuality,
  advanceGrowthStage,
  describeGrowthStage,
  describeMoisture,
  describeSoil,
  evaluateBreedingOutcome,
  makeBreedingStats,
  makeGrowthStage,
  makeIdentifier,
  makeMoistureLevel,
  makeSoilQuality,
  mergeBreedingStats,
  summarizeValueObjects,
} from './index'

export type Timestamp = DateTime.Utc

const fromEpochMillis = (millis: number): Timestamp => DateTime.unsafeMake(millis)

const currentTimestamp: Effect.Effect<Timestamp> = pipe(Clock.currentTimeMillis, Effect.map(fromEpochMillis))

export interface CropAggregate {
  readonly id: Identifier
  readonly stage: GrowthStage
  readonly moisture: MoistureLevel
  readonly soil: SoilQuality
  readonly stats: BreedingStats
  readonly plantedAt: Timestamp
  readonly updatedAt: Timestamp
}

export interface CropAggregateSnapshot {
  readonly id: Identifier
  readonly growthStage: GrowthStage
  readonly moisture: MoistureLevel
  readonly soil: SoilQuality
  readonly stats: BreedingStats
  readonly plantedAt: Timestamp
  readonly updatedAt: Timestamp
  readonly summary: {
    readonly growthType: ReturnType<typeof describeGrowthStage>['type']
    readonly hydrationTag: HydrationState['_tag']
    readonly soilTag: SoilCondition['_tag']
    readonly breedingTag: BreedingOutcome['_tag']
  }
}

const invalidStructure = (field: string, detail: string): DomainError => SchemaViolation({ field, message: detail })

const BreedingStatsInputSchema = Schema.Struct({
  fertility: Schema.Number,
  resilience: Schema.Number,
  harmony: Schema.Number,
})

type BreedingStatsInput = Schema.Schema.Input<typeof BreedingStatsInputSchema>

const TimestampInputSchema = Schema.Union(Schema.Number, Schema.String)
type TimestampInput = Schema.Schema.Input<typeof TimestampInputSchema>

const CropAggregateInputSchema = Schema.Struct({
  id: Schema.String,
  stage: Schema.Number,
  moisture: Schema.Number,
  soil: Schema.Number,
  stats: BreedingStatsInputSchema,
  plantedAt: TimestampInputSchema,
  updatedAt: TimestampInputSchema,
})

const ensureTimestamp = (
  value: TimestampInput | Date | Timestamp | null | undefined,
  field: string
): Effect.Effect<Timestamp, DomainError> =>
  Effect.suspend(() =>
    Match.value(value).pipe(
      Match.when(Match.number, (num) => Effect.succeed(fromEpochMillis(num))),
      Match.when(Match.string, (str) => {
        const parsed = Date.parse(str)
        return Number.isNaN(parsed)
          ? Effect.fail(invalidStructure(field, 'invalid timestamp string'))
          : Effect.succeed(fromEpochMillis(parsed))
      }),
      Match.when(
        (v): v is Date => v instanceof Date,
        (date) =>
          Number.isNaN(date.getTime())
            ? Effect.fail(invalidStructure(field, 'invalid Date instance'))
            : Effect.succeed(DateTime.unsafeFromDate(date))
      ),
      Match.when(DateTime.isDateTime, (dt) =>
        dt._tag === 'Utc' ? Effect.succeed(dt) : Effect.fail(invalidStructure(field, 'utc timestamp expected'))
      ),
      Match.orElse(() => Effect.fail(invalidStructure(field, 'timestamp expected')))
    )
  )

export const makeCropAggregate = (input: {
  readonly id: string
  readonly stage: number
  readonly moisture: number
  readonly soil: number
  readonly stats: { readonly fertility: number; readonly resilience: number; readonly harmony: number }
}): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const identifier = yield* makeIdentifier(input.id)
    const stage = yield* makeGrowthStage(input.stage)
    const moisture = yield* makeMoistureLevel(input.moisture)
    const soil = yield* makeSoilQuality(input.soil)
    const stats = yield* makeBreedingStats(input.stats)
    const timestamp = yield* currentTimestamp

    const aggregate: CropAggregate = {
      id: identifier,
      stage,
      moisture,
      soil,
      stats,
      plantedAt: timestamp,
      updatedAt: timestamp,
    }

    return aggregate
  })

export const makeCropAggregateEither = (input: {
  readonly id: string
  readonly stage: number
  readonly moisture: number
  readonly soil: number
  readonly stats: { readonly fertility: number; readonly resilience: number; readonly harmony: number }
}): Effect.Effect<Either.Either<CropAggregate, DomainError>, never> => Effect.either(makeCropAggregate(input))

const refreshUpdatedAt = (crop: CropAggregate): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return { ...crop, updatedAt: timestamp }
  })

export const advanceCropGrowth = (params: {
  readonly crop: CropAggregate
  readonly steps: number
}): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const advancedStage = yield* advanceGrowthStage({ stage: params.crop.stage, steps: params.steps })
    return yield* refreshUpdatedAt({ ...params.crop, stage: advancedStage })
  })

export const hydrateCrop = (params: {
  readonly crop: CropAggregate
  readonly delta: number
}): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const level = yield* adjustMoistureLevel({ level: params.crop.moisture, delta: params.delta })
    return yield* refreshUpdatedAt({ ...params.crop, moisture: level })
  })

export const enrichSoilForCrop = (params: {
  readonly crop: CropAggregate
  readonly delta: number
}): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const quality = yield* adjustSoilQuality({ quality: params.crop.soil, delta: params.delta })
    return yield* refreshUpdatedAt({ ...params.crop, soil: quality })
  })

export const breedCrop = (params: {
  readonly crop: CropAggregate
  readonly partner: BreedingStats
}): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const merged = yield* mergeBreedingStats(params.crop.stats, params.partner)
    return yield* refreshUpdatedAt({ ...params.crop, stats: merged })
  })

export const describeCrop = (
  crop: CropAggregate
): Readonly<{
  readonly growth: ReturnType<typeof describeGrowthStage>
  readonly hydration: HydrationState
  readonly soil: SoilCondition
  readonly breeding: BreedingOutcome
}> => ({
  growth: describeGrowthStage(crop.stage),
  hydration: describeMoisture(crop.moisture),
  soil: describeSoil(crop.soil),
  breeding: evaluateBreedingOutcome(crop.stats),
})

export const snapshotCrop = (crop: CropAggregate): Effect.Effect<CropAggregateSnapshot> =>
  Effect.sync(() => {
    const description = describeCrop(crop)
    return {
      id: crop.id,
      growthStage: crop.stage,
      moisture: crop.moisture,
      soil: crop.soil,
      stats: crop.stats,
      plantedAt: crop.plantedAt,
      updatedAt: crop.updatedAt,
      summary: {
        growthType: description.growth.type,
        hydrationTag: description.hydration._tag,
        soilTag: description.soil._tag,
        breedingTag: description.breeding._tag,
      },
    }
  })

const parseStats = (value: BreedingStatsInput): Effect.Effect<BreedingStats, DomainError> =>
  Effect.gen(function* () {
    const decoded = yield* Schema.decode(BreedingStatsInputSchema)(value).pipe(
      Effect.mapError(() => invalidStructure('stats', 'fertility/resilience/harmony numeric fields expected'))
    )
    return yield* makeBreedingStats(decoded)
  })

export const validateCropAggregate = (input: unknown): Effect.Effect<CropAggregate, DomainError> =>
  Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(CropAggregateInputSchema)(input).pipe(
      Effect.mapError(() => invalidStructure('cropAggregate', 'invalid crop aggregate structure'))
    )

    const identifier = yield* makeIdentifier(decoded.id)
    const stage = yield* makeGrowthStage(decoded.stage)
    const moisture = yield* makeMoistureLevel(decoded.moisture)
    const soil = yield* makeSoilQuality(decoded.soil)
    const stats = yield* parseStats(decoded.stats)
    const plantedAt = yield* ensureTimestamp(decoded.plantedAt, 'cropAggregate.plantedAt')
    const updatedAt = yield* ensureTimestamp(decoded.updatedAt, 'cropAggregate.updatedAt')

    return {
      id: identifier,
      stage,
      moisture,
      soil,
      stats,
      plantedAt,
      updatedAt,
    }
  })

export const validateCropAggregateEither = (
  input: unknown
): Effect.Effect<Either.Either<CropAggregate, DomainError>, never> => Effect.either(validateCropAggregate(input))

export const describeAggregateSummary = (crop: CropAggregate) =>
  summarizeValueObjects(crop.stage, crop.moisture, crop.soil, crop.stats)

export type CropProjection = Data.TaggedEnum<{
  Stable: { readonly remainAt: Timestamp }
  Improving: { readonly projectedStage: GrowthStage; readonly at: Timestamp }
  Degrading: { readonly projectedStage: GrowthStage; readonly at: Timestamp }
}>

export const CropProjection = Data.taggedEnum<CropProjection>()

export const projectCropTrajectory = (params: {
  readonly crop: CropAggregate
  readonly steps: number
}): Effect.Effect<CropProjection, DomainError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    const advanced = yield* advanceGrowthStage({ stage: params.crop.stage, steps: params.steps })
    return pipe(
      Match.value(Number(advanced) - Number(params.crop.stage)),
      Match.when(0, () => CropProjection.Stable({ remainAt: timestamp })),
      Match.when(
        (delta) => delta > 0,
        () => CropProjection.Improving({ projectedStage: advanced, at: timestamp })
      ),
      Match.orElse(() => CropProjection.Degrading({ projectedStage: advanced, at: timestamp }))
    )
  })
