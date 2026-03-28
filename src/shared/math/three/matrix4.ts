import * as THREE from 'three'
import { Schema } from 'effect'

// 4x4行列（列優先、16要素固定）
export const Matrix4Schema = Schema.Struct({
  elements: Schema.Array(Schema.Number.pipe(Schema.finite())).pipe(Schema.minItems(16), Schema.maxItems(16)),
})
export type Matrix4 = typeof Matrix4Schema.Type

export const identity: Matrix4 = {
  elements: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ],
}

export const fromThreeMatrix4 = (m: THREE.Matrix4): Matrix4 =>
  ({ elements: [...m.elements] })

export const toThreeMatrix4 = (m: Matrix4): THREE.Matrix4 =>
  new THREE.Matrix4().fromArray(m.elements)
