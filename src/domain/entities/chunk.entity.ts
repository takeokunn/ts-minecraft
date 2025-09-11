import * as S from '@effect/schema/Schema'
import { ChunkCoordinate } from '../value-objects/coordinates/chunk-coordinate.vo'
import { Block } from './block.entity'

export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 256

export const Chunk = S.Struct({
  _tag: S.Literal('Chunk'),
  coordinate: ChunkCoordinate,
  blocks: S.Array(Block),
  biome: S.Literal('plains', 'desert', 'forest', 'mountains', 'ocean', 'taiga', 'swamp'),
  generated: S.Boolean,
  modified: S.Boolean,
  lastUpdate: S.Number
})
export type Chunk = S.Schema.Type<typeof Chunk>

export const makeEmptyChunk = (coordinate: ChunkCoordinate) =>
  S.decodeSync(Chunk)({
    _tag: 'Chunk',
    coordinate,
    blocks: [],
    biome: 'plains',
    generated: false,
    modified: false,
    lastUpdate: Date.now()
  })