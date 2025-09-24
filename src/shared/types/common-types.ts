import { Effect } from 'effect'

/**
 * 基本的な数値型
 */
export type NumberValue = number

/**
 * 基本的な文字列型
 */
export type StringValue = string

/**
 * 基本的なブール型
 */
export type BooleanValue = boolean

/**
 * Result型 - Effect-TSのEffect型のエイリアス
 * 成功値Aと失敗値Eを持つ計算を表現
 */
export type Result<A, E = Error> = Effect.Effect<A, E>

/**
 * Option型 - 値が存在するかどうかを表現
 */
export type Option<T> = T | null | undefined

/**
 * NonEmptyArray型 - 空でない配列
 */
export type NonEmptyArray<T> = readonly [T, ...T[]]

/**
 * Predicate型 - 条件判定関数
 */
export type Predicate<T> = (value: T) => boolean

/**
 * Callback型 - コールバック関数
 */
export type Callback<T = void> = (value: T) => void

/**
 * AsyncCallback型 - 非同期コールバック関数（Effect-TSパターン）
 */
export type AsyncCallback<T = void> = (value: T) => Effect.Effect<void>

/**
 * DeepReadonly型 - 深い読み取り専用型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * DeepPartial型 - 深い部分型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
