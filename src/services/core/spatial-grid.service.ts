import { Context, Effect } from 'effect'
import { EntityId } from '@/domain/entity'
import { AABB } from '@/domain/geometry'

/**
 * SpatialGrid Service - Spatial partitioning for efficient collision detection
 */
export class SpatialGrid extends Context.Tag('SpatialGrid')<
  SpatialGrid,
  {
    readonly add: (entityId: EntityId, aabb: AABB) => Effect.Effect<void>
    readonly remove: (entityId: EntityId) => Effect.Effect<void>
    readonly update: (entityId: EntityId, aabb: AABB) => Effect.Effect<void>
    readonly query: (aabb: AABB) => Effect.Effect<Set<EntityId>>
    readonly clear: () => Effect.Effect<void>
  }
>() {}