import { Effect, pipe, Schema } from 'effect'
import type { BlockTypeId } from './schema'
import { BlockTypeIdSchema } from './schema'

/**
 * BlockTypeIdの作成（バリデーション付き）
 */
export const create = (value: number): Effect.Effect<BlockTypeId, Error> =>
  pipe(
    Schema.decode(BlockTypeIdSchema)(value),
    Effect.mapError((error) => new Error(`BlockTypeIdの作成に失敗: ${String(error)}`))
  )

/**
 * BlockTypeIdの等価性チェック
 */
export const equals = (a: BlockTypeId, b: BlockTypeId): boolean => a === b

/**
 * BlockTypeIdの数値への変換
 */
export const toNumber = (id: BlockTypeId): number => id as number
