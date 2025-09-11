/**
 * Infrastructure Layer - Barrel Exports
 *
 * This module provides a unified interface to all infrastructure components,
 * following clean architecture principles where the infrastructure layer
 * implements the technical details required by the application and domain layers.
 *
 * Architecture:
 * - adapters/     - Technical implementation adapters (rendering, input, etc.)
 * - repositories/ - Data access implementations following Repository pattern
 * - layers/       - Effect-based dependency injection layers
 * - services/     - Technical implementation services
 * - workers/      - Web Worker implementations for background processing
 * - gpu/          - GPU and WebGPU utilities  
 * - network/      - Network infrastructure
 * - performance/  - Performance monitoring
 * - storage/      - Storage infrastructure
 */

// Adapter implementations
export * from './adapters'

// Repository implementations
export * from './repositories'

// Effect layers for dependency injection
export * from './layers'

// Services (technical implementations)
export * from './services'

// Worker implementations
export * from './workers'

// GPU and WebGPU utilities
export * from './gpu'

// Network infrastructure
export * from './network'

// Performance monitoring
export * from './performance'

// Storage infrastructure
export * from './storage'

// Infrastructure utilities
export * from './infrastructure-utils'

// Infrastructure health monitoring
export * from './infrastructure-health'
