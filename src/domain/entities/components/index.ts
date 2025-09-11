/**
 * Next-Generation Component System - Pure Barrel Exports
 *
 * This module provides a clean interface for all component-related functionality.
 * All logic has been extracted to separate files to maintain pure barrel exports.
 */

// Registry and base functionality
export * from './registry'

// Component categories
export * from './physics'
export * from './rendering'
export * from './gameplay'
export * from './world'

// Extracted systems
export * from './archetype-query-system'
export * from './performance-manager'
export * from './component-schemas'
