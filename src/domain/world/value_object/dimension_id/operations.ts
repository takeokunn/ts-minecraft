/**
 * @fileoverview Dimension ID Operations
 * DimensionIdのヘルパー関数とユーティリティ
 */

import { Effect, Match } from 'effect'
import { DimensionIdError } from './errors'
import { DimensionIdSchema, NETHER, OVERWORLD, THE_END, type DimensionId } from './schema'

// === コンストラクタ ===

/**
 * 文字列からDimensionIdを作成（検証付き）
 * @param value - 次元ID文字列
 * @returns 検証済みDimensionId
 */
export const make = (value: string): Effect.Effect<DimensionId, DimensionIdError> =>
  Effect.decode(DimensionIdSchema)(value).pipe(
    Effect.mapError((error) =>
      DimensionIdError.make({
        message: 'Invalid dimension ID',
        value,
        cause: error,
      })
    )
  )

/**
 * 文字列からDimensionIdを作成（検証なし）
 * 警告: 型安全性は保証されない
 * @param value - 次元ID文字列
 * @returns DimensionId
 */
export const makeUnsafe = (value: string): DimensionId => value as DimensionId

// === 変換 ===

/**
 * DimensionIdを文字列に変換
 * @param id - DimensionId
 * @returns 文字列表現
 */
export const toString = (id: DimensionId): string => id

// === 比較 ===

/**
 * 2つのDimensionIdが等しいか比較
 * @param a - 第1のDimensionId
 * @param b - 第2のDimensionId
 * @returns 等しい場合true
 */
export const equals = (a: DimensionId, b: DimensionId): boolean => a === b

// === 型チェック ===

/**
 * オーバーワールドか判定
 * @param id - DimensionId
 * @returns オーバーワールドの場合true
 */
export const isOverworld = (id: DimensionId): boolean => id === OVERWORLD

/**
 * ネザーか判定
 * @param id - DimensionId
 * @returns ネザーの場合true
 */
export const isNether = (id: DimensionId): boolean => id === NETHER

/**
 * ジ・エンドか判定
 * @param id - DimensionId
 * @returns ジ・エンドの場合true
 */
export const isTheEnd = (id: DimensionId): boolean => id === THE_END

// === 表示名変換 ===

/**
 * 表示名を取得
 * @param id - DimensionId
 * @returns 人間が読みやすい表示名
 */
export const getDisplayName = (id: DimensionId): string =>
  Match.value(id).pipe(
    Match.when(OVERWORLD, () => 'Overworld'),
    Match.when(NETHER, () => 'The Nether'),
    Match.when(THE_END, () => 'The End'),
    Match.exhaustive
  )

/**
 * 日本語表示名を取得
 * @param id - DimensionId
 * @returns 日本語の表示名
 */
export const getDisplayNameJa = (id: DimensionId): string =>
  Match.value(id).pipe(
    Match.when(OVERWORLD, () => 'オーバーワールド'),
    Match.when(NETHER, () => 'ネザー'),
    Match.when(THE_END, () => 'ジ・エンド'),
    Match.exhaustive
  )
