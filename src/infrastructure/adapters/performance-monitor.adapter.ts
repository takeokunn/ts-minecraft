/**
 * Performance Monitor Adapter - Infrastructure Implementation
 *
 * This adapter implements the PerformanceMonitorPort interface
 * and bridges the domain layer with the infrastructure implementation.
 * Following the DDD hexagonal architecture pattern.
 */

import { Layer } from 'effect'
import { PerformanceMonitorPort } from '@domain/ports/performance-monitor.port'
import { PerformanceMonitorService, PerformanceMonitorServiceLive } from '@infrastructure/monitoring/performance-monitor.service'

/**
 * Performance Monitor Adapter
 *
 * Maps the PerformanceMonitorService to the PerformanceMonitorPort
 */
export const PerformanceMonitorAdapter = Layer.effect(PerformanceMonitorPort, PerformanceMonitorService)

/**
 * Performance Monitor Live Layer
 *
 * Provides both the service implementation and the port adapter
 */
export const PerformanceMonitorLive = (config?: any) => Layer.provide(PerformanceMonitorAdapter, PerformanceMonitorServiceLive(config))
