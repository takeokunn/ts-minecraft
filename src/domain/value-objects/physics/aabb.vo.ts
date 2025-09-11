import * as S from '@effect/schema/Schema'

export const AABB = S.Struct({
  _tag: S.Literal('AABB'),
  minX: S.Number,
  minY: S.Number,
  minZ: S.Number,
  maxX: S.Number,
  maxY: S.Number,
  maxZ: S.Number
})
export type AABB = S.Schema.Type<typeof AABB>

export const makeAABB = (
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number
) => S.decodeSync(AABB)({
  _tag: 'AABB',
  minX, minY, minZ,
  maxX, maxY, maxZ
})