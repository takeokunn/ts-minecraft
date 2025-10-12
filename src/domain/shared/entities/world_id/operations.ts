import { Effect, Schema } from 'effect'
import { createWorldIdError, type WorldIdError } from './errors'
import { WorldIdSchema, type WorldId } from './schema'

/**
 * 文字列からWorldIdを作成（検証付き）
 */
export const make = (value: string): Effect.Effect<WorldId, WorldIdError | Schema.ParseError> =>
  Schema.decode(WorldIdSchema)(value).pipe(
    Effect.mapError((error) => createWorldIdError('Invalid world ID format', value, error)),
    Effect.flatten
  )

/**
 * 文字列からWorldIdを作成（検証なし）
 *
 * 注意: 既に検証済みの値のみに使用すること
 */
export const makeUnsafe = (value: string): WorldId => WorldIdSchema.make(value, { disableValidation: true })

/**
 * WorldIdを文字列に変換
 */
export const toString = (id: WorldId): string => id

/**
 * WorldIdの等価性チェック
 */
export const equals = (a: WorldId, b: WorldId): boolean => a === b
