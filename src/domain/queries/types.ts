/**
 * Shared Query Types - Common interfaces and types for query system
 * Prevents circular dependencies between query modules
 */

import { ComponentName, ComponentOfName } from '@/domain/entities/components'
import { EntityId } from '@/domain/entities'

/**
 * Entity interface for query system
 * Represents an entity with components for query operations
 */
export interface QueryEntity {
  readonly id: EntityId
  readonly components: Record<ComponentName, unknown>
}

/**
 * Predicate function type for entity filtering
 */
export type EntityPredicate<T extends ReadonlyArray<ComponentName>> = (entity: {
  get<K extends T[number]>(componentName: K): ComponentOfName<K>
  has<K extends ComponentName>(componentName: K): boolean
  id: EntityId
}) => boolean

/**
 * Query configuration for building optimized queries
 */
export interface QueryConfig<T extends ReadonlyArray<ComponentName>> {
  name: string
  withComponents: T
  withoutComponents?: ReadonlyArray<ComponentName>
  predicate?: EntityPredicate<T>
  cacheKey?: string
  priority?: number
}

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  executionTime: number
  entitiesScanned: number
  entitiesMatched: number
  cacheHits: number
  cacheMisses: number
}

/**
 * Query execution context with performance tracking
 */
export interface QueryContext {
  startTime: number
  metrics: QueryMetrics
}

/**
 * Entity proxy interface for component access
 */
export interface EntityProxy<T extends ReadonlyArray<ComponentName>> {
  get<K extends T[number]>(componentName: K): ComponentOfName<K>
  has<K extends ComponentName>(componentName: K): boolean
  readonly id: EntityId
}

/**
 * Start query execution context
 */
export function startQueryContext(): QueryContext {
  return {
    startTime: performance.now(),
    metrics: {
      executionTime: 0,
      entitiesScanned: 0,
      entitiesMatched: 0,
      cacheHits: 0,
      cacheMisses: 0,
    },
  }
}

/**
 * Finalize query execution context
 */
export function finalizeQueryContext(context: QueryContext): QueryMetrics {
  context.metrics.executionTime = performance.now() - context.startTime
  return context.metrics
}

/**
 * Create entity proxy for component access
 */
export function createEntityProxy<T extends ReadonlyArray<ComponentName>>(entity: QueryEntity): EntityProxy<T> {
  return {
    get: <K extends ComponentName>(componentName: K) => {
      return entity.components[componentName] as ComponentOfName<K>
    },
    has: <K extends ComponentName>(componentName: K) => {
      return entity.components[componentName] !== undefined
    },
    id: entity.id,
  }
}
