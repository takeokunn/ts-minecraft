import * as S from 'effect/Schema'
import { Effect, pipe } from 'effect'
import type { ParseResult } from 'effect/ParseResult'

export const ChunkX = S.Number.pipe(S.int(), S.brand('ChunkX'))
export type ChunkX = S.Schema.Type<typeof ChunkX>

export const ChunkZ = S.Number.pipe(S.int(), S.brand('ChunkZ'))
export type ChunkZ = S.Schema.Type<typeof ChunkZ>

export const ChunkCoordinate = S.Struct({
  x: ChunkX,
  z: ChunkZ,
})
export type ChunkCoordinate = S.Schema.Type<typeof ChunkCoordinate>

export const makeChunkCoordinate = (x: number, z: number): Effect.Effect<ChunkCoordinate, ParseResult.ParseError> =>
  pipe(
    { x, z },
    S.decode(ChunkCoordinate)
  )

export const fromUnknown = (value: unknown): Effect.Effect<ChunkCoordinate, ParseResult.ParseError> =>
  pipe(
    value,
    S.decode(ChunkCoordinate)
  )
