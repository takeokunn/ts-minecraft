import * as S from 'effect/Schema'
import { HashMap } from 'effect'
import { EntityId } from '@domain/value-objects/entity-id.vo'
import { ChunkCoordinate } from '@domain/value-objects/coordinates/chunk-coordinate.vo'
import { Position } from '@domain/value-objects/coordinates/position.vo'
import { Player } from './player.entity'
import { Chunk } from './chunk.entity'

export const WorldState = S.Struct({
  _tag: S.Literal('WorldState'),
  seed: S.Number,
  time: S.Number.pipe(S.between(0, 24000)),
  weather: S.Literal('clear', 'rain', 'thunder'),
  difficulty: S.Literal('peaceful', 'easy', 'normal', 'hard'),
  players: S.HashMap(EntityId, Player),
  chunks: S.HashMap(ChunkCoordinate, Chunk),
  spawnPoint: Position,
  gameRules: S.Record(S.String, S.Union(S.Boolean, S.Number, S.String)),
})
export type WorldState = S.Schema.Type<typeof WorldState>
