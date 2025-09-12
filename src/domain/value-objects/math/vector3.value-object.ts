import * as S from 'effect/Schema'
import { pipe } from 'effect'

export const VectorX = pipe(S.Number, S.finite, S.brand('VectorX'))
export type VectorX = S.Schema.Type<typeof VectorX>

export const VectorY = pipe(S.Number, S.finite, S.brand('VectorY'))
export type VectorY = S.Schema.Type<typeof VectorY>

export const VectorZ = pipe(S.Number, S.finite, S.brand('VectorZ'))
export type VectorZ = S.Schema.Type<typeof VectorZ>

export const Vector3 = S.Struct({
  _tag: S.Literal('Vector3'),
  x: VectorX,
  y: VectorY,
  z: VectorZ,
})
export type Vector3 = S.Schema.Type<typeof Vector3>

export const makeVector3 = (x: number, y: number, z: number) => S.decodeSync(Vector3)({ _tag: 'Vector3', x, y, z })

export const zero = makeVector3(0, 0, 0)
export const one = makeVector3(1, 1, 1)
export const up = makeVector3(0, 1, 0)
export const down = makeVector3(0, -1, 0)
export const forward = makeVector3(0, 0, 1)
export const back = makeVector3(0, 0, -1)
export const right = makeVector3(1, 0, 0)
export const left = makeVector3(-1, 0, 0)

// Utility functions
export const add = (a: Vector3, b: Vector3): Vector3 => makeVector3(a.x + b.x, a.y + b.y, a.z + b.z)

export const subtract = (a: Vector3, b: Vector3): Vector3 => makeVector3(a.x - b.x, a.y - b.y, a.z - b.z)

export const multiply = (vector: Vector3, scalar: number): Vector3 => makeVector3(vector.x * scalar, vector.y * scalar, vector.z * scalar)

export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Vector3, b: Vector3): Vector3 => makeVector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

export const magnitude = (vector: Vector3): number => Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)

export const normalize = (vector: Vector3): Vector3 => {
  const mag = magnitude(vector)
  return mag === 0 ? zero : makeVector3(vector.x / mag, vector.y / mag, vector.z / mag)
}

export const distance = (a: Vector3, b: Vector3): number => magnitude(subtract(a, b))
