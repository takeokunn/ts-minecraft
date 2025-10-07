import { Effect, pipe, Schema } from 'effect'
import type { BlockId } from './schema'
import { BlockIdSchema } from './schema'

/**
 * BlockIdの作成（バリデーション付き）
 */
export const create = (value: string): Effect.Effect<BlockId, Error> =>
  pipe(
    Schema.decode(BlockIdSchema)(value),
    Effect.mapError((error) => new Error(`BlockIdの作成に失敗: ${String(error)}`))
  )

/**
 * BlockIdの安全な作成（同期版）
 */
export const createSync = (value: string): BlockId => Schema.decodeSync(BlockIdSchema)(value)

/**
 * BlockIdの等価性チェック
 */
export const equals = (a: BlockId, b: BlockId): boolean => a === b

/**
 * BlockIdの文字列への変換
 */
export const toString = (id: BlockId): string => id
