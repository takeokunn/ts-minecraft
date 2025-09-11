import { Context, Effect, Option } from 'effect'
import { EntityId } from '@/domain/entities'
import { Position } from '@/domain/value-objects/coordinates'

/**
 * Ray hit result
 */
export interface RayHit {
  readonly entityId: EntityId
  readonly position: Position
  readonly normal: { x: number; y: number; z: number }
  readonly distance: number
}

/**
 * Raycast Service - Performs raycasting for selection and interaction
 */
export class Raycast extends Context.GenericTag('Raycast')<
  Raycast,
  {
    readonly cast: (
      origin: Position,
      direction: { x: number; y: number; z: number },
      maxDistance: number
    ) => Effect.Effect<Option.Option<RayHit, never, never>>
  }
>() {}