import { Context, Effect } from 'effect'
import { EntityId } from '@/domain/entities'
import { AABB } from '@/domain/geometry'

/**
 * SpatialGrid Service - Spatial partitioning for efficient collision detection
 */
export class SpatialGrid extends Context.Tag('SpatialGrid')<
  SpatialGrid,
  {
    readonly add: (entityId: EntityId, aabb: AABB) => Effect.Effect<void, never, never>
    readonly remove: (entityId: EntityId) => Effect.Effect<void, never, never>
    readonly update: (entityId: EntityId, aabb: AABB) => Effect.Effect<void, never, never>
    readonly query: (aabb: AABB) => Effect.Effect<Set<EntityId, never, never>>
    readonly clear: () => Effect.Effect<void, never, never>
  }
>() {}