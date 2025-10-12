import {
  BreakingSessionError,
  completeImmediately,
  createSession,
  recordProgress,
} from '@/domain/interaction/aggregate'
import { validatePlacement } from '@/domain/interaction/domain_service'
import type { SessionStore } from '@/domain/interaction/repository'
import { SessionStoreTag } from '@/domain/interaction/repository'
import type { InteractionCommand, InteractionEvent } from '@/domain/interaction/types'
import { InteractionError, InteractionEventSchema, ProgressSchema, decodeSessionId } from '@/domain/interaction/types'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Clock, Context, Effect, Layer, Match, Option, Schema } from 'effect'
import { pipe } from 'effect/Function'

const parseError = (error: Schema.ParseError) => TreeFormatter.formatError(error, { includeStackTrace: false })

const toInvalidCommand = (message: string) => InteractionError.InvalidCommand({ message })

const ensureSession = (store: SessionStore, sessionId: Parameters<SessionStore['get']>[0]) =>
  pipe(
    store.get(sessionId),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(InteractionError.UnknownSession({ sessionId })),
        onSome: Effect.succeed,
      })
    )
  )

const generateSessionId = (playerId: string) =>
  pipe(
    Clock.currentTimeMillis,
    Effect.flatMap((milliseconds) => decodeSessionId(`${playerId}-${milliseconds}`)),
    Effect.mapError((error) => toInvalidCommand(parseError(error)))
  )

const makeEvent = (input: InteractionEvent) =>
  pipe(
    Schema.decode(InteractionEventSchema)(input),
    Effect.mapError((error) => toInvalidCommand(parseError(error)))
  )

const zeroProgress = pipe(
  Schema.decode(ProgressSchema)(0),
  Effect.mapError((error) => toInvalidCommand(parseError(error)))
)

const handleStartBreaking = (
  command: Extract<InteractionCommand, { readonly _tag: 'StartBreaking' }>,
  store: SessionStore
) =>
  Effect.gen(function* () {
    const sessionId = yield* generateSessionId(command.playerId)
    const timestamp = yield* Clock.currentTimeMillis
    const session = yield* createSession({
      id: sessionId,
      playerId: command.playerId,
      blockId: command.blockId,
      face: command.face,
      origin: command.position,
      startedAt: timestamp,
    })

    yield* store.save(session)

    const progress = yield* zeroProgress

    const event = yield* makeEvent({
      _tag: 'BreakProgressed',
      sessionId,
      progress,
      occurredAt: timestamp,
    })

    return [event] as ReadonlyArray<InteractionEvent>
  })

const handleContinueBreaking = (
  command: Extract<InteractionCommand, { readonly _tag: 'ContinueBreaking' }>,
  store: SessionStore
) =>
  Effect.gen(function* () {
    const session = yield* ensureSession(store, command.sessionId)
    const timestamp = yield* Clock.currentTimeMillis
    const result = yield* recordProgress(session, command.progressDelta, timestamp)

    yield* store.save(result.session)

    return result.events
  })

const handleCompleteBreaking = (
  command: Extract<InteractionCommand, { readonly _tag: 'CompleteBreaking' }>,
  store: SessionStore
) =>
  Effect.gen(function* () {
    const session = yield* ensureSession(store, command.sessionId)
    const timestamp = yield* Clock.currentTimeMillis
    const result = yield* completeImmediately(session, timestamp)

    yield* store.save(result.session)

    return result.events
  })

const handlePlaceBlock = (command: Extract<InteractionCommand, { readonly _tag: 'PlaceBlock' }>) =>
  Effect.gen(function* () {
    yield* validatePlacement({
      face: command.face,
      playerPosition: command.playerPosition,
      blockPosition: command.position,
    })

    const timestamp = yield* Clock.currentTimeMillis

    const event = yield* makeEvent({
      _tag: 'BlockPlaced',
      playerId: command.playerId,
      blockId: command.blockId,
      position: command.position,
      playerPosition: command.playerPosition,
      face: command.face,
      occurredAt: timestamp,
    })

    return [event] as ReadonlyArray<InteractionEvent>
  })

export const executeCommand = (
  command: InteractionCommand,
  providedStore?: SessionStore
): Effect.Effect<ReadonlyArray<InteractionEvent>, InteractionError | BreakingSessionError> =>
  Effect.gen(function* () {
    const store = providedStore ?? (yield* Effect.contextWith((context) => Context.get(context, SessionStoreTag)))

    return yield* pipe(
      Match.value(command),
      Match.tags({
        StartBreaking: (start) => handleStartBreaking(start, store),
        ContinueBreaking: (cont) => handleContinueBreaking(cont, store),
        CompleteBreaking: (complete) => handleCompleteBreaking(complete, store),
        PlaceBlock: handlePlaceBlock,
      }),
      Match.exhaustive
    )
  })

export interface SessionManager {
  readonly execute: (
    command: InteractionCommand
  ) => Effect.Effect<ReadonlyArray<InteractionEvent>, InteractionError | BreakingSessionError>
}

export const SessionManagerTag = Context.Tag<SessionManager>('@domain/interaction/SessionManager')

export const SessionManagerLive = Layer.effect(SessionManagerTag, Effect.succeed({ execute: executeCommand }))
