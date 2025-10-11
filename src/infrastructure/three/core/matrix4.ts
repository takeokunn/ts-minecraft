/**
 * @fileoverview Three.js Matrix4 - Effect-TSラッパー
 * 4x4変換行列の型安全な不変操作を提供
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { matrix4ElementsToTuple } from '../schemas/adapters'
import type { Quaternion } from './quaternion'
import * as Quat from './quaternion'
import type { Vector3 } from './vector3'
import * as V3 from './vector3'

/**
 * Matrix4 Schema定義（Brand型）
 * 4x4行列（列優先順序で16要素配列）
 */
export const Matrix4Schema = Schema.Struct({
  elements: Schema.Tuple(
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
  ),
}).pipe(Schema.brand('ThreeMatrix4'))

export type Matrix4 = Schema.Schema.Type<typeof Matrix4Schema>

/**
 * Matrix4エラー型
 */
export const Matrix4Error = Schema.TaggedError('Matrix4Error')({
  operation: Schema.String,
  reason: Schema.String,
  cause: Schema.Unknown,
})
export type Matrix4Error = Schema.Schema.Type<typeof Matrix4Error>

/**
 * Matrix4コンストラクタ - 要素配列から構築
 */
export const make = (
  elements: readonly [
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
): Matrix4 => Schema.decodeUnknownSync(Matrix4Schema)({ elements })

/**
 * 単位行列
 */
export const identity: Matrix4 = make([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

/**
 * ゼロ行列
 */
export const zero: Matrix4 = make([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

/**
 * Three.js Matrix4からEffect型への変換
 */
export const fromThreeMatrix = (m: THREE.Matrix4): Effect.Effect<Matrix4, never> =>
  Effect.sync(() => make(matrix4ElementsToTuple(m.elements)))

/**
 * Effect型からThree.js Matrix4への変換
 */
export const toThreeMatrix = (m: Matrix4): THREE.Matrix4 => new THREE.Matrix4().fromArray(m.elements)

/**
 * 位置・回転・スケールから変換行列を作成
 */
export const compose = (position: Vector3, rotation: Quaternion, scale: Vector3): Matrix4 => {
  const threeM = new THREE.Matrix4()
  threeM.compose(V3.toThreeVector(position), Quat.toThreeQuaternion(rotation), V3.toThreeVector(scale))
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 変換行列から位置・回転・スケールを分解
 */
export const decompose = (
  m: Matrix4
): Effect.Effect<{ position: Vector3; rotation: Quaternion; scale: Vector3 }, Matrix4Error> =>
  Effect.gen(function* () {
    const threeM = toThreeMatrix(m)
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    threeM.decompose(position, rotation, scale)

    return {
      position: V3.make(position.x, position.y, position.z),
      rotation: Quat.make(rotation.x, rotation.y, rotation.z, rotation.w),
      scale: V3.make(scale.x, scale.y, scale.z),
    }
  })

/**
 * 行列の乗算
 */
export const multiply = (a: Matrix4, b: Matrix4): Matrix4 => {
  const threeA = toThreeMatrix(a)
  const threeB = toThreeMatrix(b)
  threeA.multiply(threeB)
  return make(matrix4ElementsToTuple(threeA.elements))
}

/**
 * 行列の転置
 */
export const transpose = (m: Matrix4): Matrix4 => {
  const threeM = toThreeMatrix(m)
  threeM.transpose()
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 行列式の計算
 */
export const determinant = (m: Matrix4): number => toThreeMatrix(m).determinant()

/**
 * 逆行列の計算
 */
export const invert = (m: Matrix4): Effect.Effect<Matrix4, Matrix4Error> =>
  Effect.gen(function* () {
    const det = determinant(m)
    if (Math.abs(det) < Number.EPSILON) {
      return yield* Effect.fail(
        new Matrix4Error({
          operation: 'invert',
          reason: 'Matrix is singular (determinant is zero)',
          cause: m,
        })
      )
    }

    const threeM = toThreeMatrix(m)
    threeM.invert()
    return make(matrix4ElementsToTuple(threeM.elements))
  })

/**
 * スカラー倍
 */
export const multiplyScalar = (m: Matrix4, s: number): Matrix4 => {
  const threeM = toThreeMatrix(m)
  threeM.multiplyScalar(s)
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 平行移動行列の作成
 */
export const makeTranslation = (x: number, y: number, z: number): Matrix4 => {
  const threeM = new THREE.Matrix4()
  threeM.makeTranslation(x, y, z)
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 回転行列の作成（クォータニオンから）
 */
export const makeRotation = (q: Quaternion): Matrix4 => {
  const threeM = new THREE.Matrix4()
  threeM.makeRotationFromQuaternion(Quat.toThreeQuaternion(q))
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * スケール行列の作成
 */
export const makeScale = (x: number, y: number, z: number): Matrix4 => {
  const threeM = new THREE.Matrix4()
  threeM.makeScale(x, y, z)
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 透視投影行列の作成
 */
export const makePerspective = (fov: number, aspect: number, near: number, far: number): Matrix4 => {
  const threeM = new THREE.Matrix4()
  threeM.makePerspective(
    -Math.tan((fov * Math.PI) / 360) * near,
    Math.tan((fov * Math.PI) / 360) * near,
    (Math.tan((fov * Math.PI) / 360) * near) / aspect,
    (-Math.tan((fov * Math.PI) / 360) * near) / aspect,
    near,
    far
  )
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 正射投影行列の作成
 */
export const makeOrthographic = (
  left: number,
  right: number,
  top: number,
  bottom: number,
  near: number,
  far: number
): Matrix4 => {
  const threeM = new THREE.Matrix4()
  threeM.makeOrthographic(left, right, top, bottom, near, far)
  return make(matrix4ElementsToTuple(threeM.elements))
}

/**
 * 行列の等価性判定
 */
export const equals = (a: Matrix4, b: Matrix4, epsilon: number = Number.EPSILON): boolean => {
  return a.elements.every((val, idx) => Math.abs(val - b.elements[idx]) <= epsilon)
}

/**
 * ベクトルを行列で変換
 */
export const transformVector = (m: Matrix4, v: Vector3): Vector3 => {
  const threeV = V3.toThreeVector(v)
  threeV.applyMatrix4(toThreeMatrix(m))
  return V3.make(threeV.x, threeV.y, threeV.z)
}
