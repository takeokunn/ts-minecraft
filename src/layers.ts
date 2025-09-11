/**
 * Unified Application Layer Composition
 *
 * This file provides the main layer composition using the unified infrastructure
 * layer system. All services are now consolidated in the unified.layer.ts file.
 */

import { Layer } from 'effect'

// Import unified infrastructure layers
import {
  // Layer compositions
  DomainServicesLive,
  CoreServicesLive,
  WorldServicesLive,
  WorkerServicesLive,
  RenderingServicesLive,
  InputServicesLive,
  UIServicesLive,
  UnifiedAppLive,

  // Preset configurations
  MinimalLive,
  HeadlessLive,
  DevelopmentLive,
  ProductionLive,
  buildCustomLayer,
  getRuntimeLayer,

  // Service definitions for dependency injection
  Clock,
  Stats,
  World,
  ChunkManager,
  Renderer,
  InputManager,
  MaterialManager,
  SpatialGrid,
  TerrainGenerator,
  WorkerManager,
  RenderCommand,
  Raycast,
  UIService,
  WorldDomainService,
  PhysicsDomainService,
  EntityDomainService,

  // Types
  type PerformanceStats,
  type InputState,
  type RenderCommandType,
  type RaycastResult,
  type WorldState,
} from '@/infrastructure/layers/unified.layer'

// Import application layer
import { ApplicationLayer } from '@/application/application-layer'

// ===== LAYER COMPOSITIONS BY ARCHITECTURE TIER =====

/**
 * Domain Layer - Pure domain logic services
 * Contains business rules and domain entities
 */
export const DomainLayer = DomainServicesLive

/**
 * Infrastructure Layer - Technical infrastructure services
 * Contains implementations of ports defined by domain/application layers
 */
export const InfrastructureLayer = Layer.mergeAll(CoreServicesLive, RenderingServicesLive, InputServicesLive, WorkerServicesLive)

/**
 * Application Layer - Application services and use cases
 * Orchestrates domain services to implement business use cases
 */
export const ApplicationServicesLayer = ApplicationLayer

/**
 * Presentation Layer - UI and presentation services
 * Handles user interface and external communication
 */
export const PresentationLayer = UIServicesLive

// ===== COMPLETE APPLICATION LAYERS =====

/**
 * Complete unified application layer - all services composed
 * This is the main layer used in production
 */
export const AppLayer = Layer.mergeAll(UnifiedAppLive, ApplicationLayer)

/**
 * Development layer with debug capabilities
 */
export const DevLayer = DevelopmentLive

/**
 * Production optimized layer
 */
export const ProdLayer = ProductionLive

/**
 * Minimal layer for unit testing
 */
export const TestLayer = MinimalLive

/**
 * Headless layer for server/simulation (no UI/input)
 */
export const ServerLayer = HeadlessLive

// ===== ENVIRONMENT-BASED LAYER SELECTION =====

/**
 * Get appropriate layer based on environment
 */
export const getAppLayer = (environment: 'development' | 'production' | 'test' | 'server' = 'development') => {
  switch (environment) {
    case 'production':
      return ProdLayer
    case 'test':
      return TestLayer
    case 'server':
      return ServerLayer
    case 'development':
    default:
      return DevLayer
  }
}

/**
 * Get runtime layer (automatically detects environment)
 */
export const getAutoLayer = getRuntimeLayer

// ===== CUSTOM LAYER BUILDER =====

/**
 * Build custom layer composition for specific use cases
 */
export const createCustomLayer = buildCustomLayer

// ===== SERVICE EXPORTS FOR DEPENDENCY INJECTION =====

export {
  // Infrastructure Services
  Clock,
  Stats,
  World,
  ChunkManager,
  Renderer,
  InputManager,
  MaterialManager,
  SpatialGrid,
  TerrainGenerator,
  WorkerManager,
  RenderCommand,
  Raycast,
  UIService,

  // Domain Services
  WorldDomainService,
  PhysicsDomainService,
  EntityDomainService,
}

// ===== TYPE EXPORTS =====

export type { PerformanceStats, InputState, RenderCommandType, RaycastResult, WorldState }

// ===== BACKWARDS COMPATIBILITY =====

// Legacy exports for existing code
export { AppLayer as CompleteAppLayer }
export { DomainLayer as DomainServicesLayer }
export { InfrastructureLayer as InfrastructureServicesLayer }
export { ApplicationLayer as ApplicationServicesLayer }
export { PresentationLayer as PresentationServicesLayer }
