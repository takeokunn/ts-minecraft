import { Effect, pipe, Schema } from 'effect'
import type { BlockTypeId } from './schema'
import { BlockTypeIdSchema } from './schema'

/**
 * BlockTypeIdの作成（バリデーション付き）
 */
export const create = (value: number): Effect.Effect<BlockTypeId, Error> =>
  pipe(
    Schema.decode(BlockTypeIdSchema)(value),
    Effect.mapError((parseError) => {
      const issues =
        (parseError as any).issues?.map((issue: any) => {
          const path = issue.path?.join('.') || 'unknown'
          return `${path}: ${issue.message}`
        }) || []
      return new Error(`BlockTypeIdの作成に失敗: ${issues.join('; ') || String(parseError)}`)
    })
  )

/**
 * BlockTypeIdの等価性チェック
 */
export const equals = (a: BlockTypeId, b: BlockTypeId): boolean => a === b

/**
 * BlockTypeIdの数値への変換
 */
export const toNumber = (id: BlockTypeId): number => id as number

/**
 * BlockTypeIdの作成（バリデーションなし）
 *
 * 信頼できるソース（計算結果等）からの値を直接BlockTypeIdに変換する。
 * バリデーションコストを回避するため、unsafeCoerceを使用。
 */
export const makeUnsafe = (value: number): BlockTypeId => value as BlockTypeId
