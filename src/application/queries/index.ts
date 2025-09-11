/**
 * Application Queries - Pure Barrel Exports
 * 
 * This module provides a unified interface for all query-related functionality.
 * All logic has been extracted to separate files to maintain pure barrel exports.
 */

// Unified Query System - Primary interface
export * from './unified-query-system'

// Legacy query system exports (for backward compatibility)
export * from './builder'
export * from './archetype-query'
export * from './optimized-query'
export * from './cache'
export * from './predefined-queries'
export * from './query-profiler'
export * from './query-system'

// Legacy compatibility layer
export * from './legacy-compatibility'
