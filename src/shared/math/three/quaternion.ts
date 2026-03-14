import * as THREE from 'three'
import { Schema } from 'effect'
import type { Vector3 } from './vector3'
import { toThreeVector } from './vector3'

export const QuaternionSchema = Schema.Struct({ x: Schema.Number.pipe(Schema.finite()), y: Schema.Number.pipe(Schema.finite()), z: Schema.Number.pipe(Schema.finite()), w: Schema.Number.pipe(Schema.finite()) })
export type Quaternion = Schema.Schema.Type<typeof QuaternionSchema>

export const identity: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

export const makeQuaternion = (x: number, y: number, z: number, w: number): Quaternion =>
  ({ x, y, z, w })

export const fromThreeQuaternion = (q: THREE.Quaternion): Quaternion =>
  ({ x: q.x, y: q.y, z: q.z, w: q.w })

export const toThreeQuaternion = (q: Quaternion): THREE.Quaternion =>
  new THREE.Quaternion(q.x, q.y, q.z, q.w)

export const fromAxisAngle = (axis: Vector3, angle: number): Quaternion => {
  const threeQuat = new THREE.Quaternion().setFromAxisAngle(toThreeVector(axis), angle)
  return ({ x: threeQuat.x, y: threeQuat.y, z: threeQuat.z, w: threeQuat.w })
}

export const multiply = (a: Quaternion, b: Quaternion): Quaternion => {
  const result = toThreeQuaternion(a).multiply(toThreeQuaternion(b))
  return ({ x: result.x, y: result.y, z: result.z, w: result.w })
}

export const slerp = (a: Quaternion, b: Quaternion, t: number): Quaternion => {
  const result = toThreeQuaternion(a).slerp(toThreeQuaternion(b), t)
  return ({ x: result.x, y: result.y, z: result.z, w: result.w })
}
