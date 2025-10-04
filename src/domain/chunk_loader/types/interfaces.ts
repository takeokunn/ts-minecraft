import { Context, Data, Effect, Match, Option, ParseResult, Schema, pipe } from 'effect'

const IntSchema = Schema.Number.pipe(Schema.int())
const TimestampSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('Timestamp'))
const PrioritySchema = Schema.Number.pipe(Schema.between(0, 100), Schema.brand('ChunkPriority'))
const ProgressSchema = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('LoadProgress'))
const ChunkCoordinateSchema = Schema.Struct({
  x: IntSchema,
  y: IntSchema,
  z: IntSchema,
})
const ChunkIdSchema = Schema.String.pipe(
  Schema.pattern(/^chunk_-?\d+_-?\d+_-?\d+$/),
  Schema.brand('ChunkId')
)
const SessionIdSchema = Schema.String.pipe(
  Schema.pattern(/^session_[0-9a-f]{16}_[0-9a-f]{16}$/),
  Schema.brand('SessionId')
)
const LoadSourceSchema = Schema.Literal('player', 'system', 'prefetch')

export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>
export type ChunkPriority = Schema.Schema.Type<typeof PrioritySchema>
export type LoadProgress = Schema.Schema.Type<typeof ProgressSchema>
export type ChunkCoordinates = Schema.Schema.Type<typeof ChunkCoordinateSchema>
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>
export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>
export type ChunkLoadSource = Schema.Schema.Type<typeof LoadSourceSchema>

export interface ChunkLoadRequest {
  readonly id: ChunkId
  readonly coordinates: ChunkCoordinates
  readonly priority: ChunkPriority
  readonly source: ChunkLoadSource
  readonly requestedAt: Timestamp
}

export const LoadPhase = {
  Queued: Data.tagged<{ readonly _tag: 'Queued' }>('Queued'),
  Fetching: Data.tagged<{ readonly _tag: 'Fetching'; readonly stage: 'network' | 'decode' }>('Fetching'),
  Processing: Data.tagged<{ readonly _tag: 'Processing'; readonly stage: 'meshing' | 'lighting' }>('Processing'),
  Caching: Data.tagged<{ readonly _tag: 'Caching' }>('Caching'),
  Completed: Data.tagged<{ readonly _tag: 'Completed'; readonly cacheHit: boolean }>('Completed'),
  Failed: Data.tagged<{ readonly _tag: 'Failed'; readonly reason: string }>('Failed'),
}

export type LoadPhase =
  | ReturnType<typeof LoadPhase.Queued>
  | ReturnType<typeof LoadPhase.Fetching>
  | ReturnType<typeof LoadPhase.Processing>
  | ReturnType<typeof LoadPhase.Caching>
  | ReturnType<typeof LoadPhase.Completed>
  | ReturnType<typeof LoadPhase.Failed>

export interface ChunkLoadProgress {
  readonly sessionId: SessionId
  readonly phase: LoadPhase
  readonly progress: LoadProgress
  readonly updatedAt: Timestamp
}

export interface PerformanceStats {
  readonly activeSessions: number
  readonly completedSessions: number
  readonly failedSessions: number
  readonly averageLatency: number
  readonly cacheHitRate: number
}

const ValidationError = Data.tagged<{ readonly _tag: 'ValidationError'; readonly message: string }>('ValidationError')
const ConflictError = Data.tagged<{ readonly _tag: 'ConflictError'; readonly sessionId: SessionId }>('ConflictError')
const InternalError = Data.tagged<{ readonly _tag: 'InternalError'; readonly message: string }>('InternalError')

export type LoadError =
  | ReturnType<typeof ValidationError>
  | ReturnType<typeof ConflictError>
  | ReturnType<typeof InternalError>

const formatParseError = (error: ParseResult.ParseError): string =>
  ParseResult.TreeFormatter.formatErrorSync(error)

const toValidationError = (error: ParseResult.ParseError): LoadError =>
  ValidationError({ message: formatParseError(error) })

const toInternalError = (error: ParseResult.ParseError): LoadError =>
  InternalError({ message: formatParseError(error) })

export const LoadError = {
  Validation: (message: string): LoadError => ValidationError({ message }),
  Conflict: (sessionId: SessionId): LoadError => ConflictError({ sessionId }),
  Internal: (message: string): LoadError => InternalError({ message }),
}

const makeDecoder = <A>(
  schema: Schema.Schema<A, any, never>,
  onError: (error: ParseResult.ParseError) => LoadError
) =>
  (value: unknown): Effect.Effect<A, LoadError> =>
    pipe(
      Schema.decodeUnknown(schema)(value),
      Effect.mapError(onError)
    )

