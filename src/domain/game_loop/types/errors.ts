import * as Data from 'effect/Data'
import * as Either from 'effect/Either'
import { pipe } from 'effect/Function'
import * as Schema from 'effect/Schema'

import type { FramesPerSecond, Timestamp } from './index'

/**
 * GameLoop ドメインのエラー ADT
 */

export interface InitializationError {
  readonly _tag: 'InitializationError'
  readonly reason: string
}
export const InitializationError = Data.tagged<InitializationError>('InitializationError')

export interface StateTransitionError {
  readonly _tag: 'StateTransitionError'
  readonly from: string
  readonly to: string
  readonly message: string
}
export const StateTransitionError = Data.tagged<StateTransitionError>('StateTransitionError')

export interface PerformanceError {
  readonly _tag: 'PerformanceError'
  readonly metric: 'fps' | 'stutter'
  readonly target: FramesPerSecond
  readonly observed: FramesPerSecond
}
export const PerformanceError = Data.tagged<PerformanceError>('PerformanceError')

export interface RuntimeCallbackError {
  readonly _tag: 'RuntimeCallbackError'
  readonly callbackId: string
  readonly causeMessage: string
  readonly occurredAt: Timestamp
}
export const RuntimeCallbackError = Data.tagged<RuntimeCallbackError>('RuntimeCallbackError')

export type GameLoopError = InitializationError | StateTransitionError | PerformanceError | RuntimeCallbackError

export const InitializationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('InitializationError'),
  reason: Schema.String,
})

export const StateTransitionErrorSchema = Schema.Struct({
  _tag: Schema.Literal('StateTransitionError'),
  from: Schema.String,
  to: Schema.String,
  message: Schema.String,
})

export const PerformanceErrorSchema = Schema.Struct({
  _tag: Schema.Literal('PerformanceError'),
  metric: Schema.Union(Schema.Literal('fps'), Schema.Literal('stutter')),
  target: Schema.Number,
  observed: Schema.Number,
})

export const RuntimeCallbackErrorSchema = Schema.Struct({
  _tag: Schema.Literal('RuntimeCallbackError'),
  callbackId: Schema.String,
  causeMessage: Schema.String,
  occurredAt: Schema.Number,
})

export const GameLoopErrorSchema = Schema.Union(
  InitializationErrorSchema,
  StateTransitionErrorSchema,
  PerformanceErrorSchema,
  RuntimeCallbackErrorSchema
)

export const toInitializationError = (reason: string): InitializationError => InitializationError({ reason })

export const toStateTransitionError = (parameters: {
  readonly from: string
  readonly to: string
  readonly message: string
}): StateTransitionError => StateTransitionError(parameters)

export const toPerformanceError = (parameters: {
  readonly target: FramesPerSecond
  readonly observed: FramesPerSecond
  readonly metric: 'fps' | 'stutter'
}): PerformanceError => PerformanceError(parameters)

export const toRuntimeCallbackError = (parameters: {
  readonly callbackId: string
  readonly causeMessage: string
  readonly occurredAt: Timestamp
}): RuntimeCallbackError => RuntimeCallbackError(parameters)

export const decodeGameLoopError = (input: unknown): Either.Either<Schema.ParseError, GameLoopError> =>
  Schema.decodeEither(GameLoopErrorSchema)(input)

export const stringifyGameLoopError = (error: GameLoopError): string =>
  pipe(
    Schema.encodeEither(GameLoopErrorSchema)(error),
    Either.map((encoded) => JSON.stringify(encoded)),
    Either.getOrElse((issue) =>
      JSON.stringify({
        _tag: 'CodecFailure',
        message: Schema.formatError(issue),
      })
    )
  )
