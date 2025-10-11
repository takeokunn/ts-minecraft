import { Effect, Schema } from 'effect'
import { v4 as uuidv4 } from 'uuid'
import { DomainEntityIdError } from './errors'
import { DomainEntityIdSchema, type DomainEntityId } from './schema'

// -----------------------------------------------------------------------------
// DomainEntityId 操作関数
// -----------------------------------------------------------------------------

/**
 * 新しいDomainEntityIdを生成
 */
export const generate = (): Effect.Effect<DomainEntityId, never> =>
  Effect.map(
    Effect.sync(() => `entity_${uuidv4()}`),
    (value) => DomainEntityIdSchema.make(value, { disableValidation: true })
  )

/**
 * 文字列からDomainEntityIdを安全に作成
 * バリデーションエラー時はEffect.failを返す
 */
export const make = (value: string): Effect.Effect<DomainEntityId, DomainEntityIdError> =>
  Schema.decode(DomainEntityIdSchema)(value).pipe(
    Effect.mapError((error) =>
      DomainEntityIdError.make({
        message: 'Invalid domain entity ID format',
        value,
        cause: error,
      })
    )
  )

/**
 * 型キャストのみ実施（危険：バリデーション無し）
 * 信頼できるソースからのデータのみに使用
 */
export const makeUnsafe = (value: string): DomainEntityId =>
  DomainEntityIdSchema.make(value, { disableValidation: true })

/**
 * DomainEntityIdを文字列に変換
 */
export const toString = (id: DomainEntityId): string => id

/**
 * 2つのDomainEntityIdが等しいか判定
 */
export const equals = (a: DomainEntityId, b: DomainEntityId): boolean => a === b
