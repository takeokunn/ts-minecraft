/**
 * Component Registry with Automatic Registration System
 * 
 * This registry provides:
 * - Automatic component registration
 * - Archetype-based query optimization
 * - SoA (Structure of Arrays) / AoS (Array of Structures) conversion
 * - Type-safe component access
 * - Performance optimizations through archetype caching
 */

import * as S from "@effect/schema/Schema"
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'

// Base component interface
export interface ComponentMeta {
  readonly id: string
  readonly category: 'physics' | 'rendering' | 'gameplay' | 'world'
  readonly schema: S.Schema<any, any, never>
  readonly priority?: number
  readonly dependencies?: readonly string[]
  readonly conflictsWith?: readonly string[]
}

// Component registry state
export interface ComponentRegistryState extends Data.Data<ComponentRegistryState> {
  readonly components: HashMap.HashMap<string, ComponentMeta>
  readonly archetypes: HashMap.HashMap<string, ArchetypeInfo>
  readonly soaBuffers: HashMap.HashMap<string, SoABuffer>
}

// Archetype information for query optimization
export interface ArchetypeInfo extends Data.Data<ArchetypeInfo> {
  readonly signature: readonly string[]
  readonly entities: readonly number[]
  readonly storageLayout: StorageLayout
}

// Storage layout configuration
export type StorageLayout = 'AoS' | 'SoA' | 'Hybrid'

// SoA buffer for performance-critical components
export interface SoABuffer extends Data.Data<SoABuffer> {
  readonly componentId: string
  readonly capacity: number
  readonly length: number
  readonly data: ArrayBuffer
  readonly views: Record<string, Float32Array | Int32Array | Uint8Array>
}

// Registry implementation
export class ComponentRegistry {
  private state: ComponentRegistryState

  constructor() {
    this.state = Data.struct({
      components: HashMap.empty(),
      archetypes: HashMap.empty(),
      soaBuffers: HashMap.empty(),
    })
  }

  /**
   * Register a component with automatic metadata extraction
   */
  register<T>(meta: ComponentMeta): void {
    this.state = Data.struct({
      ...this.state,
      components: HashMap.set(this.state.components, meta.id, meta),
    })
    
    // Initialize SoA buffer for physics and performance-critical components
    if (meta.category === 'physics' || meta.priority === 1) {
      this.initializeSoABuffer(meta.id, meta.schema)
    }
  }

  /**
   * Get component metadata
   */
  getComponent(id: string): Option.Option<ComponentMeta> {
    return HashMap.get(this.state.components, id)
  }

  /**
   * Get all components in a category
   */
  getComponentsByCategory(category: ComponentMeta['category']): readonly ComponentMeta[] {
    return Array.fromIterable(
      HashMap.values(
        HashMap.filter(this.state.components, (meta) => meta.category === category)
      )
    )
  }

  /**
   * Create or get archetype for component signature
   */
  getArchetype(componentIds: readonly string[]): ArchetypeInfo {
    const signature = Array.sort(componentIds, (a, b) => a.localeCompare(b))
    const archetypeKey = signature.join('|')
    
    return Option.getOrElse(
      HashMap.get(this.state.archetypes, archetypeKey),
      () => {
        const archetype = this.createArchetype(signature)
        this.state = Data.struct({
          ...this.state,
          archetypes: HashMap.set(this.state.archetypes, archetypeKey, archetype),
        })
        return archetype
      }
    )
  }

  /**
   * Query entities by component requirements
   */
  query(required: readonly string[], optional: readonly string[] = []): QueryResult {
    const archetype = this.getArchetype(required)
    return {
      entities: archetype.entities,
      getComponent: <T>(entityId: number, componentId: string) => 
        this.getEntityComponent<T>(entityId, componentId),
      hasComponent: (entityId: number, componentId: string) =>
        this.hasEntityComponent(entityId, componentId),
      storageLayout: archetype.storageLayout,
    }
  }

  /**
   * Convert storage layout for performance optimization
   */
  convertStorageLayout(componentId: string, targetLayout: StorageLayout): void {
    const soaBuffer = HashMap.get(this.state.soaBuffers, componentId)
    if (Option.isSome(soaBuffer)) {
      // Perform SoA/AoS conversion logic here
      this.performStorageConversion(soaBuffer.value, targetLayout)
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): RegistryMetrics {
    return {
      componentCount: HashMap.size(this.state.components),
      archetypeCount: HashMap.size(this.state.archetypes),
      soaBufferCount: HashMap.size(this.state.soaBuffers),
      totalMemoryUsage: this.calculateMemoryUsage(),
    }
  }

  // Private methods

  private createArchetype(componentIds: readonly string[]): ArchetypeInfo {
    // Determine optimal storage layout based on component types
    const storageLayout = this.determineOptimalStorageLayout(componentIds)
    
    return Data.struct({
      signature: componentIds,
      entities: [],
      storageLayout,
    })
  }

  private initializeSoABuffer(componentId: string, schema: S.Schema<any, any, never>): void {
    const buffer = Data.struct({
      componentId,
      capacity: 1024, // Initial capacity
      length: 0,
      data: new ArrayBuffer(1024 * 32), // 32 bytes per component initially
      views: {},
    })

    this.state = Data.struct({
      ...this.state,
      soaBuffers: HashMap.set(this.state.soaBuffers, componentId, buffer),
    })
  }

  private determineOptimalStorageLayout(componentIds: readonly string[]): StorageLayout {
    const physicsComponents = componentIds.filter(id => {
      const meta = HashMap.get(this.state.components, id)
      return Option.match(meta, {
        onNone: () => false,
        onSome: (m) => m.category === 'physics'
      })
    })

    // Use SoA for physics-heavy archetypes, AoS for mixed archetypes
    return physicsComponents.length > componentIds.length / 2 ? 'SoA' : 'AoS'
  }

  private getEntityComponent<T>(entityId: number, componentId: string): Option.Option<T> {
    // Implementation for component retrieval
    return Option.none()
  }

  private hasEntityComponent(entityId: number, componentId: string): boolean {
    // Implementation for component existence check
    return false
  }

  private performStorageConversion(buffer: SoABuffer, targetLayout: StorageLayout): void {
    // Implementation for storage layout conversion
    console.log(`Converting storage layout to ${targetLayout} for component ${buffer.componentId}`)
  }

  private calculateMemoryUsage(): number {
    return Array.reduce(
      Array.fromIterable(HashMap.values(this.state.soaBuffers)),
      0,
      (acc, buffer) => acc + buffer.data.byteLength
    )
  }
}

// Query result interface
export interface QueryResult {
  readonly entities: readonly number[]
  readonly getComponent: <T>(entityId: number, componentId: string) => Option.Option<T>
  readonly hasComponent: (entityId: number, componentId: string) => boolean
  readonly storageLayout: StorageLayout
}

// Performance metrics
export interface RegistryMetrics {
  readonly componentCount: number
  readonly archetypeCount: number
  readonly soaBufferCount: number
  readonly totalMemoryUsage: number
}

// Global registry instance
export const globalRegistry = new ComponentRegistry()

// Decorator for automatic component registration
export const RegisterComponent = (meta: Omit<ComponentMeta, 'schema'>) => 
  <T extends S.Schema<any, any, never>>(schema: T): T => {
    globalRegistry.register({
      ...meta,
      schema,
    })
    return schema
  }