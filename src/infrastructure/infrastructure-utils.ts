/**
 * Infrastructure Utilities
 * 
 * This module provides utility functions for creating and configuring
 * infrastructure layers based on different environments and capabilities.
 */

import * as Layer from 'effect/Layer'
import { BasicBrowserAdapters, AdvancedBrowserAdapters, ProductionAdapters, AdapterUtils } from '@infrastructure/adapters'
import { AllRepositories, CoreRepositories } from '@infrastructure/repositories'
import { UnifiedAppLive, DevelopmentLive, ProductionLive, getRuntimeLayer } from '@infrastructure/layers'

/**
 * Complete infrastructure layer for development
 */
export const DevelopmentInfrastructure = Layer.mergeAll(AdvancedBrowserAdapters, AllRepositories, DevelopmentLive)

/**
 * Complete infrastructure layer for production
 */
export const ProductionInfrastructure = Layer.mergeAll(ProductionAdapters, CoreRepositories, ProductionLive)

/**
 * Complete infrastructure layer with all features
 */
export const FullInfrastructure = Layer.mergeAll(AdvancedBrowserAdapters, AllRepositories, UnifiedAppLive)

/**
 * Minimal infrastructure for basic functionality
 */
export const MinimalInfrastructure = Layer.mergeAll(BasicBrowserAdapters, CoreRepositories, getRuntimeLayer('minimal'))

/**
 * Infrastructure utilities and factory functions
 */
export const InfrastructureUtils = {
  /**
   * Create infrastructure layer based on environment and capabilities
   */
  createInfrastructureLayer: (environment: 'development' | 'production' | 'test') => {
    switch (environment) {
      case 'development':
        return DevelopmentInfrastructure
      case 'production':
        return ProductionInfrastructure
      case 'test':
        return MinimalInfrastructure
      default:
        return FullInfrastructure
    }
  },

  /**
   * Create infrastructure layer with auto-detection of capabilities
   */
  createAutoInfrastructure: () => {
    const recommendedAdapters = AdapterUtils.getRecommendedAdapterLayer()
    const repositories = AdapterUtils.isWebGPUAvailable() ? AllRepositories : CoreRepositories
    const layers = AdapterUtils.areWorkersAvailable() ? UnifiedAppLive : getRuntimeLayer('minimal')

    return Layer.mergeAll(recommendedAdapters, repositories, layers)
  },

  /**
   * Create infrastructure layer with custom configuration
   */
  createCustomInfrastructure: (config: { 
    adapters?: 'minimal' | 'standard' | 'advanced'; 
    repositories?: 'core' | 'all'; 
    features?: ('workers' | 'webgpu' | 'networking')[] 
  }) => {
    const adapters = config.adapters === 'minimal' 
      ? BasicBrowserAdapters 
      : config.adapters === 'advanced' 
        ? AdvancedBrowserAdapters 
        : ProductionAdapters

    const repositories = config.repositories === 'all' ? AllRepositories : CoreRepositories

    const hasWorkers = config.features?.includes('workers') ?? true
    const layers = hasWorkers ? UnifiedAppLive : getRuntimeLayer('minimal')

    return Layer.mergeAll(adapters, repositories, layers)
  },
}