import type { Vector3 } from './vector3'
import type { Quaternion } from '@/shared/math/three/quaternion'
export { QuaternionSchema } from '@/shared/math/three/quaternion'
export type { Quaternion } from '@/shared/math/three/quaternion'

export const identity: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

export const makeQuaternion = (x: number, y: number, z: number, w: number): Quaternion =>
  ({ x, y, z, w })

export const fromAxisAngle = (axis: Vector3, angle: number): Quaternion => {
  const half = angle / 2
  const sin = Math.sin(half)
  return { x: axis.x * sin, y: axis.y * sin, z: axis.z * sin, w: Math.cos(half) }
}

export const multiply = (a: Quaternion, b: Quaternion): Quaternion => ({
  x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
  y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
  z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
})

export const slerp = (a: Quaternion, b: Quaternion, t: number): Quaternion => {
  let cosom = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
  let bx = b.x, by = b.y, bz = b.z, bw = b.w
  if (cosom < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; cosom = -cosom }
  let scale0: number, scale1: number
  if (1.0 - cosom > 0.000001) {
    const omega = Math.acos(cosom)
    const sinom = Math.sin(omega)
    scale0 = Math.sin((1.0 - t) * omega) / sinom
    scale1 = Math.sin(t * omega) / sinom
  } else {
    scale0 = 1.0 - t; scale1 = t
  }
  return {
    x: scale0 * a.x + scale1 * bx,
    y: scale0 * a.y + scale1 * by,
    z: scale0 * a.z + scale1 * bz,
    w: scale0 * a.w + scale1 * bw,
  }
}
