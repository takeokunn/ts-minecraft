import { WorldApplicationService, type WorldApplicationServiceErrorType } from '@domain/world/application_service'
import { WorldFactories } from '@domain/world/factory'
import type { WorldSeed } from '@domain/world/value_object/world_seed'
import { WorldSeedFactory } from '@domain/world/value_object/world_seed/index'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { DateTime, Effect, Match, Option, Random, Schema } from 'effect'
import { WorldClock, WorldDomainConfig, defaultWorldDomainConfig } from './index'

const WorldDataSchema = Schema.Struct({
  seed: Schema.Number,
  generator: Schema.Any,
  biomeSystem: Schema.Any,
  metadata: Schema.optional(
    Schema.Struct({
      name: Schema.optional(Schema.String),
      version: Schema.optional(Schema.String),
      type: Schema.optional(Schema.String),
      created: Schema.optional(Schema.Number),
    })
  ),
})

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

export interface WorldSnapshot {
  readonly seed: WorldSeed
  readonly generator: unknown
  readonly biomeSystem: unknown
  readonly metadata: {
    readonly createdAt: Date
    readonly version: string
    readonly type: string
  }
}

const validateWorldDataInternal = (data: unknown): Effect.Effect<WorldDataValidationResult> =>
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
  Effect.map(Schema.decodeUnknown(WorldDomainDataSchema)({ ...defaultWorldDomainConfig, ...config }), (fullConfig) =>
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

const exportWorldMetadataInternal = (world: unknown) =>
  Effect.gen(function* () {
    const validation = yield* validateWorldDataInternal(world)
    const nowDateTime = yield* DateTime.now
    const now = DateTime.toDate(nowDateTime)

    return Match.value(validation.isValid).pipe(
      Match.when(true, () => {
        const typed = world as {
          readonly metadata?: {
            readonly name?: string
            readonly version?: string
            readonly type?: string
            readonly created?: number
          }
          readonly generator?: { readonly statistics?: { readonly totalGenerated?: number } }
          readonly biomeSystem?: { readonly registry?: { readonly count?: number } }
          readonly seed?: number
        }

        return {
          name: typed.metadata?.name ?? 'Unnamed World',
          seed: typed.seed,
          created: typed.metadata?.created ? DateTime.toDate(DateTime.unsafeMake(typed.metadata.created)) : now,
          version: typed.metadata?.version ?? '1.0.0',
          type: typed.metadata?.type ?? 'unknown',
          chunks: typed.generator?.statistics?.totalGenerated ?? 0,
          biomes: typed.biomeSystem?.registry?.count ?? 0,
        }
      }),
      Match.orElse(() => ({
        name: 'Invalid World',
        seed: undefined,
        created: now,
        version: 'unknown',
        type: 'invalid',
        chunks: 0,
        biomes: 0,
      }))
    )
  })

const createQuickWorldInternal = (seed?: number) =>
  Effect.gen(function* () {
    const worldSeed = yield* resolveSeed(seed)
    const generator = yield* WorldFactories.createQuickGenerator()
    const biomeSystem = yield* WorldFactories.createDefaultBiomeSystem()
    const now = yield* Effect.flatMap(Effect.service(WorldClock), (clock) => clock.currentDate)

    return {
      seed: worldSeed,
      generator,
      biomeSystem,
      metadata: {
        createdAt: now,
        version: '1.0.0',
        type: 'quick_world',
      },
    } satisfies WorldSnapshot
  })

const generateChunkInternal = (
  worldId: string,
  chunkX: number,
  chunkZ: number,
  priority: 'critical' | 'high' | 'normal' | 'low' | 'background' = 'normal'
) =>
  Effect.gen(function* () {
    const service = yield* Effect.service(WorldApplicationService)
    return yield* service.generateChunk(worldId, chunkX, chunkZ, priority)
  })

export const WorldDomainHelpers = {
  createQuickWorld: createQuickWorldInternal,
  generateChunk: generateChunkInternal,
  validateWorldData: validateWorldDataInternal,
  optimizeWorldSettings: optimizeWorldSettingsInternal,
  exportWorldMetadata: exportWorldMetadataInternal,
}

const WorldDomainDataSchema = Schema.Struct({
  repository: Schema.Any,
  enableDomainEvents: Schema.Boolean,
  enablePerformanceMetrics: Schema.Boolean,
  enableDomainValidation: Schema.Boolean,
  enableAggregateEventSourcing: Schema.Boolean,
  enableApplicationServices: Schema.Boolean,
  enableFactoryValidation: Schema.Boolean,
  performanceMode: Schema.Literals('quality', 'balanced', 'performance'),
  debugMode: Schema.Boolean,
})

export type WorldHelperGenerateChunkError = WorldApplicationServiceErrorType
