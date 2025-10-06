/**
 * Interaction Parsers
 *
 * インタラクションコマンド・イベントのパーサーを提供します。
 */

import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Effect, Either, Schema } from 'effect'
import { pipe } from 'effect/Function'
import { InteractionCommandSchema, InteractionError } from './types/index'

const parseError = (error: Schema.ParseError) => TreeFormatter.formatError(error, { includeStackTrace: false })

const toInvalidCommand = (error: Schema.ParseError) => InteractionError.InvalidCommand({ message: parseError(error) })

/**
 * コマンドをパース（Effect版）
 */
export const parseCommand = (input: unknown) =>
  pipe(Schema.decode(InteractionCommandSchema)(input), Effect.mapError(toInvalidCommand))

/**
 * コマンドをパース（Either版）
 */
export const parseCommandEither = (input: unknown) =>
  pipe(Schema.decodeEither(InteractionCommandSchema)(input), Either.mapLeft(toInvalidCommand))
