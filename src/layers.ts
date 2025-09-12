/**
 * Optimized Layer Composition System
 *
 * This file provides a clean, optimized layer composition system with:
 * - Core architectural layers (Domain, Infrastructure, Application, Presentation)
 * - Environment-specific layer configurations
 * - Simplified layer composition without unnecessary complexity
 * - TaggedError handling for layer composition failures
 */

import { Layer, Effect, Schema, pipe } from 'effect'

// Import unified infrastructure layers
import {
  DomainServicesLive,
  CoreServicesLive,
  RenderingServicesLive,
  InputServicesLive,
  UIServicesLive,
  ProductionLive,
  MinimalLive,
} from '@infrastructure/layers/unified.layer'

// Import application layer
import { ApplicationLayer } from '@application/application-layer'

// ===== TAGGED ERROR DEFINITIONS =====

/**
 * Layer composition error for layer merging and dependency injection failures
 */
export class LayerCompositionError extends Schema.TaggedError<LayerCompositionError>()('LayerCompositionError', {
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
  layerName: Schema.optional(Schema.String), // which layer failed to compose
  stage: Schema.optional(Schema.String), // composition stage that failed
}) {}

/**
 * Helper function to safely merge layers with error handling
 */
const safeMergeAll = <A, E, R>(...layers: ReadonlyArray<Layer.Layer<A, E, R>>): Layer.Layer<A, LayerCompositionError | E, R> =>
  pipe(
    Layer.mergeAll(...layers),
    Layer.catchAll((error) =>
      Layer.fail(
        new LayerCompositionError({
          message: 'Layer merge failed',
          timestamp: Date.now(),
          cause: error,
          stage: 'layer_merge',
        })
      )
    )
  )

/**
 * Helper function to safely provide layer with error handling
 */
const safeProvide = <A, E, R, E2, R2>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, E2, R2>
): Effect.Effect<A, LayerCompositionError | E | E2, R2> =>
  pipe(
    effect,
    Effect.provide(layer),
    Effect.catchAll((error) =>
      new LayerCompositionError({
        message: 'Layer provide failed',
        timestamp: Date.now(),
        cause: error,
        stage: 'layer_provide',
      })
    )
  )

// Import infrastructure adapters
import { 
  CompleteAdapterLayer,
  ProductionAdapterLayer,
  MinimalAdapterLayer,
} from '@infrastructure/adapters'

// ===== CORE ARCHITECTURAL LAYERS =====

/**
 * Domain Layer - Pure domain logic and business rules
 */
const DomainLayer = DomainServicesLive

/**
 * Infrastructure Layer - Technical infrastructure services and port implementations
 * Includes error handling for layer composition failures
 */
const InfrastructureLayer = pipe(
  Layer.mergeAll(
    CoreServicesLive,
    RenderingServicesLive,
    InputServicesLive
  ),
  Layer.catchAll((error) =>
    Layer.fail(
      new LayerCompositionError({
        message: 'Infrastructure layer composition failed',
        timestamp: Date.now(),
        cause: error,
        layerName: 'InfrastructureLayer',
        stage: 'infrastructure_merge',
      })
    )
  )
)

/**
 * Core Layers - Domain + Infrastructure
 * Foundation layers required by all applications
 */
const CoreLayers = pipe(
  Layer.mergeAll(DomainLayer, InfrastructureLayer),
  Layer.catchAll((error) =>
    Layer.fail(
      new LayerCompositionError({
        message: 'Core layers composition failed',
        timestamp: Date.now(),
        cause: error,
        layerName: 'CoreLayers',
        stage: 'core_merge',
      })
    )
  )
)

/**
 * Application Layer - Core layers + Application services
 * Business use cases and application orchestration
 */
const ApplicationLayerComposed = pipe(
  Layer.mergeAll(CoreLayers, ApplicationLayer),
  Layer.catchAll((error) =>
    Layer.fail(
      new LayerCompositionError({
        message: 'Application layer composition failed',
        timestamp: Date.now(),
        cause: error,
        layerName: 'ApplicationLayerComposed',
        stage: 'application_merge',
      })
    )
  )
)

