import { Effect, Context } from 'effect'

/**
 * Domain Query Abstractions
 *
 * These interfaces define domain-level queries without importing application-specific implementations.
 * This prevents circular dependencies between domain services and application queries.
 */

// Query result interfaces
export interface QueryResult<T = unknown> {
  readonly entities: ReadonlyArray<string>
  readonly components: T
}

export interface PlayerQueryResult {
  readonly entities: ReadonlyArray<string>
  readonly components: {
    readonly position: ReadonlyArray<{ x: number; y: number; z: number }>
    readonly cameraState: ReadonlyArray<{ pitch: number; yaw: number }>
    readonly inputState: ReadonlyArray<unknown>
    readonly velocity: ReadonlyArray<{ x: number; y: number; z: number }>
    readonly hotbar: ReadonlyArray<unknown>
    readonly gravity: ReadonlyArray<unknown>
  }
}

export interface PlayerTargetQueryResult {
  readonly entities: ReadonlyArray<string>
  readonly components: {
    readonly position: ReadonlyArray<{ x: number; y: number; z: number }>
    readonly inputState: ReadonlyArray<unknown>
    readonly target: ReadonlyArray<unknown>
    readonly hotbar: ReadonlyArray<unknown>
  }
}

// Domain query service interface
export interface DomainQueryService {
  readonly executePlayerQuery: () => Effect.Effect<PlayerQueryResult, never>
  readonly executePlayerTargetQuery: () => Effect.Effect<PlayerTargetQueryResult, never>
}

/**
 * Domain Query Service - provides domain-level query execution
 * This service acts as an abstraction layer between domain services and concrete query implementations
 */
export const DomainQueryService = Context.GenericTag<DomainQueryService>('DomainQueryService')
