/**
 * Next-Generation Component System
 * 
 * Features:
 * - Automatic component registration with ComponentRegistry
 * - Archetype-based query optimization for ECS performance
 * - SoA (Structure of Arrays) / AoS (Array of Structures) automatic conversion
 * - Type-safe component access and manipulation
 * - Category-based component organization
 * - Performance monitoring and optimization hints
 */

import * as S from '@effect/schema/Schema'
import * as Data from 'effect/Data'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'

// Import registry and all component categories
import { globalRegistry, ComponentRegistry, RegisterComponent } from './registry'
import type { 
  ComponentMeta,
  ComponentRegistryState,
  ArchetypeInfo,
  StorageLayout,
  SoABuffer,
  QueryResult,
  RegistryMetrics 
} from './registry'

// Re-export for external use
export { globalRegistry, ComponentRegistry, RegisterComponent }
export type { 
  ComponentMeta,
  ComponentRegistryState,
  ArchetypeInfo,
  StorageLayout,
  SoABuffer,
  QueryResult,
  RegistryMetrics 
}

// Import all component categories
export * from './physics'
export * from './rendering'
export * from './gameplay'
export * from './world'

// Import component categories as organized modules
import * as PhysicsModule from './physics'
import * as RenderingModule from './rendering'
import * as GameplayModule from './gameplay'
import * as WorldModule from './world'

// ===== ARCHETYPE QUERY OPTIMIZATION =====

/**
 * Archetype query builder for optimized component access
 */
export class ArchetypeQuery {
  private requiredComponents: readonly string[] = []
  private optionalComponents: readonly string[] = []
  private excludedComponents: readonly string[] = []

  static create(): ArchetypeQuery {
    return new ArchetypeQuery()
  }

  /**
   * Add required components to the query
   */
  with<T extends string>(...componentIds: T[]): ArchetypeQuery {
    return Data.struct({
      ...this,
      requiredComponents: [...this.requiredComponents, ...componentIds],
    })
  }

  /**
   * Add optional components to the query
   */
  maybe<T extends string>(...componentIds: T[]): ArchetypeQuery {
    return Data.struct({
      ...this,
      optionalComponents: [...this.optionalComponents, ...componentIds],
    })
  }

  /**
   * Exclude components from the query
   */
  without<T extends string>(...componentIds: T[]): ArchetypeQuery {
    return Data.struct({
      ...this,
      excludedComponents: [...this.excludedComponents, ...componentIds],
    })
  }

  /**
   * Execute the query and return results
   */
  execute(): ArchetypeQueryResult {
    const registry = globalRegistry
    const archetype = registry.getArchetype(this.requiredComponents)
    
    // Filter entities that don't have excluded components
    const filteredEntities = archetype.entities.filter(entityId => {
      return !this.excludedComponents.some(componentId => 
        registry.query([componentId]).hasComponent(entityId, componentId)
      )
    })

    return {
      entities: filteredEntities,
      archetype,
      getComponent: <T>(entityId: number, componentId: string) => 
        registry.query([componentId]).getComponent<T>(entityId, componentId),
      hasComponent: (entityId: number, componentId: string) =>
        registry.query([componentId]).hasComponent(entityId, componentId),
      requiredComponents: this.requiredComponents,
      optionalComponents: this.optionalComponents,
      storageLayout: archetype.storageLayout,
    }
  }
}

export interface ArchetypeQueryResult {
  readonly entities: readonly number[]
  readonly archetype: ArchetypeInfo
  readonly getComponent: <T>(entityId: number, componentId: string) => Option.Option<T>
  readonly hasComponent: (entityId: number, componentId: string) => boolean
  readonly requiredComponents: readonly string[]
  readonly optionalComponents: readonly string[]
  readonly storageLayout: StorageLayout
}

