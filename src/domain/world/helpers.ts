import { BiomeSystemSchema } from '@domain/biome/aggregate/biome_system/shared'
import { WorldSeedFactory } from '@domain/shared/value_object/world_seed/index'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import type { JsonValue } from '@shared/schema/json'
import { DateTime, Effect, Match, Option, Random, Schema } from 'effect'
import { WorldDomainConfig, selectWorldDomainConfigSync } from './index'

const WorldDataSchema = Schema.Struct({
  seed: Schema.Number,
  generator: Schema.Unknown,
  biomeSystem: Schema.suspend(() => BiomeSystemSchema),
  metadata: Schema.optional(
    Schema.Struct({
      name: Schema.optional(Schema.String),
      version: Schema.optional(Schema.String),
      type: Schema.optional(Schema.String),
      created: Schema.optional(Schema.DateTimeUtc),
    })
  ),
})

type WorldData = Schema.Schema.Type<typeof WorldDataSchema>

export interface WorldDataValidationResult {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

const randomSeed = Effect.flatMap(Random.nextIntBetween(-2_147_483_648, 2_147_483_647), (seed) =>
  WorldSeedFactory.fromNumber(seed)
)

const resolveSeed = (seed: number | undefined) =>
  Option.fromNullable(seed).pipe(
    Option.match({
      onNone: () => randomSeed,
      onSome: (value) => WorldSeedFactory.fromNumber(value),
    })
  )

const validateWorldDataInternal = (data: JsonValue): Effect.Effect<WorldDataValidationResult> =>
  Effect.matchEffect(Schema.decodeUnknown(WorldDataSchema)(data), {
    onFailure: (error) =>
      Effect.succeed({
        isValid: false,
        errors: [TreeFormatter.formatErrorSync(error)],
        warnings: [],
      }),
    onSuccess: () =>
      Effect.succeed({
        isValid: true,
        errors: [],
        warnings: [],
      }),
  })

const optimizeWorldSettingsInternal = (config: Partial<WorldDomainConfig>) =>
  Effect.map(
    Schema.decodeUnknown(WorldDomainDataSchema)({ ...selectWorldDomainConfigSync('default'), ...config }),
    (fullConfig) =>
      Match.value(fullConfig.performanceMode).pipe(
        Match.when(
          'performance',
          () =>
            ({
              ...fullConfig,
              enableDomainValidation: false,
              enableFactoryValidation: false,
              repository: {
                ...fullConfig.repository,
                implementation: 'memory' as const,
              },
            }) satisfies WorldDomainConfig
        ),
        Match.when(
          'quality',
          () =>
            ({
              ...fullConfig,
              enableDomainValidation: true,
              enableFactoryValidation: true,
              debugMode: true,
            }) satisfies WorldDomainConfig
        ),
        Match.orElse(() => fullConfig)
      )
  )

const exportWorldMetadataInternal = (world: JsonValue) =>
  Effect.gen(function* () {
    const nowDateTime = yield* DateTime.now
    const now = DateTime.toDate(nowDateTime)
    const decoded = Schema.decodeUnknownEither(WorldDataSchema)(world)

    return pipe(
      Match.value(decoded),
      Match.tag('Right', ({ right }) => {
        const typed: WorldData = right
        const createdAt = typed.metadata?.created ?? now
        return {
          name: typed.metadata?.name ?? 'Unnamed World',
          seed: typed.seed,
          created: createdAt,
          version: typed.metadata?.version ?? '1.0.0',
          type: typed.metadata?.type ?? 'unspecified',
          chunks: 0,
          biomes: 0,
        }
      }),
      Match.tag('Left', () => ({
        name: 'Invalid World',
        seed: undefined,
        created: now,
        version: 'unavailable',
        type: 'invalid',
        chunks: 0,
        biomes: 0,
      })),
      Match.exhaustive
    )
  })

export const WorldDomainHelpers = {
  validateWorldData: validateWorldDataInternal,
  optimizeWorldSettings: optimizeWorldSettingsInternal,
  exportWorldMetadata: exportWorldMetadataInternal,
}

const WorldDomainDataSchema = Schema.Struct({
  repository: Schema.suspend(() => WorldRepositoryLayerConfigSchema),
  enableDomainEvents: Schema.Boolean,
  enablePerformanceMetrics: Schema.Boolean,
  enableDomainValidation: Schema.Boolean,
  enableAggregateEventSourcing: Schema.Boolean,
  enableFactoryValidation: Schema.Boolean,
  performanceMode: Schema.Literals('quality', 'balanced', 'performance'),
  debugMode: Schema.Boolean,
})
