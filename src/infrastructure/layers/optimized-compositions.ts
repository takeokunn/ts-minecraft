import { Layer, Effect } from 'effect'
import {
  // Base service layers
  DomainServicesLive,
  CoreServicesLive,
  WorldServicesLive,
  WorkerServicesLive,
  RenderingServicesLive,
  InputServicesLive,
  UIServicesLive,

  // Preset compositions
  MinimalLive,
  HeadlessLive,
  DevelopmentLive,
  ProductionLive,
} from './unified.layer'
import { ApplicationLayer } from '@application/application-layer'

/**
 * Optimized Layer Compositions
 *
 * This module provides high-level, optimized layer compositions that eliminate
 * redundant merges and create efficient dependency trees.
 */

// ============================================================================
// OPTIMIZED BASE COMPOSITIONS
// ============================================================================

/**
 * Essential Services - Minimal required services for core functionality
 * Optimized for: Memory usage, startup time
 */
export const EssentialServicesLive = Layer.mergeAll(DomainServicesLive, CoreServicesLive)

/**
 * Game Logic Services - Services needed for gameplay without UI/rendering
 * Optimized for: Headless operation, simulation, testing
 */
export const GameLogicServicesLive = Layer.mergeAll(EssentialServicesLive, WorldServicesLive, ApplicationLayer)

/**
 * Rendering Stack - Complete rendering pipeline
 * Optimized for: Visual output, performance
 */
export const RenderingStackLive = Layer.mergeAll(EssentialServicesLive, RenderingServicesLive, InputServicesLive, UIServicesLive)

/**
 * Compute Services - Background processing and workers
 * Optimized for: Heavy computation, background tasks
 */
export const ComputeServicesLive = Layer.mergeAll(EssentialServicesLive, WorkerServicesLive)

// ============================================================================
// ENVIRONMENT-SPECIFIC OPTIMIZED LAYERS
// ============================================================================

/**
 * Development Layer - Optimized for development workflow
 * - Fast startup
 * - Debug capabilities
 * - Hot reload compatibility
 */
export const OptimizedDevelopmentLive = Layer.mergeAll(
  GameLogicServicesLive,
  RenderingStackLive,
  // Add minimal compute for development speed
  WorkerServicesLive,
  Layer.effectDiscard(Effect.log('Development environment optimized for fast iteration')),
)

/**
 * Production Layer - Optimized for production performance
 * - All services enabled
 * - Performance monitoring
 * - Error resilience
 */
export const OptimizedProductionLive = Layer.mergeAll(
  GameLogicServicesLive,
  RenderingStackLive,
  ComputeServicesLive,
  Layer.effectDiscard(Effect.log('Production environment optimized for performance')),
)

/**
 * Test Layer - Optimized for testing
 * - Minimal services
 * - Mockable dependencies
 * - Fast initialization
 */
export const OptimizedTestLive = Layer.mergeAll(EssentialServicesLive, Layer.effectDiscard(Effect.log('Test environment with minimal services')))

/**
 * Server/Simulation Layer - Optimized for headless operation
 * - No UI/Input services
 * - Compute-focused
 * - Network capabilities
 */
export const OptimizedServerLive = Layer.mergeAll(
  GameLogicServicesLive,
  ComputeServicesLive,
  Layer.effectDiscard(Effect.log('Server environment optimized for headless operation')),
)

// ============================================================================
// FEATURE-SPECIFIC COMPOSITIONS
// ============================================================================

/**
 * Minimal Client - For lightweight clients
 */
export const MinimalClientLive = Layer.mergeAll(EssentialServicesLive, InputServicesLive, Layer.effectDiscard(Effect.log('Minimal client configuration')))

/**
 * Full Client - Complete client experience
 */
export const FullClientLive = Layer.mergeAll(GameLogicServicesLive, RenderingStackLive, Layer.effectDiscard(Effect.log('Full client with all features')))

/**
 * Compute Node - Background processing node
 */
export const ComputeNodeLive = Layer.mergeAll(EssentialServicesLive, ComputeServicesLive, Layer.effectDiscard(Effect.log('Compute node for background processing')))

// ============================================================================
// DYNAMIC LAYER BUILDER
// ============================================================================

/**
 * Configuration for custom layer building
 */
export interface LayerConfig {
  readonly environment: 'development' | 'production' | 'test' | 'server'
  readonly features: {
    readonly rendering?: boolean
    readonly workers?: boolean
    readonly ui?: boolean
    readonly input?: boolean
  }
  readonly optimization: {
    readonly memory?: boolean
    readonly performance?: boolean
    readonly startup?: boolean
  }
}

/**
 * Build optimized layer based on configuration
 */
export const buildOptimizedLayer = (config: LayerConfig) => {
  const baseLayers = [EssentialServicesLive]

  // Add application layer for non-test environments
  if (config.environment !== 'test') {
    baseLayers.push(ApplicationLayer)
  }

  // Add feature layers based on configuration
  if (config.features.rendering) {
    baseLayers.push(RenderingServicesLive)
  }

  if (config.features.workers) {
    baseLayers.push(WorkerServicesLive)
  }

  if (config.features.ui) {
    baseLayers.push(UIServicesLive)
  }

  if (config.features.input) {
    baseLayers.push(InputServicesLive)
  }

  // Add world services for non-minimal configurations
  if (config.environment !== 'test' || config.features.rendering) {
    baseLayers.push(WorldServicesLive)
  }

  return baseLayers.length > 1 ? Layer.mergeAll(...baseLayers) : baseLayers[0]
}

/**
 * Get optimized layer for environment
 */
export const getOptimizedLayer = (environment?: string) => {
  switch (environment) {
    case 'production':
      return OptimizedProductionLive
    case 'test':
      return OptimizedTestLive
    case 'server':
      return OptimizedServerLive
    case 'development':
    default:
      return OptimizedDevelopmentLive
  }
}
