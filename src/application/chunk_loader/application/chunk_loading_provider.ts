import { Clock, Effect, HashMap, Layer, Match, Option, Random, SynchronizedRef, pipe } from 'effect'
import { SessionState, createSession, transition } from '@domain/chunk_loader/domain'
import {
  CacheStatus,
  ChunkId,
  ChunkLoadRequest,
  ChunkLoadRequestInput,
  ChunkLoadingProvider,
  ChunkLoadingProviderTag,
  LoadError,
  LoadPhase,
  LoadProgress,
  PerformanceStats,
  SessionId,
  SessionNotFoundError,
  cacheStatusFallback,
  createRequest,
  makeSessionId,
  normalizeTimestamp,
  progressFromPhase,
} from '@domain/chunk_loader/types'

interface MetricsState {
  readonly activeSessions: number
  readonly completedSessions: number
  readonly failedSessions: number
  readonly totalLatency: number
  readonly cacheHits: number
  readonly totalLoads: number
}

interface LoaderState {
  readonly sessions: HashMap.HashMap<SessionId, SessionState>
  readonly cache: HashMap.HashMap<ChunkId, CacheStatus>
  readonly metrics: MetricsState
}

const initialMetrics: MetricsState = {
  activeSessions: 0,
  completedSessions: 0,
  failedSessions: 0,
  totalLatency: 0,
  cacheHits: 0,
  totalLoads: 0,
}

const initialState: LoaderState = {
  sessions: HashMap.empty<SessionId, SessionState>(),
  cache: HashMap.empty<ChunkId, CacheStatus>(),
  metrics: initialMetrics,
}

const metricsToStats = (metrics: MetricsState): PerformanceStats => ({
  activeSessions: metrics.activeSessions,
  completedSessions: metrics.completedSessions,
  failedSessions: metrics.failedSessions,
  averageLatency: metrics.completedSessions === 0 ? 0 : metrics.totalLatency / metrics.completedSessions,
  cacheHitRate: metrics.totalLoads === 0 ? 0 : metrics.cacheHits / metrics.totalLoads,
})

const finalizeMetrics = (
  metrics: MetricsState,
  outcome: 'success' | 'failure',
  latency: number,
  cacheHit: boolean
): MetricsState =>
  pipe(
    Match.value(outcome),
    Match.when('success', () => ({
      activeSessions: metrics.activeSessions,
      completedSessions: metrics.completedSessions + 1,
      failedSessions: metrics.failedSessions,
      totalLatency: metrics.totalLatency + latency,
      cacheHits: metrics.cacheHits + (cacheHit ? 1 : 0),
      totalLoads: metrics.totalLoads + 1,
    })),
    Match.when('failure', () => ({
      activeSessions: metrics.activeSessions,
      completedSessions: metrics.completedSessions,
      failedSessions: metrics.failedSessions + 1,
      totalLatency: metrics.totalLatency,
      cacheHits: metrics.cacheHits,
      totalLoads: metrics.totalLoads + 1,
    })),
    Match.exhaustive
  )

const updateCache = (
  cache: HashMap.HashMap<ChunkId, CacheStatus>,
  outcome: 'success' | 'failure',
  request: ChunkLoadRequest,
  cacheHit: boolean
): HashMap.HashMap<ChunkId, CacheStatus> =>
  pipe(
    Match.value(outcome),
    Match.when('success', () => HashMap.set(cache, request.id, cacheHit ? 'hit' : 'fresh')),
    Match.when('failure', () => HashMap.set(cache, request.id, 'stale')),
    Match.exhaustive
  )

const computeOutcome = (entropy: number): 'success' | 'failure' =>
  pipe(
    Match.value(entropy % 5 === 0),
    Match.when(true, () => 'failure' as const),
    Match.orElse(() => 'success' as const)
  )

const computeCacheHit = (request: ChunkLoadRequest, entropy: number): boolean =>
  pipe(
    Match.value(request.source),
    Match.when('prefetch', () => true),
    Match.when('system', () => entropy % 2 === 0),
    Match.orElse(() => entropy % 4 === 0)
  )

