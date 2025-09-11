/**
 * Infrastructure Layers - Pure Barrel Exports
 * 
 * This module provides a clean interface for all infrastructure layer functionality.
 * All logic has been extracted to separate files to maintain pure barrel exports.
 */

// Unified layer - main implementation
export * from './unified.layer'

// Extended worker functionality
export * from './worker-manager.live'
export * from './typed-worker-manager.live'

// Service aliases and compatibility mappings
export * from './service-aliases'
