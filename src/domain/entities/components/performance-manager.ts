/**
 * Component Performance Management System
 * 
 * This module provides performance optimization for component systems.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import * as Array from 'effect/Array'
import { globalRegistry } from './registry'
import type { StorageLayout } from './registry'

/**
 * Performance optimization manager for component systems
 */
export class ComponentPerformanceManager {
  private performanceMetrics = new Map<string, PerformanceMetric>()

  /**
   * Track component access patterns for optimization hints
   */
  trackComponentAccess(componentId: string, accessType: 'read' | 'write', duration: number): void {
    const existing = this.performanceMetrics.get(componentId)
    const metric: PerformanceMetric = existing ?? {
      componentId,
      readCount: 0,
      writeCount: 0,
      totalReadTime: 0,
      totalWriteTime: 0,
      suggestedOptimization: 'none',
    }

    if (accessType === 'read') {
      metric.readCount++
      metric.totalReadTime += duration
    } else {
      metric.writeCount++
      metric.totalWriteTime += duration
    }

    // Update optimization suggestions
    metric.suggestedOptimization = this.calculateOptimizationSuggestion(metric)
    this.performanceMetrics.set(componentId, metric)
  }

  /**
   * Get optimization suggestions for components
   */
  getOptimizationSuggestions(): readonly OptimizationSuggestion[] {
    return Array.fromIterable(this.performanceMetrics.values())
      .filter((metric) => metric.suggestedOptimization !== 'none')
      .map((metric) => ({
        componentId: metric.componentId,
        currentLayout: this.getCurrentLayout(metric.componentId),
        suggestedLayout: metric.suggestedOptimization as StorageLayout,
        reason: this.getOptimizationReason(metric),
      }))
  }

  /**
   * Apply optimization suggestions automatically
   */
  applyOptimizations(): void {
    const suggestions = this.getOptimizationSuggestions()
    const registry = globalRegistry

    suggestions.forEach((suggestion) => {
      if (suggestion.suggestedLayout !== 'none') {
        registry.convertStorageLayout(suggestion.componentId, suggestion.suggestedLayout)
      }
    })
  }

  private calculateOptimizationSuggestion(metric: PerformanceMetric): StorageLayout | 'none' {
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

  private getCurrentLayout(componentId: string): StorageLayout {
    // Query the registry for current storage layout
    return globalRegistry.getArchetype([componentId]).storageLayout
  }

  private getOptimizationReason(metric: PerformanceMetric): string {
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

// Global instance
export const performanceManager = new ComponentPerformanceManager()

// Performance monitoring functions
export const trackPerformance = (componentId: string, accessType: 'read' | 'write', duration: number): void =>
  performanceManager.trackComponentAccess(componentId, accessType, duration)

export const getOptimizationSuggestions = (): readonly OptimizationSuggestion[] => 
  performanceManager.getOptimizationSuggestions()

export const applyOptimizations = (): void => 
  performanceManager.applyOptimizations()