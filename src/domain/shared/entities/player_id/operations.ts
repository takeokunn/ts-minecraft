import { Effect, Schema } from 'effect'
import { v4 as uuidv4 } from 'uuid'
import { PlayerIdError } from './errors'
import { PlayerIdSchema, type PlayerId } from './schema'

/**
 * 新しいPlayerIdを生成
 */
export const generate = (): Effect.Effect<PlayerId, never> =>
  Effect.map(
    Effect.sync(() => `player_${uuidv4()}`),
    (value) => PlayerIdSchema.make(value, { disableValidation: true })
  )

/**
 * 文字列からPlayerIdを作成（検証付き）
 */
export const make = (value: string): Effect.Effect<PlayerId, PlayerIdError> =>
  Schema.decode(PlayerIdSchema)(value).pipe(
    Effect.mapError((error) =>
      PlayerIdError.make({
        message: 'Invalid player ID format',
        value,
        cause: error,
      })
    )
  )

/**
 * 文字列からPlayerIdを作成（検証なし）
 *
 * 注意: 既に検証済みの値のみに使用すること
 */
export const makeUnsafe = (value: string): PlayerId => PlayerIdSchema.make(value, { disableValidation: true })

/**
 * PlayerIdを文字列に変換
 */
export const toString = (id: PlayerId): string => id

/**
 * PlayerIdの等価性チェック
 */
export const equals = (a: PlayerId, b: PlayerId): boolean => a === b