const decodeCoordinates = makeDecoder(ChunkCoordinateSchema, toValidationError)
const decodePriority = makeDecoder(PrioritySchema, toValidationError)
const decodeSource = makeDecoder(LoadSourceSchema, toValidationError)
const decodeTimestamp = makeDecoder(TimestampSchema, toValidationError)
const decodeChunkId = makeDecoder(ChunkIdSchema, toInternalError)
const decodeSessionId = makeDecoder(SessionIdSchema, toInternalError)
const decodeProgress = makeDecoder(ProgressSchema, toInternalError)

export interface ChunkLoadRequestInput {
  readonly coordinates: ChunkCoordinates
  readonly priority: number
  readonly source: ChunkLoadSource
  readonly requestedAt: number
}

export interface ChunkLoadingProvider {
  readonly enqueue: (input: ChunkLoadRequestInput) => Effect.Effect<SessionId, LoadError>
  readonly observe: (sessionId: SessionId) => Effect.Effect<ChunkLoadProgress, SessionNotFoundError>
  readonly metrics: Effect.Effect<PerformanceStats>
  readonly cacheStatus: (chunkId: ChunkId) => Effect.Effect<CacheStatus>
  readonly evict: (chunkId: ChunkId) => Effect.Effect<CacheStatus>
}

export const ChunkLoadingProviderTag = Context.Tag<ChunkLoadingProvider>(
  '@minecraft/domain/chunk_loader/ChunkLoadingProvider'
)

export const ChunkLoadingProvider = ChunkLoadingProviderTag

export const makeChunkId = (
  coordinates: ChunkCoordinates
): Effect.Effect<ChunkId, LoadError> =>
  pipe(
    decodeChunkId(`chunk_${coordinates.x}_${coordinates.y}_${coordinates.z}`)
  )

export const makeSessionId = (
  timestamp: Timestamp,
  entropy: string
): Effect.Effect<SessionId, LoadError> =>
  decodeSessionId(`session_${timestamp.toString(16).padStart(16, '0')}_${entropy}`)

export const normalizePriority = (
  priority: number
): Effect.Effect<ChunkPriority, LoadError> => decodePriority(priority)

export const normalizeTimestamp = (
  value: number
): Effect.Effect<Timestamp, LoadError> => decodeTimestamp(value)

export const createRequest = (
  input: ChunkLoadRequestInput
): Effect.Effect<ChunkLoadRequest, LoadError> =>
  Effect.gen(function* () {
    const coordinates = yield* decodeCoordinates(input.coordinates)
    const priority = yield* decodePriority(input.priority)
    const source = yield* decodeSource(input.source)
    const requestedAt = yield* decodeTimestamp(input.requestedAt)
    const id = yield* makeChunkId(coordinates)

    return {
      id,
      coordinates,
      priority,
      source,
      requestedAt,
    }
  })

export const progressFromPhase = (
  phase: LoadPhase
): Effect.Effect<LoadProgress, LoadError> =>
  pipe(
    Match.value(phase._tag),
    Match.when('Queued', () => 0),
    Match.when('Fetching', () => 0.25),
    Match.when('Processing', () => 0.5),
    Match.when('Caching', () => 0.75),
    Match.when('Completed', () => 1),
    Match.when('Failed', () => 1),
    Match.exhaustive,
    (value) => decodeProgress(value)
  )

export const withProgress = (
  sessionId: SessionId,
  phase: LoadPhase,
  timestamp: Timestamp
): Effect.Effect<ChunkLoadProgress, LoadError> =>
  pipe(
    progressFromPhase(phase),
    Effect.map((progress) => ({
      sessionId,
      phase,
      progress,
      updatedAt: timestamp,
    }))
  )

const PreloadFailure = Data.tagged<{ readonly _tag: 'PreloadFailure'; readonly reasons: ReadonlyArray<string> }>('PreloadFailure')

export type PreloadError = ReturnType<typeof PreloadFailure>

export const PreloadError = {
  Failure: (reasons: ReadonlyArray<string>): PreloadError => PreloadFailure({ reasons }),
}

const SessionMissing = Data.tagged<{ readonly _tag: 'SessionNotFoundError'; readonly sessionId: SessionId }>(
  'SessionNotFoundError'
)

export type SessionNotFoundError = ReturnType<typeof SessionMissing>

export const SessionNotFoundError = {
  create: (sessionId: SessionId): SessionNotFoundError => SessionMissing({ sessionId }),
}

export const CacheStatusSchema = Schema.Literal('miss', 'fresh', 'stale', 'hit')
export type CacheStatus = Schema.Schema.Type<typeof CacheStatusSchema>

export const formatLoadError = (error: LoadError): string =>
  pipe(
    error._tag,
    Match.value,
    Match.when('ValidationError', () => `validation error: ${error.message}`),
    Match.when('ConflictError', () => `conflict: ${error.sessionId}`),
    Match.when('InternalError', () => `internal error: ${error.message}`),
    Match.exhaustive
  )

export const cacheStatusFallback = (
  status: Option.Option<CacheStatus>
): CacheStatus => Option.getOrElse(status, () => 'miss')
