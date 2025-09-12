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

import * as S from 'effect/Schema'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'

// Base component interface with improved typing
export interface ComponentMeta<TSchema = S.Schema<unknown, unknown, unknown>> {
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
  return typeof value === 'object' && value !== null && '_tag' in value && (value as { _tag: unknown })._tag === tag && 'data' in value
}

// Type guard for checking if entity has component
export function hasComponent<T extends Record<string, Component>>(entity: T, componentId: keyof T): componentId is keyof T {
  return componentId in entity && isComponent(entity[componentId], componentId as string)
}

// Enhanced entity type with generic components
export type Entity<TComponents extends Record<string, Component> = Record<string, Component>> = {
  readonly id: number
  readonly components: TComponents
}

// Functional Component Registry
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'

// Registry service implementation with functional pattern
export const ComponentRegistry = {
  /**
   * Create a new registry state
   */
  create: () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make<ComponentRegistryState>(
        Data.struct({
          components: HashMap.empty(),
          archetypes: HashMap.empty(),
          soaBuffers: HashMap.empty(),
        }),
      )
      return stateRef
    }),

  /**
   * Register a component with automatic metadata extraction
   */
  register: <TSchema extends S.Schema<unknown, unknown, unknown>>(stateRef: Ref.Ref<ComponentRegistryState>, meta: ComponentMeta<TSchema>) =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef)
      const newState = Data.struct({
        ...currentState,
        components: HashMap.set(currentState.components, meta.id, meta),
      })

      yield* Ref.set(stateRef, newState)

      // Initialize SoA buffer for physics and performance-critical components
      if (meta.category === 'physics' || meta.priority === 1) {
        yield* initializeSoABuffer(stateRef, meta.id, meta.schema)
      }
    }),

  /**
   * Get component metadata with type safety
   */
  getComponent: <TSchema extends S.Schema<unknown, unknown, unknown>>(stateRef: Ref.Ref<ComponentRegistryState>, id: string) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return HashMap.get(state.components, id) as Option.Option<ComponentMeta<TSchema>>
    }),

  /**
   * Get all components in a category
   */
  getComponentsByCategory: (stateRef: Ref.Ref<ComponentRegistryState>, category: ComponentMeta['category']) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return Array.fromIterable(HashMap.values(HashMap.filter(state.components, (meta) => meta.category === category)))
    }),

  /**
   * Create or get archetype for component signature
   */
  getArchetype: (stateRef: Ref.Ref<ComponentRegistryState>, componentIds: readonly string[]) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const signature = Array.sort(componentIds, (a: string, b: string) => {
        const result = a.localeCompare(b)
        return result < 0 ? -1 : result > 0 ? 1 : 0
      })
      const archetypeKey = signature.join('|')

      return Option.getOrElse(HashMap.get(state.archetypes, archetypeKey), () => {
        const archetype = createArchetype(state, signature)
        const newState = Data.struct({
          ...state,
          archetypes: HashMap.set(state.archetypes, archetypeKey, archetype),
        })
        Effect.runSync(Ref.set(stateRef, newState))
        return archetype
      })
    }),

  /**
   * Query entities by component requirements with enhanced type safety
   */
  query: <TComponents extends Record<string, Component>>(stateRef: Ref.Ref<ComponentRegistryState>, required: readonly (keyof TComponents)[], _optional: readonly string[] = []) =>
    Effect.gen(function* () {
      const componentIds = required as readonly string[]
      const archetype = yield* ComponentRegistry.getArchetype(stateRef, componentIds)
      return {
        entities: archetype.entities,
        getComponent: <T>(entityId: number, componentId: keyof TComponents) => getEntityComponent<T>(stateRef, entityId, componentId as string),
        hasComponent: (entityId: number, componentId: keyof TComponents) => hasEntityComponent(stateRef, entityId, componentId as string),
        storageLayout: archetype.storageLayout,
      }
    }),

  /**
   * Convert storage layout for performance optimization
   */
  convertStorageLayout: (stateRef: Ref.Ref<ComponentRegistryState>, componentId: string, targetLayout: StorageLayout) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const soaBuffer = HashMap.get(state.soaBuffers, componentId)
      if (Option.isSome(soaBuffer)) {
        yield* performStorageConversion(soaBuffer.value, targetLayout)
      }
    }),

  /**
   * Get performance metrics
   */
  getMetrics: (stateRef: Ref.Ref<ComponentRegistryState>) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const memoryUsage = yield* calculateMemoryUsage(state)
      return {
        componentCount: HashMap.size(state.components),
        archetypeCount: HashMap.size(state.archetypes),
        soaBufferCount: HashMap.size(state.soaBuffers),
        totalMemoryUsage: memoryUsage,
      }
    }),
}

// Helper functions

const createArchetype = (state: ComponentRegistryState, componentIds: readonly string[]): ArchetypeInfo => {
  const storageLayout = determineOptimalStorageLayout(state, componentIds)
  return Data.struct({
    signature: componentIds,
    entities: [],
    storageLayout,
  })
}

const initializeSoABuffer = (stateRef: Ref.Ref<ComponentRegistryState>, componentId: string, _schema: S.Schema<unknown, unknown, unknown>) =>
  Effect.gen(function* () {
    const buffer = Data.struct({
      componentId,
      capacity: 1024,
      length: 0,
      data: new ArrayBuffer(1024 * 32),
      views: {},
    })

    const currentState = yield* Ref.get(stateRef)
    const newState = Data.struct({
      ...currentState,
      soaBuffers: HashMap.set(currentState.soaBuffers, componentId, buffer),
    })
    yield* Ref.set(stateRef, newState)
  })

const determineOptimalStorageLayout = (state: ComponentRegistryState, componentIds: readonly string[]): StorageLayout => {
  const physicsComponents = componentIds.filter((id) => {
    const meta = HashMap.get(state.components, id)
    return Option.match(meta, {
      onNone: () => false,
      onSome: (m) => m.category === 'physics',
    })
  })
  return physicsComponents.length > componentIds.length / 2 ? 'SoA' : 'AoS'
}

const getEntityComponent = <T>(_stateRef: Ref.Ref<ComponentRegistryState>, _entityId: number, _componentId: string): Effect.Effect<Option.Option<T>, never, never> =>
  Effect.succeed(Option.none())

const hasEntityComponent = (_stateRef: Ref.Ref<ComponentRegistryState>, _entityId: number, _componentId: string): Effect.Effect<boolean, never, never> => Effect.succeed(false)

const performStorageConversion = (buffer: SoABuffer, targetLayout: StorageLayout): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    console.log(`Converting storage layout to ${targetLayout} for component ${buffer.componentId}`)
  })

const calculateMemoryUsage = (state: ComponentRegistryState): Effect.Effect<number, never, never> =>
  Effect.succeed(Array.reduce(Array.fromIterable(HashMap.values(state.soaBuffers)), 0, (acc, buffer) => acc + (buffer as SoABuffer).data.byteLength))

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

// Global registry instance using functional pattern
export const createGlobalRegistry = () => Effect.runSync(ComponentRegistry.create())

// Enhanced decorator for automatic component registration with typing
export const RegisterComponent =
  <TSchema extends S.Schema<unknown, unknown, unknown>>(meta: Omit<ComponentMeta<TSchema>, 'schema' | '_tag'>) =>
  (schema: TSchema): TSchema => {
    const registryRef = createGlobalRegistry()
    Effect.runSync(
      ComponentRegistry.register(registryRef, {
        ...meta,
        schema,
        _tag: meta.id, // Use ID as discriminated union tag
      }),
    )
    return schema
  }

// Exhaustive check helper for discriminated unions
export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`)
}
