import * as S from '@effect/schema/Schema'
import { EntityId } from '../value-objects/entity-id.vo'
import { Position } from '../value-objects/coordinates/position.vo'
import { Velocity } from '../value-objects/physics/velocity.vo'

export const PlayerInventory = S.Array(
  S.Struct({
    slot: S.Number.pipe(S.between(0, 35)),
    itemId: S.String,
    count: S.Number.pipe(S.between(1, 64))
  })
)

export const Player = S.Struct({
  _tag: S.Literal('Player'),
  id: EntityId,
  name: S.String,
  position: Position,
  velocity: Velocity,
  health: S.Number.pipe(S.between(0, 20)),
  hunger: S.Number.pipe(S.between(0, 20)),
  experience: S.Number.pipe(S.nonNegative),
  inventory: PlayerInventory,
  gameMode: S.Literal('survival', 'creative', 'adventure', 'spectator')
})
export type Player = S.Schema.Type<typeof Player>