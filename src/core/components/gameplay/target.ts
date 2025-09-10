import * as S from 'effect/Schema'
import { EntityIdSchema } from '@/domain/entity'
import { Vector3IntSchema } from '@/domain/common'
import { PositionComponent } from '../physics/position'

/**
 * Target Component - What the player is currently looking at/targeting
 */

export const TargetBlockComponent = S.Struct({
  _tag: S.Literal('block'),
  entityId: EntityIdSchema,
  face: Vector3IntSchema,
  position: PositionComponent,
})

export const TargetNoneComponent = S.Struct({
  _tag: S.Literal('none'),
})

export const TargetComponent = S.Union(TargetBlockComponent, TargetNoneComponent)

export type TargetBlockComponent = S.Schema.Type<typeof TargetBlockComponent>
export type TargetNoneComponent = S.Schema.Type<typeof TargetNoneComponent>
export type TargetComponent = S.Schema.Type<typeof TargetComponent>