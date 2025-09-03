import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { Effect } from 'effect'

/**
 * A reusable schema for a floating-point number.
 */
export const Float = S.Number.pipe(S.brand('Float'))
export type Float = S.Schema.Type<typeof Float>
export const FloatArbitrary = Arbitrary.make(Float)
export const toFloat = (n: number): Effect.Effect<Float> => S.decode(Float)(n)

/**
 * A reusable schema for an integer.
 */
export const Int = S.Number.pipe(S.int(), S.brand('Int'))
export type Int = S.Schema.Type<typeof Int>
export const IntArbitrary = Arbitrary.make(Int)
export const toInt = (n: number): Effect.Effect<Int> => S.decode(Int)(n)

/**
 * A schema for a 3D vector with floating-point coordinates.
 */
export const Vector3FloatSchema = S.Tuple(Float, Float, Float)
export type Vector3 = S.Schema.Type<typeof Vector3FloatSchema>

/**
 * A schema for a 2D vector with floating-point coordinates.
 */
export const Vector2FloatSchema = S.Tuple(Float, Float)
export type Vector2 = S.Schema.Type<typeof Vector2FloatSchema>

/**
 * A schema for a 3D vector with integer coordinates.
 */
export const Vector3IntSchema = S.Tuple(Int, Int, Int)
export type Vector3Int = S.Schema.Type<typeof Vector3IntSchema>
