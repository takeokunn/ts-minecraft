/**
 * ECS Helper Functions
 * 
 * This module provides convenient helper functions for working with the ECS system.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

// Re-export helper functions from specific services
export { createQuery, find, exclude, spatialQuery, tagQuery, hierarchyQuery } from './query-builder.service'
export { componentBuilder, batchRegister, validateComponents } from './component.service'
export { createOptimizedQuery, withMetrics } from './optimized-query.service'
export { parallelQueries, batchQuery } from './archetype-query.service'