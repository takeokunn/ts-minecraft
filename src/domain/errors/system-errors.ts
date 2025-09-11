import { defineError } from './generator'
import { SystemError } from './base-errors'

/**
 * ECS system execution failed
 * Recovery: Skip system execution or retry with fallback
 */
export const SystemExecutionError = defineError<{
  readonly systemName: string
  readonly executionStage: 'initialization' | 'update' | 'cleanup'
  readonly error: unknown
  readonly entityCount?: number
}>('SystemExecutionError', SystemError, 'retry', 'high')

/**
 * System is in invalid state
 * Recovery: Reset system state or disable system
 */
export const InvalidSystemStateError = defineError<{
  readonly systemName: string
  readonly reason: string
  readonly expectedState?: string
  readonly currentState?: string
}>('InvalidSystemStateError', SystemError, 'fallback', 'medium')

/**
 * System initialization failed
 * Recovery: Use default configuration or disable system
 */
export const SystemInitializationError = defineError<{
  readonly systemName: string
  readonly reason: string
  readonly configuration?: Record<string, unknown>
  readonly dependencies?: string[]
}>('SystemInitializationError', SystemError, 'fallback', 'high')

/**
 * System dependency not satisfied
 * Recovery: Load missing dependency or disable dependent system
 */
export const SystemDependencyError = defineError<{
  readonly systemName: string
  readonly missingDependencies: string[]
  readonly availableSystems: string[]
}>('SystemDependencyError', SystemError, 'fallback', 'high')

/**
 * System performance degradation detected
 * Recovery: Optimize system or reduce processing frequency
 */
export const SystemPerformanceError = defineError<{
  readonly systemName: string
  readonly executionTime: number
  readonly maxAllowedTime: number
  readonly entityCount: number
}>('SystemPerformanceError', SystemError, 'ignore', 'medium')

/**
 * Query execution failed
 * Recovery: Return empty result or use cached result
 */
export const QueryExecutionError = defineError<{
  readonly queryName: string
  readonly components: ReadonlyArray<string>
  readonly error: unknown
  readonly entityCount?: number
}>('QueryExecutionError', SystemError, 'fallback', 'medium')

/**
 * Query returned no results when results were expected
 * Recovery: Use fallback entities or skip operation
 */
export const EmptyQueryResultError = defineError<{
  readonly queryName: string
  readonly components: ReadonlyArray<string>
  readonly expectedMinResults?: number
  readonly actualResults: 0
}>('EmptyQueryResultError', SystemError, 'fallback', 'low')

/**
 * Query result validation failed
 * Recovery: Filter invalid results or use default entities
 */
export const QueryValidationError = defineError<{
  readonly queryName: string
  readonly invalidResults: unknown[]
  readonly validationRules: string[]
  readonly totalResults: number
}>('QueryValidationError', SystemError, 'fallback', 'medium')

/**
 * System scheduler error
 * Recovery: Use alternative scheduling or disable scheduling
 */
export const SystemSchedulerError = defineError<{
  readonly schedulerType: 'parallel' | 'sequential' | 'priority'
  readonly affectedSystems: string[]
  readonly reason: string
}>('SystemSchedulerError', SystemError, 'fallback', 'high')
