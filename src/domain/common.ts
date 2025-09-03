import * as S from 'effect/Schema'

/**
 * Represents a floating-point Number.
 */
export const Float = S.Number.pipe(S.brand('Float'))
export type Float = S.Schema.Type<typeof Float>
export const toFloat = S.decodeUnknownSync(Float)

/**
 * Represents an integer.
 */
export const Int = S.Number.pipe(S.int(), S.brand('Int'))
export type Int = S.Schema.Type<typeof Int>
export const toInt = S.decodeUnknownSync(Int)

/**
 * Schemas for 3D and 2D vectors.
 */
export const Vector3FloatSchema = S.Tuple(Float, Float, Float)
export type Vector3Float = S.Schema.Type<typeof Vector3FloatSchema>

export const Vector2FloatSchema = S.Tuple(Float, Float)
export type Vector2Float = S.Schema.Type<typeof Vector2FloatSchema>

export const Vector3IntSchema = S.Tuple(Int, Int, Int)
export type Vector3Int = S.Schema.Type<typeof Vector3IntSchema>

export const ChunkX = Int.pipe(S.brand('ChunkX'))
export type ChunkX = S.Schema.Type<typeof ChunkX>
export const toChunkX = S.decodeUnknownSync(ChunkX)

export const ChunkZ = Int.pipe(S.brand('ChunkZ'))
export type ChunkZ = S.Schema.Type<typeof ChunkZ>
export const toChunkZ = S.decodeUnknownSync(ChunkZ)