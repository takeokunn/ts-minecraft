import { Layer } from 'effect'
import { makePerformanceMonitoringService, MetricsCollectorServiceLive, PerformanceMonitoringService } from './index'

// === Layer ===

export const PerformanceMonitoringServiceLive = Layer.effect(
  PerformanceMonitoringService,
  makePerformanceMonitoringService
).pipe(Layer.provide(MetricsCollectorServiceLive))

// === Complete Service Layer ===

export const PerformanceMonitoringServicesLayer = Layer.mergeAll(
  MetricsCollectorServiceLive,
  PerformanceMonitoringServiceLive
)
