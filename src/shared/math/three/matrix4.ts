import * as THREE from 'three'

// 4x4行列（列優先）
export type Matrix4 = { readonly elements: readonly number[] }

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
