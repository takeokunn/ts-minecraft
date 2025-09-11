/**
 * Domain Queries - Pure Barrel Exports
 * 
 * This module provides a clean interface for all query-related functionality
 * in the domain layer, following DDD principles by keeping the index
 * as a pure barrel export without logic.
 */

// Core query system exports
export * from './builder'
export * from './optimized-query'
export * from './archetype-query'
export * from './cache'

// Query configurations and legacy system
export * from './query-configs'
export * from './legacy-query-system'

// Extracted systems
export * from './query-system-layers'
export * from './legacy-query-compatibility'
