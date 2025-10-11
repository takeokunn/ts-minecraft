import { Effect, Schema } from 'effect'
import { v4 as uuidv4 } from 'uuid'
import { EntityIdError } from './errors'
import { EntityIdSchema, type EntityId } from './schema'

/**
 * 新しいEntityIdを生成
 */
export const generate = (): Effect.Effect<EntityId, never> =>
  Effect.map(
    Effect.sync(() => `entity_${uuidv4()}`),
    (value) => Schema.make(EntityIdSchema)(value)
  )

/**
 * 文字列からEntityIdを安全に作成
 * バリデーションエラー時はEffect.failを返す
 */
export const make = (value: string): Effect.Effect<EntityId, EntityIdError> =>
  Schema.decode(EntityIdSchema)(value).pipe(
    Effect.mapError((error) =>
      EntityIdError.make({
        message: 'Invalid entity ID format',
        value,
        cause: error,
      })
    )
  )

/**
 * 文字列からEntityIdを作成（検証なし）
 *
 * 注意: 既に検証済みの値のみに使用すること
 * パフォーマンスクリティカルな箇所でのみ使用
 */
export const makeUnsafe = (value: string): EntityId => Schema.make(EntityIdSchema)(value)

/**
 * EntityIdを文字列に変換
 */
export const toString = (id: EntityId): string => id

/**
 * EntityIdの等価性チェック
 */
export const equals = (a: EntityId, b: EntityId): boolean => a === b
