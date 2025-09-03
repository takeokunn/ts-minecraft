import * as S from 'effect/Schema'

/**
 * A reusable schema for a floating-point number.
 */
export const Float = S.Number.pipe(S.brand('Float'))
export type Float = S.Schema.Type<typeof Float>
const decodeFloat = S.decodeSync(Float)
export const toFloat = (n: number): Float => decodeFloat(n)

/**
 * A reusable schema for an integer.
 */
export const Int = S.Number.pipe(S.int(), S.brand('Int'))
export type Int = S.Schema.Type<typeof Int>
const decodeInt = S.decodeSync(Int)
export const toInt = (n: number): Int => decodeInt(n)

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

export const ChunkX = Int.pipe(S.brand('ChunkX'))
export type ChunkX = S.Schema.Type<typeof ChunkX>
const decodeChunkX = S.decodeSync(ChunkX)
export const toChunkX = (n: number): ChunkX => decodeChunkX(n)

export const ChunkZ = Int.pipe(S.brand('ChunkZ'))
export type ChunkZ = S.Schema.Type<typeof ChunkZ>
const decodeChunkZ = S.decodeSync(ChunkZ)
export const toChunkZ = (n: number): ChunkZ => decodeChunkZ(n)
