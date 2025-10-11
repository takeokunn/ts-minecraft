/**
 * @fileoverview Three.js Matrix3 - Effect-TSラッパー
 * 3x3行列の型安全な不変操作を提供
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { matrix3ElementsToTuple } from '../schemas/adapters'

/**
 * Matrix3 Schema定義（Brand型）
 * 3x3行列（列優先順序で16要素配列）
 */
export const Matrix3Schema = Schema.Struct({
  elements: Schema.Tuple(
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number
  ),
}).pipe(Schema.brand('ThreeMatrix3'))

export type Matrix3 = Schema.Schema.Type<typeof Matrix3Schema>

/**
 * Matrix3エラー型
 */
export const Matrix3Error = Schema.TaggedError('Matrix3Error')({
  operation: Schema.String,
  reason: Schema.String,
  cause: Schema.Unknown,
})
export type Matrix3Error = Schema.Schema.Type<typeof Matrix3Error>

/**
 * Matrix3コンストラクタ - 要素配列から構築
 */
export const make = (
  elements: readonly [number, number, number, number, number, number, number, number, number]
): Matrix3 => Schema.decodeUnknownSync(Matrix3Schema)({ elements })

/**
 * 単位行列
 */
export const identity: Matrix3 = make([1, 0, 0, 0, 1, 0, 0, 0, 1])

/**
 * ゼロ行列
 */
export const zero: Matrix3 = make([0, 0, 0, 0, 0, 0, 0, 0, 0])

/**
 * Three.js Matrix3からEffect型への変換
 */
export const fromThreeMatrix = (m: THREE.Matrix3): Effect.Effect<Matrix3, never> =>
  Effect.sync(() => make(matrix3ElementsToTuple(m.elements)))

/**
 * Effect型からThree.js Matrix3への変換
 */
export const toThreeMatrix = (m: Matrix3): THREE.Matrix3 => new THREE.Matrix3().fromArray(m.elements)

/**
 * 行列の乗算
 */
export const multiply = (a: Matrix3, b: Matrix3): Matrix3 => {
  const threeA = toThreeMatrix(a)
  const threeB = toThreeMatrix(b)
  threeA.multiply(threeB)
  return make(matrix3ElementsToTuple(threeA.elements))
}

/**
 * 行列の転置
 */
export const transpose = (m: Matrix3): Matrix3 => {
  const threeM = toThreeMatrix(m)
  threeM.transpose()
  return make(matrix3ElementsToTuple(threeM.elements))
}

/**
 * 行列式の計算
 */
export const determinant = (m: Matrix3): number => toThreeMatrix(m).determinant()

/**
 * 逆行列の計算
 */
export const invert = (m: Matrix3): Effect.Effect<Matrix3, Matrix3Error> =>
  Effect.gen(function* () {
    const det = determinant(m)
    if (Math.abs(det) < Number.EPSILON) {
      return yield* Effect.fail(
        new Matrix3Error({
          operation: 'invert',
          reason: 'Matrix is singular (determinant is zero)',
          cause: m,
        })
      )
    }

    const threeM = toThreeMatrix(m)
    threeM.invert()
    return make(matrix3ElementsToTuple(threeM.elements))
  })

/**
 * スカラー倍
 */
export const multiplyScalar = (m: Matrix3, s: number): Matrix3 => {
  const threeM = toThreeMatrix(m)
  threeM.multiplyScalar(s)
  return make(matrix3ElementsToTuple(threeM.elements))
}

/**
 * 行列の等価性判定
 */
export const equals = (a: Matrix3, b: Matrix3, epsilon: number = Number.EPSILON): boolean => {
  return a.elements.every((val, idx) => Math.abs(val - b.elements[idx]) <= epsilon)
}

/**
 * 行列から法線行列を生成（Matrix4から）
 * Matrix4の左上3x3を抽出して転置逆行列を計算
 */
export const getNormalMatrix = (m: Matrix3): Effect.Effect<Matrix3, Matrix3Error> => invert(transpose(m))
