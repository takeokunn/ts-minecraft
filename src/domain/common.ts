import * as S from '@effect/schema/Schema'

/**
 * A reusable schema for a floating-point number.
 */
export const Float = S.Number

/**
 * A reusable schema for an integer.
 */
export const Int = S.Number.pipe(S.int())

/**
 * A schema for a 3D vector with floating-point coordinates.
 */
export const Vector3FloatSchema = S.Struct({
  x: Float,
  y: Float,
  z: Float,
})
export type Vector3Float = S.Schema.Type<typeof Vector3FloatSchema>

/**
 * A schema for a 3D vector with integer coordinates.
 */
export const Vector3IntSchema = S.Struct({
  x: Int,
  y: Int,
  z: Int,
})
export type Vector3Int = S.Schema.Type<typeof Vector3IntSchema>