/**
 * Performance Monitor Port - Domain Layer Interface
 *
 * This port defines the interface for performance monitoring services
 * following the DDD hexagonal architecture pattern.
 * The application layer depends on this port, and infrastructure
 * adapters implement it.
 */

import { Effect, Context, Option } from 'effect'

/**
 * Performance metric types
 */
export type PerformanceMetricType =
  | 'execution_time'
  | 'memory_usage'
  | 'cpu_usage'
  | 'frame_time'
  | 'query_performance'
  | 'communication_overhead'
  | 'garbage_collection'
  | 'entity_count'
  | 'system_load'

/**
 * Performance metric
 */
export interface PerformanceMetric {
  readonly type: PerformanceMetricType
  readonly systemId: string
  readonly value: number
  readonly unit: string
  readonly timestamp: number
  readonly frameId: number
  readonly metadata?: Record<string, any>
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  readonly id: string
  readonly level: 'warning' | 'critical'
  readonly metric: PerformanceMetric
  readonly timestamp: number
  readonly resolved: boolean
  readonly description: string
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  readonly metricType: PerformanceMetricType
  readonly systemId: string
  readonly count: number
  readonly min: number
  readonly max: number
  readonly average: number
  readonly median: number
  readonly p95: number
  readonly p99: number
  readonly standardDeviation: number
  readonly trend: 'improving' | 'degrading' | 'stable'
}

/**
 * System performance profile
 */
export interface SystemPerformanceProfile {
  readonly systemId: string
  readonly executionTime: PerformanceStats
  readonly memoryUsage: PerformanceStats
  readonly queryPerformance: PerformanceStats
  readonly bottleneckScore: number
  readonly recommendations: readonly string[]
}

/**
 * Frame performance summary
 */
export interface FramePerformanceSummary {
  readonly frameId: number
  readonly timestamp: number
  readonly totalFrameTime: number
  readonly targetFrameTime: number
  readonly frameRate: number
  readonly systemBreakdown: Map<string, number>
  readonly bottleneckSystem: Option.Option<string>
  readonly qualityLevel: 'low' | 'medium' | 'high' | 'ultra'
  readonly recommendedQuality: 'low' | 'medium' | 'high' | 'ultra'
}

/**
 * Performance Monitor Port interface
 * 
 * This is the domain-level abstraction for performance monitoring.
 * Infrastructure adapters implement this interface.
 */
export interface PerformanceMonitorPort {
  readonly startFrame: (frameId: number) => Effect.Effect<void>
  readonly startSystem: (systemId: string) => Effect.Effect<void>
  readonly endSystem: (systemId: string) => Effect.Effect<void>
  readonly endFrame: () => Effect.Effect<FramePerformanceSummary>
  readonly recordMetric: (type: PerformanceMetricType, systemId: string, value: number, unit: string, metadata?: Record<string, any>) => Effect.Effect<void>
  readonly getSystemStats: (systemId: string, type: PerformanceMetricType) => Effect.Effect<Option.Option<PerformanceStats>>
  readonly getSystemProfile: (systemId: string) => Effect.Effect<SystemPerformanceProfile>
  readonly getActiveAlerts: () => Effect.Effect<readonly PerformanceAlert[]>
  readonly getFrameHistory: (count?: number) => Effect.Effect<readonly FramePerformanceSummary[]>
  readonly getMetrics: (systemId: string, type: PerformanceMetricType) => Effect.Effect<readonly PerformanceMetric[]>
}

/**
 * Performance Monitor Port tag
 */
export const PerformanceMonitorPort = Context.GenericTag<PerformanceMonitorPort>('PerformanceMonitorPort')