import * as S from 'effect/Schema'
import { Effect, pipe } from 'effect'
import type { ParseResult } from 'effect/ParseResult'

export const QuaternionX = pipe(S.Number, S.between(-1, 1), S.brand('QuaternionX'))
export type QuaternionX = S.Schema.Type<typeof QuaternionX>

export const QuaternionY = pipe(S.Number, S.between(-1, 1), S.brand('QuaternionY'))
export type QuaternionY = S.Schema.Type<typeof QuaternionY>

export const QuaternionZ = pipe(S.Number, S.between(-1, 1), S.brand('QuaternionZ'))
export type QuaternionZ = S.Schema.Type<typeof QuaternionZ>

export const QuaternionW = pipe(S.Number, S.between(-1, 1), S.brand('QuaternionW'))
export type QuaternionW = S.Schema.Type<typeof QuaternionW>

export const Quaternion = S.Struct({
  _tag: S.Literal('Quaternion'),
  x: QuaternionX,
  y: QuaternionY,
  z: QuaternionZ,
  w: QuaternionW,
})
export type Quaternion = S.Schema.Type<typeof Quaternion>

export const makeQuaternion = (x: number, y: number, z: number, w: number): Effect.Effect<Quaternion, ParseResult.ParseError> =>
  pipe(
    { _tag: 'Quaternion' as const, x, y, z, w },
    S.decode(Quaternion)
  )

export const fromUnknown = (value: unknown): Effect.Effect<Quaternion, ParseResult.ParseError> =>
  pipe(
    value,
    S.decode(Quaternion)
  )

export const identity = Effect.succeed({ _tag: 'Quaternion' as const, x: 0 as QuaternionX, y: 0 as QuaternionY, z: 0 as QuaternionZ, w: 1 as QuaternionW })

// Utility functions
export const multiply = (a: Quaternion, b: Quaternion): Effect.Effect<Quaternion, ParseResult.ParseError> =>
  makeQuaternion(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  )

export const conjugate = (q: Quaternion): Effect.Effect<Quaternion, ParseResult.ParseError> => makeQuaternion(-q.x, -q.y, -q.z, q.w)

export const magnitude = (q: Quaternion): number => Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)

export const normalize = (q: Quaternion): Effect.Effect<Quaternion, ParseResult.ParseError> => {
  const mag = magnitude(q)
  return mag === 0 ? identity : makeQuaternion(q.x / mag, q.y / mag, q.z / mag, q.w / mag)
}

export const inverse = (q: Quaternion): Effect.Effect<Quaternion, ParseResult.ParseError> => {
  const mag = magnitude(q)
  const magSq = mag * mag
  if (magSq === 0) return identity

  return pipe(
    conjugate(q),
    Effect.flatMap(conj => makeQuaternion(conj.x / magSq, conj.y / magSq, conj.z / magSq, conj.w / magSq))
  )
}

export const fromAxisAngle = (axis: { x: number; y: number; z: number }, angle: number): Effect.Effect<Quaternion, ParseResult.ParseError> => {
  const halfAngle = angle / 2
  const sin = Math.sin(halfAngle)
  const cos = Math.cos(halfAngle)

  // Normalize axis
  const axisMag = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z)
  if (axisMag === 0) return identity

  const normalizedAxis = {
    x: axis.x / axisMag,
    y: axis.y / axisMag,
    z: axis.z / axisMag,
  }

  return makeQuaternion(normalizedAxis.x * sin, normalizedAxis.y * sin, normalizedAxis.z * sin, cos)
}

export const fromEuler = (pitch: number, yaw: number, roll: number): Effect.Effect<Quaternion, ParseResult.ParseError> => {
  const halfPitch = pitch / 2
  const halfYaw = yaw / 2
  const halfRoll = roll / 2

  const cp = Math.cos(halfPitch)
  const sp = Math.sin(halfPitch)
  const cy = Math.cos(halfYaw)
  const sy = Math.sin(halfYaw)
  const cr = Math.cos(halfRoll)
  const sr = Math.sin(halfRoll)

  return makeQuaternion(sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy, cr * cp * cy + sr * sp * sy)
}

export const toEuler = (q: Quaternion): { pitch: number; yaw: number; roll: number } => {
  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (q.w * q.x + q.y * q.z)
  const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y)
  const roll = Math.atan2(sinr_cosp, cosr_cosp)

  // Pitch (y-axis rotation)
  const sinp = 2 * (q.w * q.y - q.z * q.x)
  const pitch = Math.abs(sinp) >= 1 ? (sinp < 0 ? -1 : 1) * (Math.PI / 2) : Math.asin(sinp)

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (q.w * q.z + q.x * q.y)
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z)
  const yaw = Math.atan2(siny_cosp, cosy_cosp)

  return { pitch, yaw, roll }
}
