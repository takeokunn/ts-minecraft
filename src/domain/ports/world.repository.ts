/**
 * World Repository Port - Interface for world data access
 *
 * This port defines the contract for world data operations,
 * allowing the domain layer to interact with world storage
 * without depending on specific implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import { EntityId } from '/entities'
import { queryConfigs } from '/queries'
import { SoAResult } from '/types'

export interface IWorldRepository {
  // Component management
  readonly updateComponent: <T>(entityId: EntityId, componentType: string, component: T) => Effect.Effect<void, never, never>

  // Query operations
  readonly querySoA: <Q extends (typeof queries)[keyof typeof queries]>(query: Q) => Effect.Effect<SoAResult<Q['components']>, never, never>

  // Entity management
  readonly createEntity: (components?: Record<string, unknown>) => Effect.Effect<EntityId, never, never>
  readonly destroyEntity: (entityId: EntityId) => Effect.Effect<void, never, never>
  readonly hasEntity: (entityId: EntityId) => Effect.Effect<boolean, never, never>

  // Batch operations
  readonly updateComponents: (
    updates: ReadonlyArray<{
      entityId: EntityId
      componentType: string
      component: unknown
    }>,
  ) => Effect.Effect<void, never, never>
}

export class WorldRepository extends Context.GenericTag('WorldRepository')<WorldRepository, IWorldRepository>() {}
