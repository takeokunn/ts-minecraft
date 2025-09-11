/**
 * Spatial Grid Port - Interface for spatial partitioning operations
 *
 * This port defines the contract for spatial indexing and querying,
 * allowing efficient collision detection and spatial queries without
 * depending on specific spatial data structure implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import { EntityId } from '/entities'
import { AABB } from '/value-objects/physics/aabb.vo'

export interface ISpatialGridPort {
  // Spatial queries
  readonly query: (bounds: AABB) => Effect.Effect<ReadonlySet<EntityId>, never, never>

  // Entity management in spatial grid
  readonly insert: (entityId: EntityId, bounds: AABB) => Effect.Effect<void, never, never>
  readonly update: (entityId: EntityId, oldBounds: AABB, newBounds: AABB) => Effect.Effect<void, never, never>
  readonly remove: (entityId: EntityId) => Effect.Effect<void, never, never>

  // Batch operations
  readonly insertMany: (entities: ReadonlyArray<{ entityId: EntityId; bounds: AABB }>) => Effect.Effect<void, never, never>

  // Utility operations
  readonly clear: () => Effect.Effect<void, never, never>
  readonly getEntityCount: () => Effect.Effect<number, never, never>

  // Range queries
  readonly queryRadius: (center: { x: number; y: number; z: number }, radius: number) => Effect.Effect<ReadonlySet<EntityId>, never, never>

  // Nearest neighbor queries
  readonly queryNearest: (position: { x: number; y: number; z: number }, maxResults?: number) => Effect.Effect<ReadonlyArray<EntityId>, never, never>
}

export class SpatialGridPort extends Context.GenericTag('SpatialGridPort')<SpatialGridPort, ISpatialGridPort>() {}
