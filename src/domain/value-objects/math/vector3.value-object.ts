import * as S from 'effect/Schema'
import { Effect, pipe } from 'effect'
import type { ParseResult } from 'effect/ParseResult'

export const VectorX = S.Number.pipe(S.finite(), S.brand('VectorX'))
export type VectorX = S.Schema.Type<typeof VectorX>

export const VectorY = S.Number.pipe(S.finite(), S.brand('VectorY'))
export type VectorY = S.Schema.Type<typeof VectorY>

export const VectorZ = S.Number.pipe(S.finite(), S.brand('VectorZ'))
export type VectorZ = S.Schema.Type<typeof VectorZ>

export const Vector3 = S.Struct({
  _tag: S.Literal('Vector3'),
  x: VectorX,
  y: VectorY,
  z: VectorZ,
})
export type Vector3 = S.Schema.Type<typeof Vector3>

export const makeVector3 = (x: number, y: number, z: number): Effect.Effect<Vector3, ParseResult.ParseError> =>
  pipe(
    { _tag: 'Vector3' as const, x, y, z },
    S.decode(Vector3)
  )

export const fromUnknown = (value: unknown): Effect.Effect<Vector3, ParseResult.ParseError> =>
  pipe(
    value,
    S.decode(Vector3)
  )

// Safe constants using unsafeCoerce for predefined values
export const zero = Effect.succeed({ _tag: 'Vector3' as const, x: 0 as VectorX, y: 0 as VectorY, z: 0 as VectorZ })
export const one = Effect.succeed({ _tag: 'Vector3' as const, x: 1 as VectorX, y: 1 as VectorY, z: 1 as VectorZ })
export const up = Effect.succeed({ _tag: 'Vector3' as const, x: 0 as VectorX, y: 1 as VectorY, z: 0 as VectorZ })
export const down = Effect.succeed({ _tag: 'Vector3' as const, x: 0 as VectorX, y: -1 as VectorY, z: 0 as VectorZ })
export const forward = Effect.succeed({ _tag: 'Vector3' as const, x: 0 as VectorX, y: 0 as VectorY, z: 1 as VectorZ })
export const back = Effect.succeed({ _tag: 'Vector3' as const, x: 0 as VectorX, y: 0 as VectorY, z: -1 as VectorZ })
export const right = Effect.succeed({ _tag: 'Vector3' as const, x: 1 as VectorX, y: 0 as VectorY, z: 0 as VectorZ })
export const left = Effect.succeed({ _tag: 'Vector3' as const, x: -1 as VectorX, y: 0 as VectorY, z: 0 as VectorZ })

// Utility functions
export const add = (a: Vector3, b: Vector3): Effect.Effect<Vector3, ParseResult.ParseError> => 
  makeVector3(a.x + b.x, a.y + b.y, a.z + b.z)

export const subtract = (a: Vector3, b: Vector3): Effect.Effect<Vector3, ParseResult.ParseError> => 
  makeVector3(a.x - b.x, a.y - b.y, a.z - b.z)

export const multiply = (vector: Vector3, scalar: number): Effect.Effect<Vector3, ParseResult.ParseError> => 
  makeVector3(vector.x * scalar, vector.y * scalar, vector.z * scalar)

export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Vector3, b: Vector3): Effect.Effect<Vector3, ParseResult.ParseError> => 
  makeVector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

export const magnitude = (vector: Vector3): number => Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)

export const normalize = (vector: Vector3): Effect.Effect<Vector3, ParseResult.ParseError> => {
  const mag = magnitude(vector)
  return mag === 0 ? zero : makeVector3(vector.x / mag, vector.y / mag, vector.z / mag)
}

export const distance = (a: Vector3, b: Vector3): Effect.Effect<number, ParseResult.ParseError> => 
  pipe(
    subtract(a, b),
    Effect.map(magnitude)
  )