const planPhases = (request: ChunkLoadRequest, entropy: number): ReadonlyArray<LoadPhase> => {
  const base: ReadonlyArray<LoadPhase> = [
    LoadPhase.Fetching({ stage: 'network' }),
    LoadPhase.Fetching({ stage: 'decode' }),
    LoadPhase.Processing({ stage: 'meshing' }),
    LoadPhase.Processing({ stage: 'lighting' }),
    LoadPhase.Caching(),
  ]
  const outcome = computeOutcome(entropy)
  return pipe(
    Match.value(outcome),
    Match.when('success', () => base.concat([LoadPhase.Completed({ cacheHit: computeCacheHit(request, entropy) })])),
    Match.when('failure', () => base.concat([LoadPhase.Failed({ reason: 'simulated-load-failure' })])),
    Match.exhaustive
  )
}

export const makeChunkLoadingProvider = (): Effect.Effect<ChunkLoadingProvider, LoadError> =>
  Effect.gen(function* () {
    const stateRef = yield* SynchronizedRef.make(initialState)

    const enqueue = (input: ChunkLoadRequestInput): Effect.Effect<SessionId, LoadError> =>
      Effect.gen(function* () {
        const parsedRequest = yield* createRequest(input)
        const currentMillis = Math.floor(yield* Clock.currentTimeMillis)
        const timestamp = yield* normalizeTimestamp(currentMillis)
        const randomInt = yield* Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER)
        const entropy = randomInt.toString(16).padStart(16, '0').slice(-16)
        const sessionId = yield* makeSessionId(timestamp, entropy)
        const initialSession = yield* createSession(sessionId, parsedRequest, timestamp)
        const phases = planPhases(parsedRequest, randomInt)

        const finalSession = yield* Effect.reduce(phases, initialSession, (state, phase, index) =>
          pipe(
            normalizeTimestamp(currentMillis + index + 1),
            Effect.flatMap((ts) => transition(state, phase, ts))
          )
        )

        const outcome = computeOutcome(randomInt)
        const latency = Number(finalSession.updatedAt) - Number(initialSession.startedAt)

        yield* SynchronizedRef.update(stateRef, (current) => ({
          sessions: HashMap.set(current.sessions, sessionId, finalSession),
          cache: updateCache(current.cache, outcome, parsedRequest, finalSession.cacheHit),
          metrics: finalizeMetrics(current.metrics, outcome, latency, finalSession.cacheHit),
        }))

        return sessionId
      })

    const observe = (
      sessionId: SessionId
    ): Effect.Effect<
      {
        readonly sessionId: SessionId
        readonly phase: LoadPhase
        readonly progress: LoadProgress
        readonly updatedAt: Timestamp
      },
      SessionNotFoundError
    > =>
      Effect.gen(function* () {
        const state = yield* SynchronizedRef.get(stateRef)
        const sessionOption = HashMap.get(state.sessions, sessionId)

        return yield* Option.match(sessionOption, {
          onNone: () => Effect.fail(SessionNotFoundError.create(sessionId)),
          onSome: (session) =>
            pipe(
              progressFromPhase(session.phase),
              Effect.mapError(() => SessionNotFoundError.create(sessionId)),
              Effect.map((progress) => ({
                sessionId,
                phase: session.phase,
                progress,
                updatedAt: session.updatedAt,
              }))
            ),
        })
      })

    const metrics = (): Effect.Effect<PerformanceStats> =>
      pipe(
        SynchronizedRef.get(stateRef),
        Effect.map((state) => metricsToStats(state.metrics))
      )

    const cacheStatus = (chunkId: ChunkId): Effect.Effect<CacheStatus> =>
      pipe(
        SynchronizedRef.get(stateRef),
        Effect.map((state) => cacheStatusFallback(HashMap.get(state.cache, chunkId)))
      )

    const evict = (chunkId: ChunkId): Effect.Effect<CacheStatus> =>
      SynchronizedRef.modify(stateRef, (state) => {
        const status = cacheStatusFallback(HashMap.get(state.cache, chunkId))
        return [
          status,
          {
            sessions: state.sessions,
            cache: HashMap.remove(state.cache, chunkId),
            metrics: state.metrics,
          },
        ] as const
      })

    return { enqueue, observe, metrics, cacheStatus, evict }
  })

export const ChunkLoadingProviderLive = Layer.effect(ChunkLoadingProviderTag, makeChunkLoadingProvider())

export const ChunkLoaderDomainLive = ChunkLoadingProviderLive
