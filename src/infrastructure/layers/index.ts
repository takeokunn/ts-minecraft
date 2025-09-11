import { Layer, Effect } from 'effect'

/**
 * Unified Layer implementations for dependency injection
 * All service definitions and implementations are now consolidated in unified.layer.ts
 */

// Import from unified layer
import {
  // Core Services
  ClockLive,
  StatsLive,
  SpatialGridLive,
  MaterialManagerLive,
  TerrainGeneratorLive,
  RenderCommandLive,
  RaycastLive,
  
  // World Services
  WorldLive,
  ChunkManagerLive,
  
  // Worker Services
  WorkerManagerLive,
  
  // Rendering Services
  RendererLive,
  
  // Input Services
  InputManagerLive,
  
  // UI Services
  UIServiceLive,
  
  // Domain Services
  WorldDomainServiceLive,
  PhysicsDomainServiceLive,
  EntityDomainServiceLive,
  
  // Service Definitions (Context Tags)
  Clock,
  Stats,
  SpatialGrid,
  MaterialManager,
  TerrainGenerator,
  RenderCommand,
  Raycast,
  World,
  ChunkManager,
  WorkerManager,
  Renderer,
  InputManager,
  UIService,
  WorldDomainService,
  PhysicsDomainService,
  EntityDomainService,
  
  // Layer compositions
  DomainServicesLive,
  CoreServicesLive,
  WorldServicesLive,
  WorkerServicesLive,
  RenderingServicesLive,
  InputServicesLive,
  UIServicesLive,
  UnifiedAppLive,
  MinimalLive,
  HeadlessLive,
  DevelopmentLive,
  ProductionLive,
  buildCustomLayer,
  getRuntimeLayer,
  
  // Type exports
  type PerformanceStats,
  type InputState,
  type RenderCommandType,
  type RaycastResult,
  type WorldState
} from './unified.layer'

// Re-export individual layer implementations for backwards compatibility
export { WorldLive } from './world.live'
export { RendererLive } from './renderer.live'
export { InputManagerLive } from './input-manager.live'
export { ClockLive } from './clock.live'
export { StatsLive } from './stats.live'
export { SpatialGridLive } from './spatial-grid.live'
export { MaterialManagerLive } from './material-manager.live'
export { WorkerManagerLive } from './worker-manager.live'
export { ChunkManagerLive } from './chunk-manager.live'
export { TerrainGeneratorLive } from './terrain-generator.live'
export { RenderCommandLive } from './render-command.live'
export { RaycastLive } from './raycast.live'
export { UIServiceLive } from './ui-service.live'

// Re-export domain service implementations
export { WorldDomainServiceLive, PhysicsDomainServiceLive, EntityDomainServiceLive }

// Re-export service definitions
export {
  Clock,
  Stats,
  SpatialGrid,
  MaterialManager,
  TerrainGenerator,
  RenderCommand,
  Raycast,
  World,
  ChunkManager,
  WorkerManager,
  Renderer,
  InputManager,
  UIService,
  WorldDomainService,
  PhysicsDomainService,
  EntityDomainService
}

// Re-export types
export type {
  PerformanceStats,
  InputState,
  RenderCommandType,
  RaycastResult,
  WorldState
}

// Re-export layer compositions from unified layer
export {
  DomainServicesLive,
  CoreServicesLive,
  WorldServicesLive,
  WorkerServicesLive,
  RenderingServicesLive,
  InputServicesLive,
  UIServicesLive,
  UnifiedAppLive as AppLive, // Map UnifiedAppLive to AppLive for compatibility
  UnifiedAppLive as AppTest, // Use same layer for tests for now
  MinimalLive,
  HeadlessLive,
  DevelopmentLive,
  ProductionLive,
  buildCustomLayer,
  getRuntimeLayer
} from './unified.layer'