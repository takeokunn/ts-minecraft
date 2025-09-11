import * as S from '@effect/schema/Schema'
import { BlockType } from '../value-objects/block-type.vo'
import { Position } from '../value-objects/coordinates/position.vo'

export const Block = S.Struct({
  _tag: S.Literal('Block'),
  position: Position,
  type: BlockType,
  metadata: S.Record(S.String, S.Unknown).pipe(S.optional),
  lightLevel: S.Number.pipe(S.between(0, 15)).pipe(S.optional),
  hardness: S.Number.pipe(S.positive).pipe(S.optional)
})
export type Block = S.Schema.Type<typeof Block>