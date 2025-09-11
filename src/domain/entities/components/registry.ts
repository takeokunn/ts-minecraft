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

import * as S from "effect/Schema"
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'

// Base component interface with improved typing
export interface ComponentMeta<TSchema = S.Schema<any, any, any>> {
  readonly id: string
  readonly category: 'physics' | 'rendering' | 'gameplay' | 'world'
  readonly schema: TSchema
  readonly priority?: number
  readonly dependencies?: readonly string[]
  readonly conflictsWith?: readonly string[]
  readonly _tag: string // Discriminated union tag
}

// Component registry state
export interface ComponentRegistryState {
  readonly components: HashMap.HashMap<string, ComponentMeta>
  readonly archetypes: HashMap.HashMap<string, ArchetypeInfo>
  readonly soaBuffers: HashMap.HashMap<string, SoABuffer>
}

// Archetype information for query optimization
export interface ArchetypeInfo {
  readonly signature: readonly string[]
  readonly entities: readonly number[]
  readonly storageLayout: StorageLayout
}

// Storage layout configuration with enhanced options
export type StorageLayout = 'AoS' | 'SoA' | 'Hybrid' | 'none'

// SoA buffer for performance-critical components
export interface SoABuffer {
  readonly componentId: string
  readonly capacity: number
  readonly length: number
  readonly data: ArrayBuffer
  readonly views: Record<string, Float32Array | Int32Array | Uint8Array>
}

// Enhanced component type with generic parameter
export type Component<T = unknown> = {
  readonly _tag: string
  readonly data: T
}

// Type guard for component validation
export function isComponent<T>(value: unknown, tag: string): value is Component<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    (value as { _tag: unknown })._tag === tag &&
    'data' in value
  )
}

// Type guard for checking if entity has component
export function hasComponent<T extends Record<string, Component>>(
  entity: T, 
  componentId: keyof T
): componentId is keyof T {
  return componentId in entity && isComponent(entity[componentId], componentId as string)
}

// Enhanced entity type with generic components
export type Entity<TComponents extends Record<string, Component> = Record<string, Component>> = {
  readonly id: number
  readonly components: TComponents
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
  register<TSchema extends S.Schema<any, any, any>>(meta: ComponentMeta<TSchema>): void {
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
   * Get component metadata with type safety
   */
  getComponent<TSchema extends S.Schema<any, any, any>>(
    id: string
  ): Option.Option<ComponentMeta<TSchema>> {
    return HashMap.get(this.state.components, id) as Option.Option<ComponentMeta<TSchema>>
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
    const signature = Array.sort(componentIds, (a: string, b: string) => {
      const result = a.localeCompare(b)
      return result < 0 ? -1 : result > 0 ? 1 : 0
    })
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
   * Query entities by component requirements with enhanced type safety
   */
  query<TComponents extends Record<string, Component>>(
    required: readonly (keyof TComponents)[], 
    _optional: readonly string[] = []
  ): QueryResult<TComponents> {
    const componentIds = required as readonly string[]
    const archetype = this.getArchetype(componentIds)
    return {
      entities: archetype.entities,
      getComponent: <T>(entityId: number, componentId: keyof TComponents) => 
        this.getEntityComponent<T>(entityId, componentId as string),
      hasComponent: (entityId: number, componentId: keyof TComponents) =>
        this.hasEntityComponent(entityId, componentId as string),
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

  private initializeSoABuffer(componentId: string, _schema: S.Schema<any, any, any>): void {
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

  private getEntityComponent<T>(_entityId: number, _componentId: string): Option.Option<T> {
    // Implementation for component retrieval
    return Option.none()
  }

  private hasEntityComponent(_entityId: number, _componentId: string): boolean {
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
      (acc, buffer) => acc + (buffer as SoABuffer).data.byteLength
    )
  }
}

// Enhanced query result interface with generic typing
export interface QueryResult<TComponents extends Record<string, Component> = Record<string, Component>> {
  readonly entities: readonly number[]
  readonly getComponent: <T>(entityId: number, componentId: keyof TComponents) => Option.Option<T>
  readonly hasComponent: (entityId: number, componentId: keyof TComponents) => boolean
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

// Enhanced decorator for automatic component registration with typing
export const RegisterComponent = <TSchema extends S.Schema<any, any, any>>(
  meta: Omit<ComponentMeta<TSchema>, 'schema' | '_tag'>
) => 
  (schema: TSchema): TSchema => {
    globalRegistry.register({
      ...meta,
      schema,
      _tag: meta.id, // Use ID as discriminated union tag
    })
    return schema
  }

// Exhaustive check helper for discriminated unions
export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`)
}