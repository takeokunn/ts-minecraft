/**
 * Performance Monitoring System (Legacy)
 * 
 * DEPRECATED: This module has been migrated to infrastructure layers.
 * Please use the new infrastructure/performance layers instead:
 * 
 * @deprecated Use `import { ... } from '../../infrastructure/performance'` instead
 * 
 * The new system provides:
 * - Effect-based architecture with proper dependency injection
 * - Better resource management and cleanup
 * - Enhanced performance optimizations
 * - Type-safe service composition
 */

// Re-export from new infrastructure layers for backward compatibility
export * from '../../infrastructure/performance'

/**
 * Legacy performance utilities - use the new infrastructure layers instead
 * 
 * @deprecated The functions below are deprecated. Use the new infrastructure/performance
 * layers which provide better type safety, dependency injection, and resource management.
 * 
 * New usage:
 * ```typescript
 * import { PerformanceLayer } from '../../infrastructure/performance'
 * 
 * const program = Effect.gen(function* () {
 *   // Your performance-monitored code here
 * }).pipe(Effect.provide(PerformanceLayer))
 * ```
 */