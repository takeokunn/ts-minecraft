import { Effect, pipe, Schema } from 'effect'
import type { ItemId } from './schema'
import { ItemIdSchema } from './schema'

/**
 * ItemIdの作成（バリデーション付き）
 */
export const create = (value: string): Effect.Effect<ItemId, Error> =>
  pipe(
    Schema.decode(ItemIdSchema)(value),
    Effect.mapError((error) => new Error(`ItemIdの作成に失敗: ${String(error)}`))
  )

/**
 * ItemIdの安全な作成（同期版）
 */
export const createSync = (value: string): ItemId => Schema.decodeSync(ItemIdSchema)(value)

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
