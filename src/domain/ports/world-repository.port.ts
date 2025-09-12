/**
 * World Repository Port - Interface for world data access
 *
 * This port defines the contract for world data operations,
 * allowing the domain layer to interact with world storage
 * without depending on specific implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as S from '@effect/schema/Schema'
import { EntityId } from '@domain/entities'

// Error types for world repository operations
export const WorldRepositoryError = S.TaggedError<WorldRepositoryError>()('WorldRepositoryError', {
  message: S.String,
  operation: S.String,
  timestamp: S.optional(S.Number),
  cause: S.optional(S.Unknown)
})
export interface WorldRepositoryError extends S.Schema.Type<typeof WorldRepositoryError> {}

export const EntityNotFoundError = S.TaggedError<EntityNotFoundError>()('EntityNotFoundError', {
  entityId: EntityId,
  message: S.String,
  requestedOperation: S.String
})
export interface EntityNotFoundError extends S.Schema.Type<typeof EntityNotFoundError> {}

export const ComponentError = S.TaggedError<ComponentError>()('ComponentError', {
  entityId: EntityId,
  componentType: S.String,
  message: S.String,
  operation: S.Literal('create', 'read', 'update', 'delete'),
  cause: S.optional(S.Unknown)
})
export interface ComponentError extends S.Schema.Type<typeof ComponentError> {}

export const QueryError = S.TaggedError<QueryError>()('QueryError', {
  message: S.String,
  queryType: S.String,
  componentTypes: S.Array(S.String),
  entityCount: S.optional(S.Number),
  cause: S.optional(S.Unknown)
})
export interface QueryError extends S.Schema.Type<typeof QueryError> {}

export const TransactionError = S.TaggedError<TransactionError>()('TransactionError', {
  message: S.String,
  operationCount: S.Number,
  failedOperationIndex: S.optional(S.Number),
  cause: S.optional(S.Unknown)
})
export interface TransactionError extends S.Schema.Type<typeof TransactionError> {}

export const ValidationError = S.TaggedError<ValidationError>()('ValidationError', {
  entityId: EntityId,
  componentType: S.String,
  invalidFields: S.Array(S.String),
  message: S.String
})
export interface ValidationError extends S.Schema.Type<typeof ValidationError> {}

// Query result types (technology-agnostic)
export interface QueryResult<T = unknown> {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: T
  readonly count: number
}

export interface ComponentUpdate {
  readonly entityId: EntityId
  readonly componentType: string
  readonly component: unknown
}

export interface IWorldRepository {
  // Component management with enhanced error handling
  readonly updateComponent: <T>(entityId: EntityId, componentType: string, component: T) => Effect.Effect<void, ComponentError | EntityNotFoundError | ValidationError, never>

  readonly getComponent: <T>(entityId: EntityId, componentType: string) => Effect.Effect<T, ComponentError | EntityNotFoundError, never>

  readonly hasComponent: (entityId: EntityId, componentType: string) => Effect.Effect<boolean, EntityNotFoundError, never>

  readonly removeComponent: (entityId: EntityId, componentType: string) => Effect.Effect<void, ComponentError | EntityNotFoundError, never>

  // Component validation
  readonly validateComponent: <T>(componentType: string, component: T) => Effect.Effect<void, ValidationError, never>

  // Query operations with enhanced error reporting
  readonly query: <T>(
    componentTypes: ReadonlyArray<string>,
    filter?: (entity: EntityId) => Effect.Effect<boolean, never, never>,
  ) => Effect.Effect<QueryResult<T>, QueryError, never>

  readonly queryWithCount: <T>(componentTypes: ReadonlyArray<string>, limit?: number, offset?: number) => Effect.Effect<QueryResult<T> & { totalCount: number }, QueryError, never>

  // Entity management with better error context
  readonly createEntity: (components?: Record<string, unknown>) => Effect.Effect<EntityId, WorldRepositoryError | ValidationError, never>

  readonly destroyEntity: (entityId: EntityId) => Effect.Effect<void, EntityNotFoundError | WorldRepositoryError, never>

  readonly hasEntity: (entityId: EntityId) => Effect.Effect<boolean, never, never>

  readonly getAllEntities: () => Effect.Effect<ReadonlyArray<EntityId>, WorldRepositoryError, never>

  readonly getEntityCount: () => Effect.Effect<number, WorldRepositoryError, never>

  // Batch operations with transaction support
  readonly updateComponents: (updates: ReadonlyArray<ComponentUpdate>) => Effect.Effect<void, ComponentError | EntityNotFoundError | ValidationError | TransactionError, never>

  readonly createEntities: (
    entityConfigs: ReadonlyArray<Record<string, unknown>>,
  ) => Effect.Effect<ReadonlyArray<EntityId>, WorldRepositoryError | ValidationError | TransactionError, never>

  readonly destroyEntities: (entityIds: ReadonlyArray<EntityId>) => Effect.Effect<void, EntityNotFoundError | WorldRepositoryError | TransactionError, never>

  // Transaction support for atomic operations
  readonly transaction: <R, E, A>(operation: Effect.Effect<A, E, R>) => Effect.Effect<A, E | WorldRepositoryError | TransactionError, R>

  // Repository health and maintenance
  readonly getRepositoryStats: () => Effect.Effect<
    {
      entityCount: number
      componentCounts: Record<string, number>
      memoryUsage: number
    },
    WorldRepositoryError,
    never
  >

  readonly compactRepository: () => Effect.Effect<
    {
      entitiesRemoved: number
      componentsReclaimed: number
    },
    WorldRepositoryError,
    never
  >
}

export const WorldRepositoryPort = Context.GenericTag<IWorldRepository>('WorldRepositoryPort')

export { IWorldRepository as IWorldRepositoryPort }
