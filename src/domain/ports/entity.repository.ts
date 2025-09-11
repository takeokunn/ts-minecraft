/**
 * Entity Repository Port - Interface for entity data operations
 *
 * This port defines the contract for entity data operations,
 * allowing the domain layer to interact with entity storage
 * without depending on specific implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Option from 'effect/Option'
import { EntityId } from '@domain/entities'
import { type ComponentName, type ComponentOfName } from '@domain/entities/components'
import { Archetype } from '@domain/constants/archetypes'

/**
 * Entity metadata and tracking
 */
export interface EntityMetadata {
  readonly id: EntityId
  readonly createdAt: number
  readonly updatedAt: number
  readonly componentTypes: ReadonlySet<ComponentName>
  readonly archetypeKey: string
  readonly generation: number // For entity versioning
}

/**
 * Entity query options
 */
export interface EntityQueryOptions {
  readonly includeComponents?: ReadonlyArray<ComponentName>
  readonly excludeComponents?: ReadonlyArray<ComponentName>
  readonly limit?: number
  readonly offset?: number
  readonly sortBy?: 'id' | 'createdAt' | 'updatedAt'
  readonly sortOrder?: 'asc' | 'desc'
}

/**
 * Entity change tracking
 */
export interface EntityChange {
  readonly entityId: EntityId
  readonly changeType: 'created' | 'updated' | 'destroyed'
  readonly componentName?: ComponentName
  readonly previousValue?: unknown
  readonly newValue?: unknown
  readonly timestamp: number
}

/**
 * Entity Repository interface
 */
export interface IEntityRepository {
  // Entity lifecycle
  readonly createEntity: (archetype?: Archetype) => Effect.Effect<EntityId, never, never>
  readonly destroyEntity: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly entityExists: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getEntityMetadata: (entityId: EntityId) => Effect.Effect<Option.Option<EntityMetadata>, never, never>

  // Component operations
  readonly addComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>) => Effect.Effect<boolean, never, never>
  readonly removeComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>
  readonly getComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<Option.Option<ComponentOfName<T>>, never, never>
  readonly hasComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>
  readonly updateComponent: <T extends ComponentName>(
    entityId: EntityId,
    componentName: T,
    updater: (current: ComponentOfName<T>) => ComponentOfName<T>,
  ) => Effect.Effect<boolean, never, never>

  // Bulk operations
  readonly createEntities: (archetypes: ReadonlyArray<Archetype>) => Effect.Effect<ReadonlyArray<EntityId>, never, never>
  readonly destroyEntities: (entityIds: ReadonlyArray<EntityId>) => Effect.Effect<number, never, never>
  readonly cloneEntity: (entityId: EntityId) => Effect.Effect<Option.Option<EntityId>, never, never>

  // Query operations
  readonly findEntitiesByComponents: (componentNames: ReadonlyArray<ComponentName>, options?: EntityQueryOptions) => Effect.Effect<ReadonlyArray<EntityMetadata>, never, never>
  readonly findEntitiesByArchetype: (archetypeKey: string) => Effect.Effect<ReadonlyArray<EntityMetadata>, never, never>
  readonly countEntities: (componentNames?: ReadonlyArray<ComponentName>) => Effect.Effect<number, never, never>

  // Change tracking
  readonly getEntityChanges: (entityId?: EntityId, since?: number) => Effect.Effect<ReadonlyArray<EntityChange>, never, never>
  readonly clearChangeHistory: (before?: number) => Effect.Effect<number, never, never>

  // Statistics and maintenance
  readonly getRepositoryStats: () => Effect.Effect<
    {
      readonly entityCount: number
      readonly componentCounts: Record<ComponentName, number>
      readonly archetypeCounts: Record<string, number>
      readonly changeCount: number
      readonly memoryUsage: number
    },
    never,
    never
  >
  readonly compactStorage: () => Effect.Effect<void, never, never>
}

export const EntityRepository = Context.GenericTag<IEntityRepository>('EntityRepository')