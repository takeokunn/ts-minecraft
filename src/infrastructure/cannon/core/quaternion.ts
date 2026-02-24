import * as CANNON from 'cannon-es'
import type { Vector3 } from '@/infrastructure/cannon/core/vector3'
import { toCannonVector } from '@/infrastructure/cannon/core/vector3'

export type Quaternion = { readonly x: number; readonly y: number; readonly z: number; readonly w: number }

export const identity: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

export const makeQuaternion = (x: number, y: number, z: number, w: number): Quaternion =>
  ({ x, y, z, w })

export const fromCannonQuaternion = (q: CANNON.Quaternion): Quaternion =>
  ({ x: q.x, y: q.y, z: q.z, w: q.w })

export const toCannonQuaternion = (q: Quaternion): CANNON.Quaternion =>
  new CANNON.Quaternion(q.x, q.y, q.z, q.w)

export const fromAxisAngle = (axis: Vector3, angle: number): Quaternion => {
  const cannonQuat = new CANNON.Quaternion().setFromAxisAngle(toCannonVector(axis), angle)
  return ({ x: cannonQuat.x, y: cannonQuat.y, z: cannonQuat.z, w: cannonQuat.w })
}

export const multiply = (a: Quaternion, b: Quaternion): Quaternion => {
  const result = toCannonQuaternion(a).mult(toCannonQuaternion(b))
  return ({ x: result.x, y: result.y, z: result.z, w: result.w })
}

export const slerp = (a: Quaternion, b: Quaternion, t: number): Quaternion => {
  const result = toCannonQuaternion(a).slerp(toCannonQuaternion(b), t)
  return ({ x: result.x, y: result.y, z: result.z, w: result.w })
}
