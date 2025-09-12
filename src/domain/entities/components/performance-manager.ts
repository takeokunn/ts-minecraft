/**
 * Component Performance Management System
 *
 * This module provides performance optimization for component systems.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as HashMap from 'effect/HashMap'
import { ComponentRegistry, createGlobalRegistry } from '@domain/entities/components/registry'
import type { StorageLayout } from '@domain/entities/components/registry'

/**
 * Functional performance optimization manager for component systems
 */
export const ComponentPerformanceManager = {
  /**
   * Create a new performance manager state
   */
  create: () =>
    Effect.gen(function* () {
      const metricsRef = yield* Ref.make<HashMap.HashMap<string, PerformanceMetric>>(HashMap.empty())
      return metricsRef
    }),

  /**
   * Track component access patterns for optimization hints
   */
  trackComponentAccess: (metricsRef: Ref.Ref<HashMap.HashMap<string, PerformanceMetric>>, componentId: string, accessType: 'read' | 'write', duration: number) =>
    Effect.gen(function* () {
      const currentMetrics = yield* Ref.get(metricsRef)
      const existing = HashMap.get(currentMetrics, componentId)

      const metric: PerformanceMetric =
        existing._tag === 'Some'
          ? existing.value
          : {
              componentId,
              readCount: 0,
              writeCount: 0,
              totalReadTime: 0,
              totalWriteTime: 0,
              suggestedOptimization: 'none',
            }

      const updatedMetric =
        accessType === 'read'
          ? {
              ...metric,
              readCount: metric.readCount + 1,
              totalReadTime: metric.totalReadTime + duration,
            }
          : {
              ...metric,
              writeCount: metric.writeCount + 1,
              totalWriteTime: metric.totalWriteTime + duration,
            }

      // Update optimization suggestions
      const optimizedMetric = {
        ...updatedMetric,
        suggestedOptimization: calculateOptimizationSuggestion(updatedMetric),
      }

      const newMetrics = HashMap.set(currentMetrics, componentId, optimizedMetric)
      yield* Ref.set(metricsRef, newMetrics)
    }),

  /**
   * Get optimization suggestions for components
   */
  getOptimizationSuggestions: (metricsRef: Ref.Ref<HashMap.HashMap<string, PerformanceMetric>>, registryRef: Ref.Ref<ComponentRegistry>) =>
    Effect.gen(function* () {
      const metrics = yield* Ref.get(metricsRef)
      const filteredMetrics = Array.fromIterable(HashMap.values(metrics)).filter((metric) => metric.suggestedOptimization !== 'none')

      const suggestions: OptimizationSuggestion[] = []
      for (const metric of filteredMetrics) {
        const currentLayout = yield* getCurrentLayout(registryRef, metric.componentId)
        suggestions.push({
          componentId: metric.componentId,
          currentLayout,
          suggestedLayout: metric.suggestedOptimization as StorageLayout,
          reason: getOptimizationReason(metric),
        })
      }

      return suggestions
    }),

  /**
   * Apply optimization suggestions automatically
   */
  applyOptimizations: (metricsRef: Ref.Ref<HashMap.HashMap<string, PerformanceMetric>>, registryRef: Ref.Ref<ComponentRegistry>) =>
    Effect.gen(function* () {
      const suggestions = yield* ComponentPerformanceManager.getOptimizationSuggestions(metricsRef, registryRef)

      for (const suggestion of suggestions) {
        if (suggestion.suggestedLayout !== 'none') {
          yield* ComponentRegistry.convertStorageLayout(registryRef, suggestion.componentId, suggestion.suggestedLayout)
        }
      }
    }),
}

// Helper functions
const calculateOptimizationSuggestion = (metric: PerformanceMetric): StorageLayout | 'none' => {
  const totalAccess = metric.readCount + metric.writeCount
  const readRatio = metric.readCount / totalAccess
  const avgReadTime = metric.totalReadTime / Math.max(1, metric.readCount)

  // High read frequency with slow access suggests SoA optimization
  if (readRatio > 0.8 && avgReadTime > 1 && totalAccess > 100) {
    return 'SoA'
  }

  // Balanced read/write suggests AoS
  if (readRatio >= 0.4 && readRatio <= 0.6 && totalAccess > 50) {
    return 'AoS'
  }

  return 'none'
}

const getCurrentLayout = (registryRef: Ref.Ref<ComponentRegistry>, componentId: string): Effect.Effect<StorageLayout, never, never> =>
  Effect.gen(function* () {
    const archetype = yield* ComponentRegistry.getArchetype(registryRef, [componentId])
    return archetype.storageLayout
  })

const getOptimizationReason = (metric: PerformanceMetric): string => {
  const totalAccess = metric.readCount + metric.writeCount
  const readRatio = metric.readCount / totalAccess

  if (metric.suggestedOptimization === 'SoA') {
    return `High read frequency (${(readRatio * 100).toFixed(1)}%) with ${totalAccess} total accesses suggests SoA optimization`
  }

  if (metric.suggestedOptimization === 'AoS') {
    return `Balanced read/write pattern (${(readRatio * 100).toFixed(1)}% reads) with ${totalAccess} accesses suggests AoS optimization`
  }

  return 'No optimization needed'
}

export interface PerformanceMetric {
  componentId: string
  readCount: number
  writeCount: number
  totalReadTime: number
  totalWriteTime: number
  suggestedOptimization: StorageLayout | 'none'
}

export interface OptimizationSuggestion {
  componentId: string
  currentLayout: StorageLayout
  suggestedLayout: StorageLayout | 'none'
  reason: string
}

// Functional performance monitoring functions
export const createPerformanceManager = () => Effect.runSync(ComponentPerformanceManager.create())

export const trackPerformance = (metricsRef: Ref.Ref<HashMap.HashMap<string, PerformanceMetric>>, componentId: string, accessType: 'read' | 'write', duration: number) =>
  ComponentPerformanceManager.trackComponentAccess(metricsRef, componentId, accessType, duration)

export const getOptimizationSuggestions = (metricsRef: Ref.Ref<HashMap.HashMap<string, PerformanceMetric>>, registryRef: Ref.Ref<ComponentRegistry>) =>
  ComponentPerformanceManager.getOptimizationSuggestions(metricsRef, registryRef)

export const applyOptimizations = (metricsRef: Ref.Ref<HashMap.HashMap<string, PerformanceMetric>>, registryRef: Ref.Ref<ComponentRegistry>) =>
  ComponentPerformanceManager.applyOptimizations(metricsRef, registryRef)
