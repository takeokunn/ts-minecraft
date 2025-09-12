/**
 * WorldDomainService - Pure domain world logic without infrastructure dependencies
 *
 * Features:
 * - World state domain rules and validation
 * - Chunk management algorithms
 * - World consistency checks
 * - Pure domain logic with port interfaces
 * - No infrastructure dependencies
 */

import { Effect, Ref, HashMap, Option, Context, Layer } from 'effect'
import * as S from '@effect/schema/Schema'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import { EntityId } from '@domain/value-objects/entity-id.value-object'
import { Chunk } from '@domain/entities/chunk.entity'
import { ChunkCoordinate } from '@domain/value-objects/coordinates/chunk-coordinate.value-object'
import { ChunkNotLoadedError, InvalidPositionError, WorldStateError } from '@domain/errors'

// Port interfaces for external dependencies
export interface WorldRepositoryPort {
  readonly saveWorldState: (state: WorldState) => Effect.Effect<void, never, never>
  readonly loadWorldState: () => Effect.Effect<Option.Option<WorldState>, never, never>
}

export interface ChunkRepositoryPort {
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, never, never>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<Chunk>, never, never>
  readonly deleteChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, never, never>
}

// Schema definitions for entity data validation
const EntityDataSchema = S.Union(
  S.Record(S.String, S.Unknown),
  S.Struct({
    _tag: S.String,
    data: S.Unknown,
  }),
  S.Unknown,
)

const WorldEntitySchema = S.Struct({
  _tag: S.Literal("Entity"),
  id: S.String,
  data: EntityDataSchema,
})

const SanitizedEntitySchema = S.Record(S.String, S.Unknown)

// Validation utilities for world domain using @effect/schema
export const WorldDomainValidation = {
  validateEntityData: (entityData: unknown): Effect.Effect<{ data: unknown; isValid: boolean; type: string }, never, never> => {
    return Effect.gen(function* () {
      const parseResult = S.parseSync(EntityDataSchema)(entityData)
      
      if (entityData == null) {
        return { data: null, isValid: false, type: 'null' }
      }

      if (typeof entityData === 'object' && '_tag' in entityData) {
        return {
          data: parseResult,
          isValid: true,
          type: (entityData as { _tag?: string })._tag || 'tagged-object',
        }
      }

      if (typeof entityData === 'object') {
        return {
          data: parseResult,
          isValid: true,
          type: 'object',
        }
      }

      return {
        data: { value: parseResult, originalType: typeof entityData },
        isValid: true,
        type: typeof entityData,
      }
    }).pipe(
      Effect.catchAll(() => Effect.succeed({ data: entityData, isValid: false, type: 'validation-failed' }))
    )
  },

  sanitizeEntityData: (entityData: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
    return Effect.gen(function* () {
      if (entityData == null) {
        const result = { _tag: 'EmptyEntity', timestamp: Date.now() }
        return yield* Effect.succeed(S.parseSync(SanitizedEntitySchema)(result))
      }

      if (typeof entityData === 'object' && !Array.isArray(entityData)) {
        return yield* Effect.succeed(S.parseSync(SanitizedEntitySchema)(entityData))
      }

      const wrappedResult = {
        _tag: 'WrappedEntity',
        data: entityData,
        type: typeof entityData,
        timestamp: Date.now(),
      }
      
      return yield* Effect.succeed(S.parseSync(SanitizedEntitySchema)(wrappedResult))
    }).pipe(
      Effect.catchAll(() => Effect.succeed({ _tag: 'SanitizationFailed', originalData: String(entityData), timestamp: Date.now() }))
    )
  },

  validateAndParseEntityData: (entityData: unknown): Effect.Effect<S.Schema.Type<typeof EntityDataSchema>, WorldStateError, never> => {
    return Effect.gen(function* () {
      try {
        const parsed = S.parseSync(EntityDataSchema)(entityData)
        return parsed
      } catch (error) {
        return yield* Effect.fail(
          WorldStateError({
            operation: 'validateAndParseEntityData',
            reason: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
          })
        )
      }
    })
  },
}

/**
 * World State Interface
 * Represents the complete state of the world including entities and chunks
 */
export interface WorldState {
  readonly _tag: 'WorldState'
  readonly entities: HashMap.HashMap<EntityId, unknown> // Generic entity data
  readonly chunks: HashMap.HashMap<string, Chunk>
  readonly timestamp: number
}

/**
 * Factory function to create an empty WorldState
 */
export const makeEmptyWorldState = (): WorldState => ({
  _tag: 'WorldState',
  entities: HashMap.empty(),
  chunks: HashMap.empty(),
  timestamp: Date.now(),
})

/**
 * World Domain Service Interface
 * Provides pure domain methods for managing world state
 */
