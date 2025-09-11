/**
 * ECS (Entity Component System) Module
 * Exports all ECS-related services and utilities
 */

// Core ECS Services
export * from './archetype-query.service'
export * from './component.service'
export * from './query-builder.service'
export * from './optimized-query.service'

// Re-export commonly used types
export type {
  EntityId,
  ComponentName,
  ComponentData,
  Entity,
  ArchetypeSignature,
  Archetype,
  QueryMetrics,
  ComponentMetadata,
  ComponentRegistry,
  Index,
  IndexType,
  ExecutionPlan,
  QueryOptimization,
} from './archetype-query.service'

// Re-export service tags
export {
  ArchetypeService,
  QueryService,
  ComponentService,
  ComponentPoolService,
  QueryBuilderService,
  IndexService,
  QueryOptimizerService,
  ParallelQueryExecutor,
} from './archetype-query.service'

// Re-export layers
import { ArchetypeServiceLive, QueryServiceLive } from './archetype-query.service'
import { ComponentServiceLive, ComponentPoolServiceLive } from './component.service'
import { QueryBuilderServiceLive } from './query-builder.service'
import { OptimizedQuerySystemLive } from './optimized-query.service'
import { Layer } from 'effect'

/**
 * Complete ECS System Layer
 * Provides all ECS services with optimizations
 */
export const ECSSystemLive = Layer.mergeAll(
  ArchetypeServiceLive,
  QueryServiceLive,
  ComponentServiceLive,
  ComponentPoolServiceLive,
  QueryBuilderServiceLive,
  OptimizedQuerySystemLive,
)

// Re-export helper functions
export { createQuery, find, exclude, spatialQuery, tagQuery, hierarchyQuery } from './query-builder.service'
export { componentBuilder, batchRegister, validateComponents } from './component.service'
export { createOptimizedQuery, withMetrics } from './optimized-query.service'
export { parallelQueries, batchQuery } from './archetype-query.service'