/**
 * Full Stack Layer - Application layer + Presentation layer
 * Complete application with UI capabilities
 */
const FullStackLayer = pipe(
  Layer.mergeAll(ApplicationLayerComposed, UIServicesLive),
  Layer.catchAll((error) =>
    Layer.fail(
      new LayerCompositionError({
        message: 'Full stack layer composition failed',
        timestamp: Date.now(),
        cause: error,
        layerName: 'FullStackLayer',
        stage: 'fullstack_merge',
      })
    )
  )
)

// ===== ENVIRONMENT-SPECIFIC LAYER CREATION =====

/**
 * Create environment-specific layer with appropriate adapters and optimizations
 * Includes TaggedError handling for layer composition failures
 */
export const createEnvironmentLayer = (env: 'production' | 'development' | 'test') => {
  try {
    switch (env) {
      case 'production':
        return pipe(
          Layer.mergeAll(
            FullStackLayer,
            ProductionLive,
            ProductionAdapterLayer
          ),
          Layer.catchAll((error) =>
            Layer.fail(
              new LayerCompositionError({
                message: `Production layer composition failed`,
                timestamp: Date.now(),
                cause: error,
                layerName: 'ProductionLayer',
                stage: 'production_merge',
              })
            )
          )
        )
      
      case 'development':
        return pipe(
          Layer.mergeAll(
            FullStackLayer,
            CompleteAdapterLayer
          ),
          Layer.catchAll((error) =>
            Layer.fail(
              new LayerCompositionError({
                message: `Development layer composition failed`,
                timestamp: Date.now(),
                cause: error,
                layerName: 'DevelopmentLayer',
                stage: 'development_merge',
              })
            )
          )
        )
      
      case 'test':
        return pipe(
          Layer.mergeAll(
            ApplicationLayerComposed, // No UI layer for tests
            MinimalLive,
            MinimalAdapterLayer
          ),
          Layer.catchAll((error) =>
            Layer.fail(
              new LayerCompositionError({
                message: `Test layer composition failed`,
                timestamp: Date.now(),
                cause: error,
                layerName: 'TestLayer',
                stage: 'test_merge',
              })
            )
          )
        )
    }
  } catch (error) {
    return Layer.fail(
      new LayerCompositionError({
        message: `Environment layer creation failed for: ${env}`,
        timestamp: Date.now(),
        cause: error,
        layerName: `${env}Layer`,
        stage: 'environment_creation',
      })
    )
  }
}

// ===== SIMPLIFIED APP LAYER FUNCTION =====

/**
 * Get appropriate application layer based on environment
 * Includes comprehensive error handling with TaggedError pattern
 */
export const getAppLayer = (environment: 'development' | 'production' | 'test' = 'development') => {
  try {
    return createEnvironmentLayer(environment)
  } catch (error) {
    return Layer.fail(
      new LayerCompositionError({
        message: `Failed to get app layer for environment: ${environment}`,
        timestamp: Date.now(),
        cause: error,
        layerName: 'AppLayer',
        stage: 'environment_selection',
      })
    )
  }
}

/**
 * Safe layer composition with comprehensive error handling
 * Returns an Effect that can be used with proper error handling
 */
export const safeGetAppLayer = (environment: 'development' | 'production' | 'test' = 'development') =>
  pipe(
    Effect.try(() => getAppLayer(environment)),
    Effect.catchAll((error) =>
      Effect.fail(
        new LayerCompositionError({
          message: `Layer composition failed for environment: ${environment}`,
          timestamp: Date.now(),
          cause: error,
          layerName: 'SafeAppLayer',
          stage: 'safe_composition',
        })
      )
    )
  )

// ===== PUBLIC LAYER EXPORTS =====

/**
 * Core architectural layers for modular composition
 */
export {
  DomainLayer,
  InfrastructureLayer,
  ApplicationLayerComposed as ApplicationLayer,
  FullStackLayer
}

/**
 * Main application layer - development environment by default
 */
export const AppLayer = createEnvironmentLayer('development')
