import { Layer, Effect } from 'effect'
import { 
  Renderer, 
  InputManager, 
  Clock, 
  Stats, 
  SpatialGrid,
  MaterialManager,
  WorkerManager,
  ChunkManager,
  TerrainGenerator
} from '@/services'

/**
 * Consolidated Layer implementations for dependency injection
 * Provides production implementations of all services
 */

// Re-export individual layer implementations
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

// Import implementations
import { WorldLive } from './world.live'
import { RendererLive } from './renderer.live'
import { InputManagerLive } from './input-manager.live'
import { ClockLive } from './clock.live'
import { StatsLive } from './stats.live'
import { SpatialGridLive } from './spatial-grid.live'
import { MaterialManagerLive } from './material-manager.live'
import { WorkerManagerLive } from './worker-manager.live'
import { ChunkManagerLive } from './chunk-manager.live'
import { TerrainGeneratorLive } from './terrain-generator.live'

/**
 * Core services layer - essential services without dependencies
 */
export const CoreServicesLive = Layer.mergeAll(
  ClockLive,
  StatsLive,
  SpatialGridLive,
  MaterialManagerLive
)

/**
 * World services layer - world and chunk management
 */
export const WorldServicesLive = Layer.mergeAll(
  WorldLive,
  ChunkManagerLive
).pipe(
  Layer.provide(CoreServicesLive)
)

/**
 * Worker services layer - background processing
 */
export const WorkerServicesLive = Layer.mergeAll(
  WorkerManagerLive,
  TerrainGeneratorLive
).pipe(
  Layer.provide(CoreServicesLive)
)

/**
 * Rendering services layer - visual output
 */
export const RenderingServicesLive = RendererLive.pipe(
  Layer.provide(MaterialManagerLive)
)

/**
 * Input services layer - user interaction
 */
export const InputServicesLive = InputManagerLive

/**
 * Complete application layer - all services composed
 */
export const AppLive = Layer.mergeAll(
  WorldServicesLive,
  WorkerServicesLive,
  RenderingServicesLive,
  InputServicesLive,
  CoreServicesLive
)

/**
 * Test layer - all services with test implementations
 */
export const AppTest = Layer.mergeAll(
  // Import from test-utils when needed
  CoreServicesLive // Use real core services even in tests
)

/**
 * Layer presets for different runtime configurations
 */

/**
 * Minimal layer - just core services for unit tests
 */
export const MinimalLive = CoreServicesLive

/**
 * Headless layer - no rendering or input (for server/simulation)
 */
export const HeadlessLive = Layer.mergeAll(
  WorldServicesLive,
  WorkerServicesLive,
  CoreServicesLive
)

/**
 * Development layer - includes debug services
 */
export const DevelopmentLive = AppLive.pipe(
  Layer.tap(
    Effect.log('Development environment initialized')
  )
)

/**
 * Production layer - optimized for performance
 */
export const ProductionLive = AppLive.pipe(
  Layer.tap(
    Effect.log('Production environment initialized')
  )
)

/**
 * Helper to build custom layer compositions
 */
export const buildCustomLayer = (
  config: {
    world?: boolean
    rendering?: boolean
    input?: boolean
    workers?: boolean
    core?: boolean
  }
) => {
  const layers: Layer.Layer<any, any, any>[] = []
  
  if (config.core !== false) layers.push(CoreServicesLive)
  if (config.world) layers.push(WorldServicesLive)
  if (config.rendering) layers.push(RenderingServicesLive)
  if (config.input) layers.push(InputServicesLive)
  if (config.workers) layers.push(WorkerServicesLive)
  
  return layers.length > 0 
    ? Layer.mergeAll(...layers)
    : Layer.empty
}

/**
 * Runtime configuration based on environment
 */
export const getRuntimeLayer = () => {
  const env = process.env.NODE_ENV
  
  switch (env) {
    case 'production':
      return ProductionLive
    case 'test':
      return AppTest
    case 'development':
    default:
      return DevelopmentLive
  }
}