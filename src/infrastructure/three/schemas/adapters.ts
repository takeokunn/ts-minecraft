/**
 * @fileoverview THREE.js Schema Adapters
 *
 * THREE.jsの型とドメイン型の相互変換用アダプター。
 * パフォーマンスクリティカルな変換のためのmakeUnsafe系ヘルパーを提供。
 */

import { Effect, Schema } from 'effect'
import { MatrixDimensionError } from './errors'

// Matrix4要素型（16要素のタプル）
type Matrix4Elements = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

// Matrix3要素型（9要素のタプル）
type Matrix3Elements = readonly [number, number, number, number, number, number, number, number, number]

// Matrix4要素のSchemaバリデーション
const Matrix4ElementsSchema = Schema.Tuple(
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number
)

// Matrix3要素のSchemaバリデーション
const Matrix3ElementsSchema = Schema.Tuple(
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number
)

/**
 * THREE.Matrix4.elementsをタプル型に変換（型安全）
 *
 * THREE.jsのMatrix4.elementsはnumber[]型だが、
 * 常に16要素の配列であることが保証されている。
 * このヘルパーは型安全にタプル型へ変換する。
 *
 * パフォーマンス: Schema検証による若干のオーバーヘッド（ただし安全性が向上）
 */
export const matrix4ElementsToTuple = (
  elements: ReadonlyArray<number>
): Effect.Effect<Matrix4Elements, MatrixDimensionError> =>
  Schema.decodeUnknown(Matrix4ElementsSchema)(elements).pipe(
    Effect.mapError(() =>
      MatrixDimensionError.make({
        matrixType: 'Matrix4',
        expected: 16,
        actual: elements.length,
        message: `Matrix4には16要素が必要ですが、${elements.length}要素でした`,
      })
    )
  )

/**
 * THREE.Matrix3.elementsをタプル型に変換（型安全）
 *
 * THREE.jsのMatrix3.elementsはnumber[]型だが、
 * 常に9要素の配列であることが保証されている。
 *
 * パフォーマンス: Schema検証による若干のオーバーヘッド（ただし安全性が向上）
 */
export const matrix3ElementsToTuple = (
  elements: ReadonlyArray<number>
): Effect.Effect<Matrix3Elements, MatrixDimensionError> =>
  Schema.decodeUnknown(Matrix3ElementsSchema)(elements).pipe(
    Effect.mapError(() =>
      MatrixDimensionError.make({
        matrixType: 'Matrix3',
        expected: 9,
        actual: elements.length,
        message: `Matrix3には9要素が必要ですが、${elements.length}要素でした`,
      })
    )
  )

/**
 * 型アサーション削除のためのヘルパー関数
 *
 * これらの関数は、THREE.jsのオブジェクトが内部で正しい構造を持つことを
 * 保証しつつ、TypeScriptの型システムに適合させる。
 */
