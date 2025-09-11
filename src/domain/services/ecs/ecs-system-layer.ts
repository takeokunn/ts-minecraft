/**
 * ECS System Layer Composition
 * 
 * This module provides the complete ECS system layer with all services.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import { Layer } from 'effect'
// Re-export layers from services
// Note: These imports should be valid if the services exist, 
// but we need to check that the Live services are actually exported
export { ArchetypeServiceLive, QueryServiceLive } from './archetype-query.service'
export { ComponentServiceLive, ComponentPoolServiceLive } from './component.service'  
export { QueryBuilderServiceLive } from './query-builder.service'
export { OptimizedQuerySystemLive } from './optimized-query.service'

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