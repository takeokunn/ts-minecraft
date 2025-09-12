import { Layer, Effect } from 'effect'
import { pipe } from 'effect/Function'
import * as S from '@effect/schema/Schema'
import { DomainQueryService } from '@domain/queries/domain-queries'
import { playerQuery, playerTargetQuery } from '@application/queries/queries'
import { WorldRepositoryPort } from '@domain/ports/world-repository.port'
import { Logger } from '@shared/utils/logging'
import { withValidation, createValidationError } from '@domain/errors/validation-errors'

// Schema definitions for query validation
const QueryResultSchema = S.Struct({
  entities: S.Array(S.Unknown),
  count: S.Number,
  queryTime: S.optional(S.Number)
})

const PlayerComponentSchema = S.Struct({
  position: S.Struct({ x: S.Number, y: S.Number, z: S.Number }),
  velocity: S.optional(S.Struct({ x: S.Number, y: S.Number, z: S.Number })),
  rotation: S.optional(S.Struct({ pitch: S.Number, yaw: S.Number }))
})

const TargetComponentSchema = S.Struct({
  targetType: S.String,
  position: S.optional(S.Struct({ x: S.Number, y: S.Number, z: S.Number })),
  entityId: S.optional(S.String)
})

/**
 * Domain Query Service Implementation with Enhanced Validation
 *
 * This service provides concrete implementations for domain query abstractions,
 * breaking the circular dependency between domain services and application queries.
 * 
 * Features:
 * - Schema-based validation for all query results
 * - Safe handling of unknown data types
 * - Comprehensive error reporting with recovery strategies
 * - Performance monitoring for query operations
 */
// Query validation utilities
const validateQueryResult = (result: unknown, queryName: string): Effect.Effect<any, never, never> => {
  return pipe(
    withValidation.safeSchemaDecodeWithDetails(QueryResultSchema)(result),
    Effect.match({
      onFailure: (validationError) => {
        return Effect.gen(function* () {
          yield* Logger.warn(
            `Query result validation failed for ${queryName}`,
            'DomainQueryService',
            { validationError, queryName, result },
            ['query', 'validation-failed']
          )
          // Return safe fallback structure
          return {
            entities: Array.isArray(result) ? result : [],
            count: Array.isArray(result) ? (result as any[]).length : 0,
            queryTime: undefined
          }
        })
      },
      onSuccess: (validated) => Effect.succeed(validated)
    }),
    Effect.flatten
  )
}

const validatePlayerComponents = (entities: unknown[]): Effect.Effect<any[], never, never> => {
  return pipe(
    withValidation.validateArrayPartial(PlayerComponentSchema)(entities),
    Effect.map(({ valid, invalid }) => {
      if (invalid.length > 0) {
        return Effect.gen(function* () {
          yield* Logger.warn(
            `Some player components failed validation`,
            'DomainQueryService',
            { validCount: valid.length, invalidCount: invalid.length, invalidItems: invalid },
            ['query', 'component-validation']
          )
        })
      }
      return valid
    }),
    Effect.flatten
  )
}

const validateTargetComponents = (entities: unknown[]): Effect.Effect<any[], never, never> => {
  return pipe(
    withValidation.validateArrayPartial(TargetComponentSchema)(entities),
    Effect.map(({ valid, invalid }) => {
      if (invalid.length > 0) {
        return Effect.gen(function* () {
          yield* Logger.warn(
            `Some target components failed validation`,
            'DomainQueryService',
            { validCount: valid.length, invalidCount: invalid.length, invalidItems: invalid },
            ['query', 'component-validation']
          )
        })
      }
      return valid
    }),
    Effect.flatten
  )
}

export const DomainQueryServiceLive = Layer.effect(
  DomainQueryService,
  Effect.gen(function* () {
    const componentLogger = Logger.withComponent('DomainQueryService')
    
    return {
      executePlayerQuery: () =>
        Effect.gen(function* () {
          yield* componentLogger.debug('Executing player query', { query: 'playerQuery' })
          
          const world = yield* WorldRepositoryPort
          const rawResult = yield* world.querySoA(playerQuery)
          
          // Validate the query result structure
          const validatedResult = yield* validateQueryResult(rawResult, 'playerQuery')
          
          // Validate individual player components
          const validatedEntities = yield* validatePlayerComponents(validatedResult.entities)
          
          const finalResult = {
            ...validatedResult,
            entities: validatedEntities
          }
          
          yield* componentLogger.debug(
            'Player query completed',
            { 
              entityCount: validatedEntities.length,
              queryTime: validatedResult.queryTime,
              hasValidation: true
            },
            ['query-complete']
          )
          
          return finalResult
        }),

      executePlayerTargetQuery: () =>
        Effect.gen(function* () {
          yield* componentLogger.debug('Executing player target query', { query: 'playerTargetQuery' })
          
          const world = yield* WorldRepositoryPort
          const rawResult = yield* world.querySoA(playerTargetQuery)
          
          // Validate the query result structure  
          const validatedResult = yield* validateQueryResult(rawResult, 'playerTargetQuery')
          
          // Validate individual target components
          const validatedEntities = yield* validateTargetComponents(validatedResult.entities)
          
          const finalResult = {
            ...validatedResult,
            entities: validatedEntities
          }
          
          yield* componentLogger.debug(
            'Player target query completed',
            {
              entityCount: validatedEntities.length,
              queryTime: validatedResult.queryTime,
              hasValidation: true
            },
            ['query-complete']
          )
          
          return finalResult
        }),
    }
  }),
)