// ===== PERFORMANCE OPTIMIZATION SYSTEM =====

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
      .filter(metric => metric.suggestedOptimization !== 'none')
      .map(metric => ({
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

    suggestions.forEach(suggestion => {
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

interface PerformanceMetric {
  componentId: string
  readCount: number
  writeCount: number
  totalReadTime: number
  totalWriteTime: number
  suggestedOptimization: StorageLayout | 'none'
}

interface OptimizationSuggestion {
  componentId: string
  currentLayout: StorageLayout
  suggestedLayout: StorageLayout | 'none'
  reason: string
}

// ===== UNIFIED COMPONENT REGISTRY =====

// Aggregate all component schemas for the central registry
export const ComponentSchemas = {
  // Physics components
  position: PhysicsModule.PositionComponent,
  velocity: PhysicsModule.VelocityComponent,
  acceleration: PhysicsModule.AccelerationComponent,
  mass: PhysicsModule.MassComponent,
  collider: PhysicsModule.ColliderComponent,
  
  // Rendering components  
  mesh: RenderingModule.MeshComponent,
  material: RenderingModule.MaterialComponent,
  light: RenderingModule.LightComponent,
  camera: RenderingModule.CameraComponent,
  renderable: RenderingModule.RenderableComponent,
  
  // Gameplay components
  health: GameplayModule.HealthComponent,
  inventory: GameplayModule.InventoryComponent,
  playerControl: GameplayModule.PlayerControlComponent,
  ai: GameplayModule.AIComponent,
  target: GameplayModule.TargetComponent,
  player: GameplayModule.PlayerComponent,
  inputState: GameplayModule.InputStateComponent,
  cameraState: GameplayModule.CameraStateComponent,
  hotbar: GameplayModule.HotbarComponent,
  gravity: GameplayModule.GravityComponent,
  frozen: GameplayModule.FrozenComponent,
  disabled: GameplayModule.DisabledComponent,
  
  // World components
  chunk: WorldModule.ChunkComponent,
  chunkLoaderState: WorldModule.ChunkLoaderStateComponent,
  terrainBlock: WorldModule.TerrainBlockComponent,
  targetBlock: WorldModule.TargetBlockComponent,
} as const

// Type definitions
export type ComponentName = keyof typeof ComponentSchemas
export const componentNames = Object.keys(ComponentSchemas) as Array<ComponentName>
export const ComponentNameSchema = S.Literal(...componentNames)
export const componentNamesSet = new Set<string>(componentNames)

export type ComponentOfName<T extends ComponentName> = S.Schema.Type<(typeof ComponentSchemas)[T]>

export type Components = {
  [K in ComponentName]: ComponentOfName<K>
}

// Union types for any component - Comment out for now due to schema conflicts
// export const AnyComponent = S.Union(...Object.values(ComponentSchemas))
// export type AnyComponent = S.Schema.Type<typeof AnyComponent>

// Partial components schema - Comment out for now due to schema conflicts
// export const PartialComponentsSchema = S.partial(S.Struct(ComponentSchemas))
// export type PartialComponents = S.Schema.Type<typeof PartialComponentsSchema>

// ===== UTILITY FUNCTIONS AND EXPORTS =====

// Global instances  
export const performanceManager = new ComponentPerformanceManager()

// High-level query interface
export const query = (components: readonly string[]): QueryResult => 
  globalRegistry.query(components)

export const createArchetypeQuery = (): ArchetypeQuery => 
  ArchetypeQuery.create()

// Performance monitoring
export const trackPerformance = (componentId: string, accessType: 'read' | 'write', duration: number): void =>
  performanceManager.trackComponentAccess(componentId, accessType, duration)

export const getOptimizationSuggestions = (): readonly OptimizationSuggestion[] =>
  performanceManager.getOptimizationSuggestions()

export const applyOptimizations = (): void =>
  performanceManager.applyOptimizations()

// Component factory aggregation
export const ComponentFactories = {
  // Physics
  ...PhysicsModule.PhysicsComponentFactories,
  // Rendering
  ...RenderingModule.RenderingComponentFactories,
  // Gameplay
  ...GameplayModule.GameplayComponentFactories,
} as const

// Component aggregations by category
export const ComponentCategories = {
  Physics: PhysicsModule.PhysicsComponents,
  Rendering: RenderingModule.RenderingComponents,
  Gameplay: GameplayModule.GameplayComponents,
} as const

// Registry reference is already exported above

// Type exports for external use
export type {
  PerformanceMetric,
  OptimizationSuggestion,
}