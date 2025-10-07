import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Data, Effect, Match, Option, Schema } from 'effect'
import { pipe } from 'effect/Function'
import type { BlockId, EpochMilliseconds, InteractionEvent, PlayerId, Progress, SessionId } from '../types'
import {
  BlockIdSchema,
  InteractionError,
  InteractionEventSchema,
  PlayerIdSchema,
  ProgressSchema,
  SessionIdSchema,
  TimestampSchema,
} from '../types'
import type { BlockFace, Vector3 } from '../value_object'
import { BlockFaceSchema, Vector3Schema } from '../value_object'

const SessionStateSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('InProgress'),
    progress: ProgressSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Completed'),
    completedAt: TimestampSchema,
  })
)

export type SessionState = Schema.Schema.Type<typeof SessionStateSchema>

export const BreakingSessionSchema = Schema.Struct({
  id: SessionIdSchema,
  playerId: PlayerIdSchema,
  blockId: BlockIdSchema,
  face: BlockFaceSchema,
  origin: Vector3Schema,
  state: SessionStateSchema,
  startedAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

export type BreakingSession = Schema.Schema.Type<typeof BreakingSessionSchema>

export const BreakingSessionError = Data.taggedEnum({
  SchemaViolation: Data.struct({ message: Schema.String }),
  InvalidTransition: Data.struct({ reason: Schema.String, sessionId: SessionIdSchema }),
})

export type BreakingSessionError = typeof BreakingSessionError.Type

const parseError = (error: Schema.ParseError) => TreeFormatter.formatError(error, { includeStackTrace: false })

const toSchemaViolation = (sessionId: SessionId) => (error: Schema.ParseError) =>
  BreakingSessionError.SchemaViolation({ message: `${sessionId}: ${parseError(error)}` })

const decodeSession = Schema.decode(BreakingSessionSchema)

const ensureInProgress = (session: BreakingSession) =>
  pipe(
    Match.value(session.state),
    Match.when(
      (candidate): candidate is Extract<SessionState, { readonly _tag: 'InProgress' }> =>
        candidate._tag === 'InProgress',
      Effect.succeed
    ),
    Match.orElse(() =>
      Effect.fail(
        BreakingSessionError.InvalidTransition({
          reason: '完了済みセッションを更新しようとしました',
          sessionId: session.id,
        })
      )
    )
  )

const makeProgressEvent = (sessionId: SessionId, progress: Progress, timestamp: EpochMilliseconds) =>
  pipe(
    Schema.decode(InteractionEventSchema)({
      _tag: 'BreakProgressed',
      sessionId,
      progress,
      occurredAt: timestamp,
    }),
    Effect.mapError((error) => InteractionError.InvalidCommand({ message: parseError(error) }))
  )

const makeCompletionEvent = (session: BreakingSession, timestamp: EpochMilliseconds) =>
  pipe(
    Schema.decode(InteractionEventSchema)({
      _tag: 'BlockBroken',
      sessionId: session.id,
      blockId: session.blockId,
      occurredAt: timestamp,
    }),
    Effect.mapError((error) => InteractionError.InvalidCommand({ message: parseError(error) }))
  )

export const createSession = (input: {
  readonly id: SessionId
  readonly playerId: PlayerId
  readonly blockId: BlockId
  readonly face: BlockFace
  readonly origin: Vector3
  readonly startedAt: EpochMilliseconds
}) =>
  pipe(
    Schema.decode(ProgressSchema)(0),
    Effect.mapError((error) => InteractionError.InvalidCommand({ message: parseError(error) })),
    Effect.flatMap((zeroProgress) =>
      pipe(
        decodeSession({
          id: input.id,
          playerId: input.playerId,
          blockId: input.blockId,
          face: input.face,
          origin: input.origin,
          state: { _tag: 'InProgress', progress: zeroProgress },
          startedAt: input.startedAt,
          updatedAt: input.startedAt,
        }),
        Effect.mapError(toSchemaViolation(input.id))
      )
    )
  )

export const recordProgress = (
  session: BreakingSession,
  delta: number,
  timestamp: EpochMilliseconds
): Effect.Effect<
  { readonly session: BreakingSession; readonly events: ReadonlyArray<InteractionEvent> },
  BreakingSessionError | InteractionError
> =>
  Effect.gen(function* () {
    const increment = yield* pipe(
      Schema.decode(ProgressSchema)(delta),
      Effect.mapError((error) => InteractionError.InvalidCommand({ message: parseError(error) }))
    )

    const state = yield* ensureInProgress(session)

    const nextValue = Math.min(Number(state.progress) + Number(increment), 1)

    const nextProgress = yield* pipe(
      Schema.decode(ProgressSchema)(nextValue),
      Effect.mapError((error) => InteractionError.InvalidCommand({ message: parseError(error) }))
    )

    const nextState = yield* pipe(
      Effect.succeed(nextProgress >= 1),
      Effect.flatMap((isComplete) =>
        isComplete
          ? Schema.decode(SessionStateSchema)({
              _tag: 'Completed',
              completedAt: timestamp,
            })
          : Schema.decode(SessionStateSchema)({
              _tag: 'InProgress',
              progress: nextProgress,
            })
      ),
      Effect.mapError(toSchemaViolation(session.id))
    )

    const updatedSession = yield* pipe(
      decodeSession({
        ...session,
        state: nextState,
        updatedAt: timestamp,
      }),
      Effect.mapError(toSchemaViolation(session.id))
    )

    const progressEvent = yield* makeProgressEvent(session.id, nextProgress, timestamp)

    const completionEvent = yield* pipe(
      Effect.succeed(nextProgress >= 1),
      Effect.flatMap((isComplete) =>
        isComplete
          ? pipe(
              makeCompletionEvent(session, timestamp),
              Effect.map((event) => Option.some(event))
            )
          : Effect.succeed(Option.none<InteractionEvent>())
      )
    )

    const events = pipe(
      completionEvent,
      Option.match<ReadonlyArray<InteractionEvent>>({
        onNone: () => [progressEvent],
        onSome: (event) => [progressEvent, event],
      })
    )

    return { session: updatedSession, events }
  })

export const completeImmediately = (
  session: BreakingSession,
  timestamp: EpochMilliseconds
): Effect.Effect<
  {
    readonly session: BreakingSession
    readonly events: ReadonlyArray<InteractionEvent>
  },
  BreakingSessionError | InteractionError
> => recordProgress(session, 1, timestamp)