export const WorldDomainService = Context.GenericTag<{
  readonly validateWorldState: (state: WorldState) => Effect.Effect<boolean, WorldStateError>
  readonly addEntityToWorld: (entityId: EntityId, entityData: unknown) => Effect.Effect<void, WorldStateError>
  readonly removeEntityFromWorld: (entityId: EntityId) => Effect.Effect<void, WorldStateError>
  readonly addChunkToWorld: (chunk: Chunk) => Effect.Effect<void, WorldStateError>
  readonly removeChunkFromWorld: (coordinate: ChunkCoordinate) => Effect.Effect<void, WorldStateError>
  readonly updateWorldTimestamp: (state: WorldState) => Effect.Effect<WorldState, WorldStateError>
  readonly calculateChunkKey: (coordinate: ChunkCoordinate) => string
  readonly validateChunkCoordinate: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, InvalidPositionError>
  // Query methods with proper error types
  readonly isChunkLoaded: (chunkX: number, chunkZ: number) => Effect.Effect<boolean, never>
  readonly getChunk: (chunkX: number, chunkZ: number) => Effect.Effect<Chunk, ChunkNotLoadedError>
  readonly getLoadedChunks: () => Effect.Effect<readonly Chunk[], never>
  // Validation utilities
  readonly validateEntityData: (entityData: unknown) => Effect.Effect<{ data: unknown; isValid: boolean; type: string }, never, never>
  readonly sanitizeEntityData: (entityData: unknown) => Effect.Effect<Record<string, unknown>, never, never>
}>('WorldDomainService')

/**
 * World Domain Service Live Implementation
 * Provides pure domain logic for world management
 */
export const WorldDomainServiceLive = Layer.effect(
  WorldDomainService,
  Effect.gen(function* () {
    return WorldDomainService.of({
      validateWorldState: (state) =>
        state._tag === 'WorldState' && typeof state.timestamp === 'number' && state.timestamp > 0
          ? Effect.succeed(true)
          : Effect.fail(
              WorldStateError({
                operation: 'validateWorldState',
                reason: 'Invalid world state structure or timestamp',
                stateVersion: state.timestamp,
              }),
            ),

      addEntityToWorld: (entityId, entityData) =>
        Effect.gen(function* () {
          if (!entityId) {
            return yield* Effect.fail(
              WorldStateError({
                operation: 'addEntityToWorld',
                reason: 'Invalid entity ID provided',
              }),
            )
          }

          // Use schema-based validation instead of custom validation
          const validatedEntityData = yield* WorldDomainValidation.validateAndParseEntityData(entityData)
          
          // Additional business logic validation
          const validation = yield* WorldDomainValidation.validateEntityData(validatedEntityData)
          if (!validation.isValid && entityData != null) {
            return yield* Effect.fail(
              WorldStateError({
                operation: 'addEntityToWorld',
                reason: `Entity validation failed: ${validation.type}`,
              }),
            )
          }

          return // Pure function - would return updated state with validated data
        }),


      removeEntityFromWorld: (entityId) =>
        entityId
          ? Effect.succeed(undefined) // Pure function - would return updated state
          : Effect.fail(
              WorldStateError({
                operation: 'removeEntityFromWorld',
                reason: 'Invalid entity ID provided',
              }),
            ),

      addChunkToWorld: (chunk) =>
        chunk && chunk.coordinate
          ? Effect.succeed(undefined) // Pure function - would return updated state
          : Effect.fail(
              WorldStateError({
                operation: 'addChunkToWorld',
                reason: 'Invalid chunk data provided',
              }),
            ),

      removeChunkFromWorld: (coordinate) =>
        coordinate
          ? Effect.succeed(undefined) // Pure function - would return updated state
          : Effect.fail(
              WorldStateError({
                operation: 'removeChunkFromWorld',
                reason: 'Invalid chunk coordinate provided',
              }),
            ),

      updateWorldTimestamp: (state) =>
        state._tag === 'WorldState'
          ? Effect.succeed({
              ...state,
              timestamp: Date.now(),
            })
          : Effect.fail(
              WorldStateError({
                operation: 'updateWorldTimestamp',
                reason: 'Invalid world state provided',
                stateVersion: state.timestamp,
              }),
            ),

      calculateChunkKey: (coordinate) => `${coordinate.x},${coordinate.z}`,

      validateChunkCoordinate: (coordinate) =>
        Number.isInteger(coordinate.x) && Number.isInteger(coordinate.z) && Math.abs(coordinate.x) < 30000000 && Math.abs(coordinate.z) < 30000000
          ? Effect.succeed(true)
          : Effect.fail(
              InvalidPositionError({
                position: { x: coordinate.x, y: 0, z: coordinate.z },
                reason: 'Chunk coordinate out of valid bounds or not integer',
                validBounds: {
                  min: { x: -30000000, y: 0, z: -30000000 },
                  max: { x: 30000000, y: 0, z: 30000000 },
                },
              }),
            ),

      // Query method implementations with proper error handling
      isChunkLoaded: (chunkX, chunkZ) => Effect.succeed(false), // TODO: Implement with proper chunk storage

      getChunk: (chunkX, chunkZ) =>
        Effect.fail(
          ChunkNotLoadedError({
            coordinates: { x: chunkX, z: chunkZ },
            requestedOperation: 'getChunk',
            loadingState: 'not-requested',
          }),
        ), // TODO: Implement with proper chunk storage

      getLoadedChunks: () => Effect.succeed([]), // TODO: Implement with proper chunk storage

      // Validation utilities implementation
      validateEntityData: WorldDomainValidation.validateEntityData,
      sanitizeEntityData: WorldDomainValidation.sanitizeEntityData,
    })
  }),
)
