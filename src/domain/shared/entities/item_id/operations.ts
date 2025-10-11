import { Effect, pipe, Schema } from 'effect'
import { unsafeCoerce } from 'effect/Function'
import type { ItemId } from './schema'
import { ItemIdSchema } from './schema'

/**
 * ItemIdの作成（バリデーション付き）
 */
export const create = (value: string): Effect.Effect<ItemId, Error> =>
  pipe(
    Schema.decode(ItemIdSchema)(value),
    Effect.mapError((parseError) => {
      const issues = (parseError as any).issues?.map((issue: any) => {
        const path = issue.path?.join('.') || 'unknown'
        return `${path}: ${issue.message}`
      }) || []
      return new Error(`ItemIdの作成に失敗: ${issues.join('; ') || String(parseError)}`)
    })
  )

/**
 * ItemIdの安全な作成（同期版）
 */
export const createSync = (value: string): ItemId => {
  try {
    return Schema.decodeSync(ItemIdSchema)(value)
  } catch (error) {
    const issues =
      (error as any)?.issues?.map((issue: any) => {
        const path = issue.path?.join('.') || 'unknown'
        return `${path}: ${issue.message}`
      }) || []
    throw new Error(`ItemIdの作成に失敗: ${issues.join('; ') || String(error)}`)
  }
}

/**
 * ItemIdの作成（検証なし）
 *
 * 注意: 既に検証済みの値のみに使用すること
 */
export const makeUnsafe = (value: string): ItemId => unsafeCoerce<string, ItemId>(value)

/**
 * namespace:name形式のItemIdを作成
 */
export const fromParts = (namespace: string, name: string): Effect.Effect<ItemId, Error> =>
  create(`${namespace}:${name}`)

/**
 * ItemIdの等価性チェック
 */
export const equals = (a: ItemId, b: ItemId): boolean => a === b

/**
 * ItemIdの文字列への変換
 */
export const toString = (id: ItemId): string => id

/**
 * ItemIdからnamespaceを取得
 */
export const getNamespace = (id: ItemId): string => {
  const [namespace] = id.split(':')
  return namespace
}

/**
 * ItemIdからnameを取得
 */
export const getName = (id: ItemId): string => {
  const [, name] = id.split(':')
  return name
}
