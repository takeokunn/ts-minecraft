/**
 * @fileoverview THREE.js Schema Adapter Errors
 *
 * THREE.jsスキーマアダプターで発生する可能性のあるエラー型定義
 */

import { Schema } from 'effect'

/**
 * Matrix次元エラー
 *
 * Matrix4またはMatrix3の要素数が期待される数と異なる場合に発生
 */
export class MatrixDimensionError extends Schema.TaggedError<MatrixDimensionError>()('MatrixDimensionError', {
  matrixType: Schema.Literal('Matrix4', 'Matrix3'),
  expected: Schema.Number,
  actual: Schema.Number,
  message: Schema.String,
}) {}
