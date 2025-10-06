import { Effect, Schema } from 'effect'
import { ECSEntityIdError } from './errors'
import { ECSEntityIdSchema, INVALID_ECS_ENTITY_ID, type ECSEntityId } from './schema'

// -----------------------------------------------------------------------------
// グローバルIDカウンター（ECS内部使用）
// -----------------------------------------------------------------------------

/**
 * ECSEntityId生成器
 * 連番IDを生成するシングルトンファクトリー
 */
const createIdGenerator = () => {
  let nextId = 0

  return {
    /**
     * 新しいECSEntityIdを生成
     * スレッドセーフではないため、単一スレッド環境での使用を想定
     */
    generate: (): Effect.Effect<ECSEntityId, never> =>
      Effect.sync(() => {
        const id = nextId
        nextId += 1
        return id as ECSEntityId
      }),

    /**
     * カウンターをリセット（テスト用）
     */
    reset: (): Effect.Effect<void, never> =>
      Effect.sync(() => {
        nextId = 0
      }),
  }
}

export const IdGenerator = createIdGenerator()

// -----------------------------------------------------------------------------
// ECSEntityId 操作関数
// -----------------------------------------------------------------------------

/**
 * 数値からECSEntityIdを安全に作成
 * バリデーションエラー時はEffect.failを返す
 */
export const make = (value: number): Effect.Effect<ECSEntityId, ECSEntityIdError> =>
  Schema.decode(ECSEntityIdSchema)(value).pipe(
    Effect.mapError(
      (error) =>
        new ECSEntityIdError({
          message: 'Invalid ECS entity ID: must be non-negative integer',
          value,
          cause: error,
        })
    )
  )

/**
 * 型キャストのみ実施（危険：バリデーション無し）
 * 信頼できるソースからのデータのみに使用
 */
export const makeUnsafe = (value: number): ECSEntityId => value as ECSEntityId

/**
 * ECSEntityIdを数値に変換
 */
export const toNumber = (id: ECSEntityId): number => id

/**
 * 2つのECSEntityIdが等しいか判定
 */
export const equals = (a: ECSEntityId, b: ECSEntityId): boolean => a === b

/**
 * ECSEntityIdが有効か判定
 * 0以上の値を有効とみなす
 */
export const isValid = (id: ECSEntityId): boolean => id >= 0

export { INVALID_ECS_ENTITY_ID }
