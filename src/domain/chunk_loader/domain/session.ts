import { Effect, Match, Option, pipe } from 'effect'
import type { ChunkLoadProgress, ChunkLoadRequest, LoadProgress, SessionId, Timestamp } from '../types/interfaces'
import { LoadError, LoadPhase, progressFromPhase, withProgress } from '../types/interfaces'

export interface SessionState {
  readonly sessionId: SessionId
  readonly request: ChunkLoadRequest
  readonly startedAt: Timestamp
  readonly updatedAt: Timestamp
  readonly phase: LoadPhase
  readonly progress: LoadProgress
  readonly cacheHit: boolean
}

const regressionError = LoadError.Internal('progress regression detected')

export const createSession = (
  sessionId: SessionId,
  request: ChunkLoadRequest,
  timestamp: Timestamp
): Effect.Effect<SessionState, LoadError> =>
  Effect.gen(function* () {
    const initialProgress = yield* progressFromPhase(LoadPhase.Queued())

    return {
      sessionId,
      request,
      startedAt: timestamp,
      updatedAt: timestamp,
      phase: LoadPhase.Queued(),
      progress: initialProgress,
      cacheHit: false,
    }
  })

const resolveCacheHit = (current: SessionState, phase: LoadPhase): boolean =>
  pipe(
    Match.value(phase),
    Match.when({ _tag: 'Completed' }, (completed) => completed.cacheHit),
    Match.when({ _tag: 'Failed' }, () => false),
    Match.orElse(() => current.cacheHit)
  )

export const transition = (
  state: SessionState,
  phase: LoadPhase,
  timestamp: Timestamp
): Effect.Effect<SessionState, LoadError> =>
  Effect.gen(function* () {
    const nextProgress = yield* progressFromPhase(phase)

    return yield* pipe(
      Match.value(nextProgress >= state.progress),
      Match.when(true, () =>
        Effect.succeed<SessionState>({
          sessionId: state.sessionId,
          request: state.request,
          startedAt: state.startedAt,
          updatedAt: timestamp,
          phase,
          progress: nextProgress,
          cacheHit: resolveCacheHit(state, phase),
        })
      ),
      Match.orElse(() => Effect.fail(regressionError))
    )
  })

export const toProgressSnapshot = (
  state: SessionState,
  timestamp: Timestamp
): Effect.Effect<ChunkLoadProgress, LoadError> => withProgress(state.sessionId, state.phase, timestamp)

export const markCacheHit = (state: SessionState): SessionState => ({
  sessionId: state.sessionId,
  request: state.request,
  startedAt: state.startedAt,
  updatedAt: state.updatedAt,
  phase: state.phase,
  progress: state.progress,
  cacheHit: true,
})

export const touch = (state: SessionState, timestamp: Timestamp): SessionState => ({
  sessionId: state.sessionId,
  request: state.request,
  startedAt: state.startedAt,
  updatedAt: timestamp,
  phase: state.phase,
  progress: state.progress,
  cacheHit: state.cacheHit,
})

export const isTerminal = (state: SessionState): boolean =>
  pipe(
    Match.value(state.phase._tag),
    Match.when('Completed', () => true),
    Match.when('Failed', () => true),
    Match.orElse(() => false)
  )

export const terminate = (
  state: SessionState,
  timestamp: Timestamp,
  outcome: 'success' | 'failure'
): Effect.Effect<SessionState, LoadError> =>
  pipe(
    Match.value(outcome),
    Match.when('success', () => LoadPhase.Completed({ cacheHit: state.cacheHit })),
    Match.when('failure', () => LoadPhase.Failed({ reason: 'processing failure' })),
    Match.exhaustive,
    (phase) => transition(state, phase, timestamp)
  )

export const recalculateAverage = (previousAverage: number, previousCount: number, sample: number): number =>
  pipe(
    Match.value(previousCount > 0),
    Match.when(true, () => (previousAverage * previousCount + sample) / (previousCount + 1)),
    Match.orElse(() => sample)
  )

export const cacheHitRatio = (hits: number, total: number): number =>
  pipe(
    Match.value(total === 0),
    Match.when(true, () => 0),
    Match.orElse(() => hits / total)
  )

export const nextTimestamp = (hint: Option.Option<Timestamp>, fallback: Timestamp): Timestamp =>
  Option.getOrElse(hint, () => fallback)
