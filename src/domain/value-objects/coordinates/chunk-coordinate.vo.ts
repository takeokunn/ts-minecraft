import * as S from 'effect/Schema'
import { pipe } from 'effect'

export const ChunkX = pipe(S.Number, S.int, S.brand('ChunkX'))
export type ChunkX = S.Schema.Type<typeof ChunkX>

export const ChunkZ = pipe(S.Number, S.int, S.brand('ChunkZ'))
export type ChunkZ = S.Schema.Type<typeof ChunkZ>

export const ChunkCoordinate = S.Struct({
  x: ChunkX,
  z: ChunkZ
})
export type ChunkCoordinate = S.Schema.Type<typeof ChunkCoordinate>

export const makeChunkCoordinate = (x: number, z: number) =>
  S.decodeSync(ChunkCoordinate)({ x, z })