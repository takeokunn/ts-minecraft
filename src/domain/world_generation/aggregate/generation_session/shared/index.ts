import * as Coordinates from '@domain/world/value_object/coordinates/index'
import { JsonValueSchema } from '@shared/schema/json'
import { Brand, Effect, Schema } from 'effect'
import * as ErrorHandling from '../error_handling'
import * as ProgressTracking from '../progress_tracking'
import * as SessionState from '../session_state'

export type GenerationSessionId = string & Brand.Brand<'GenerationSessionId'>

export const GenerationSessionIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('GenerationSessionId'),
  Schema.annotations({
    title: 'GenerationSessionId',
    description: 'Unique identifier for generation session',
    examples: ['gs_12345678-1234-5678-9abc-123456789abc'],
  })
)

export const createGenerationSessionId = (value: string): GenerationSessionId =>
  Schema.decodeSync(GenerationSessionIdSchema)(value)

/**
 * Schema検証済みのデータをGenerationSessionIdに変換する（unsafe）
 * @param value - 検証済みの文字列
 * @returns GenerationSessionId
 * @remarks 必ずSchema検証後、またはIDジェネレーター出力後にのみ使用すること
 */
export const makeUnsafeGenerationSessionId = (value: string): GenerationSessionId => value as GenerationSessionId

export const SessionConfigurationSchema = Schema.Struct({
  maxConcurrentChunks: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 16),
    Schema.annotations({ description: 'Maximum chunks to generate simultaneously' })
  ),
  chunkBatchSize: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: 'Number of chunks to process in one batch' })
  ),
  retryPolicy: Schema.Struct({
    maxAttempts: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    backoffStrategy: Schema.Literal('linear', 'exponential', 'constant'),
    baseDelayMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    maxDelayMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  }),
  timeoutPolicy: Schema.Struct({
    chunkTimeoutMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    sessionTimeoutMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    gracefulShutdownMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  }),
  priorityPolicy: Schema.Struct({
    enablePriorityQueuing: Schema.Boolean,
    priorityThreshold: Schema.Number.pipe(Schema.between(1, 10)),
    highPriorityWeight: Schema.Number.pipe(Schema.between(1.0, 10.0)),
  }),
})

export type SessionConfiguration = typeof SessionConfigurationSchema.Type

export const GenerationRequestSchema = Schema.Struct({
  coordinates: Schema.Array(Coordinates.ChunkCoordinateSchema),
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  options: Schema.optional(
    Schema.Struct({
      includeStructures: Schema.Boolean,
      includeCaves: Schema.Boolean,
      includeOres: Schema.Boolean,
      generateVegetation: Schema.Boolean,
      applyPostProcessing: Schema.Boolean,
    })
  ),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: JsonValueSchema,
    })
  ),
})

export type GenerationRequest = typeof GenerationRequestSchema.Type

export const GenerationSessionSchema = Schema.Struct({
  id: GenerationSessionIdSchema,
  worldGeneratorId: Schema.String,
  configuration: SessionConfigurationSchema,
  request: GenerationRequestSchema,
  state: SessionState.SessionStateSchema,
  progress: ProgressTracking.ProgressDataSchema,
  errorHistory: Schema.Array(ErrorHandling.SessionErrorSchema),
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  createdAt: Schema.DateTimeUtc,
  startedAt: Schema.optional(Schema.DateTimeUtc),
  completedAt: Schema.optional(Schema.DateTimeUtc),
  lastActivity: Schema.DateTimeUtc,
})

export type GenerationSession = typeof GenerationSessionSchema.Type
