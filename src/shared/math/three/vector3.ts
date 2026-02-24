import * as THREE from 'three'

/**
 * Three.js Vector3のラッパー
 *
 * **設計方針**:
 * - Immutableなデータ構造
 * - 純粋関数（Effect型ではなく直接返す）
 */

export type Vector3 = { readonly x: number; readonly y: number; readonly z: number }

// コンストラクタ
export const makeVector3 = (x: number, y: number, z: number): Vector3 => ({ x, y, z })

export const zero: Vector3 = { x: 0, y: 0, z: 0 }
export const one: Vector3 = { x: 1, y: 1, z: 1 }
export const up: Vector3 = { x: 0, y: 1, z: 0 }
export const down: Vector3 = { x: 0, y: -1, z: 0 }
export const left: Vector3 = { x: -1, y: 0, z: 0 }
export const right: Vector3 = { x: 1, y: 0, z: 0 }
export const forward: Vector3 = { x: 0, y: 0, z: -1 }
export const backward: Vector3 = { x: 0, y: 0, z: 1 }

// Three.js相互変換
export const fromThreeVector = (v: THREE.Vector3): Vector3 => ({ x: v.x, y: v.y, z: v.z })

export const toThreeVector = (v: Vector3): THREE.Vector3 => new THREE.Vector3(v.x, v.y, v.z)

// ベクトル演算（Immutable - 純粋関数）
export const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const subtract = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const scale = (v: Vector3, s: number): Vector3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })

export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Vector3, b: Vector3): Vector3 =>
  ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  })

export const length = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

export const lengthSquared = (v: Vector3): number => v.x * v.x + v.y * v.y + v.z * v.z

export const normalize = (v: Vector3): Vector3 => {
  const len = length(v)
  if (len === 0) return zero
  return scale(v, 1 / len)
}

export const distance = (a: Vector3, b: Vector3): number =>
  length({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z })

// JSON変換
export const toJSON = (v: Vector3): { x: number; y: number; z: number } => ({
  x: v.x,
  y: v.y,
  z: v.z,
})

export const fromJSON = (json: { x: number; y: number; z: number }): Vector3 => ({ ...json })
