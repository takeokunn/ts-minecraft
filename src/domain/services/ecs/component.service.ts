/**
 * Component Management System (Effect-TS Implementation)
 * Handles component registration, validation, and lifecycle management
 */

import { Effect, Context, Layer, HashMap, HashSet, ReadonlyArray, Option, pipe, Ref, Duration } from 'effect'
import * as S from '@effect/schema/Schema'
import { EntityId, ComponentName, ComponentData } from '@domain/services/ecs/archetype-query.service'
import { ComponentOfName } from '@domain/entities/components/component-schemas'

// ============================================================================
// Schema Definitions
// ============================================================================

// Enhanced component metadata with better type safety
export const ComponentMetadata = <T = unknown>() => S.Struct({
  name: ComponentName,
  schema: S.optional(S.Schema<T, T, never>), // Type-safe schema
  tags: S.Array(S.String),
  version: S.Number,
  dependencies: S.optional(S.Array(ComponentName)),
})

export type ComponentMetadata<T = unknown> = {
  readonly name: ComponentName
  readonly schema?: S.Schema<T, T, never>
  readonly tags: ReadonlyArray<string>
  readonly version: number
  readonly dependencies?: ReadonlyArray<ComponentName>
}

export const ComponentRegistry = S.Struct({
  components: S.Record(ComponentName, ComponentMetadata),
  componentsByTag: S.Record(S.String, S.Array(ComponentName)),
})
export type ComponentRegistry = S.Schema.Type<typeof ComponentRegistry>

export const ComponentPool = S.Struct({
  componentType: ComponentName,
  available: S.Array(ComponentData),
  inUse: S.Array(ComponentData),
  maxSize: S.Number,
  factory: S.optional(S.Unknown), // Factory function as unknown for type safety
})
export type ComponentPool = S.Schema.Type<typeof ComponentPool>

// ============================================================================
// Error Definitions
// ============================================================================

export const ComponentError = S.TaggedError<ComponentError>()('ComponentError', {
  message: S.String,
  componentName: S.optional(ComponentName),
})
export interface ComponentError extends S.Schema.Type<typeof ComponentError> {}

export const ComponentValidationError = S.TaggedError<ComponentValidationError>()('ComponentValidationError', {
  message: S.String,
  componentName: ComponentName,
  validationErrors: S.Array(S.String),
})
export interface ComponentValidationError extends S.Schema.Type<typeof ComponentValidationError> {}

// ============================================================================
// Component Service
// ============================================================================

// Enhanced component service with better type safety
export interface ComponentService {
  // Generic registration for type-safe components
  readonly register: <T>(metadata: ComponentMetadata<T>) => Effect.Effect<void, ComponentError>

  readonly unregister: (name: ComponentName) => Effect.Effect<void>

  // Type-safe component retrieval with proper typing
  readonly get: <T extends ComponentName>(name: T) => Effect.Effect<ComponentMetadata<ComponentOfName<T>>, ComponentError>

  readonly list: () => Effect.Effect<ReadonlyArray<ComponentMetadata<unknown>>>

  readonly listByTag: (tag: string) => Effect.Effect<ReadonlyArray<ComponentMetadata<unknown>>>

  // Type-safe validation with component-specific return types
  readonly validate: <T extends ComponentName>(name: T, data: unknown) => Effect.Effect<ComponentOfName<T>, ComponentValidationError>

  readonly createDefault: <T extends ComponentName>(name: T) => Effect.Effect<ComponentOfName<T>, ComponentError>

  readonly clone: <T>(name: ComponentName, data: T) => Effect.Effect<T>

  readonly getDependencies: (name: ComponentName) => Effect.Effect<ReadonlyArray<ComponentName>>

  readonly getStats: () => Effect.Effect<{
    readonly totalComponents: number
    readonly componentsByTag: Readonly<Record<string, number>>
    readonly validationStats: {
      readonly totalValidations: number
      readonly failures: number
    }
  }>

  // New type-safe methods for enhanced ECS operations
  readonly registerTypedComponent: <T>(
    name: ComponentName, 
    schema: S.Schema<T, T, never>, 
    options?: {
      readonly tags?: ReadonlyArray<string>
      readonly version?: number
      readonly dependencies?: ReadonlyArray<ComponentName>
    }
  ) => Effect.Effect<void, ComponentError>

  readonly validateTyped: <T>(
    name: ComponentName, 
    data: unknown, 
    schema: S.Schema<T, T, never>
  ) => Effect.Effect<T, ComponentValidationError>
}

export const ComponentService = Context.GenericTag<ComponentService>('ComponentService')

// ============================================================================
// Component Service Implementation
// ============================================================================

export const ComponentServiceLive = Layer.effect(
  ComponentService,
  Effect.gen(function* () {
    // State
    const registry = yield* Ref.make(HashMap.empty<ComponentName, ComponentMetadata>())
    const tagIndex = yield* Ref.make(HashMap.empty<string, HashSet.HashSet<ComponentName>>())
    const validationStats = yield* Ref.make({ totalValidations: 0, failures: 0 })

    // Register component
    const register = (metadata: ComponentMetadata) =>
      Effect.gen(function* () {
        // Check for existing component
        const existing = yield* Ref.get(registry)
        if (HashMap.has(existing, metadata.name)) {
          return yield* Effect.fail(
            new ComponentError({
              message: `Component ${metadata.name} already registered`,
              componentName: metadata.name,
            }),
          )
        }

        // Validate dependencies exist
        if (metadata.dependencies) {
          for (const dep of metadata.dependencies) {
            if (!HashMap.has(existing, dep)) {
              return yield* Effect.fail(
                new ComponentError({
                  message: `Dependency ${dep} not found for component ${metadata.name}`,
                  componentName: metadata.name,
                }),
              )
            }
          }
        }

        // Add to registry
        yield* Ref.update(registry, (map) => HashMap.set(map, metadata.name, metadata))

        // Update tag index
        for (const tag of metadata.tags) {
          yield* Ref.update(tagIndex, (index) => HashMap.modify(index, tag, (set) => Option.getOrElse(set, () => HashSet.empty<ComponentName>()).pipe(HashSet.add(metadata.name))))
        }
      })

    // Unregister component
    const unregister = (name: ComponentName) =>
      Effect.gen(function* () {
        const reg = yield* Ref.get(registry)
        const metadata = HashMap.get(reg, name)

        yield* Option.match(metadata, {
          onNone: () => Effect.void,
          onSome: (meta) =>
            Effect.gen(function* () {
              // Remove from registry
              yield* Ref.update(registry, (map) => HashMap.remove(map, name))

              // Remove from tag index
              for (const tag of meta.tags) {
                yield* Ref.update(tagIndex, (index) => HashMap.modify(index, tag, (set) => Option.map(set, (s) => HashSet.remove(s, name))))
              }
            }),
        })
      })

    // Get component metadata with type safety
    const get = <T extends ComponentName>(name: T) =>
      Effect.gen(function* () {
        const reg = yield* Ref.get(registry)
        const metadata = HashMap.get(reg, name)

        return yield* Option.match(metadata, {
          onNone: () =>
            Effect.fail(
              new ComponentError({
                message: `Component ${name} not found`,
                componentName: name,
              }),
            ),
          onSome: (meta) => Effect.succeed(meta),
        })
      })

    // List all components
    const list = () =>
      Effect.gen(function* () {
        const reg = yield* Ref.get(registry)
        return pipe(HashMap.values(reg), ReadonlyArray.fromIterable)
      })

    // List components by tag
    const listByTag = (tag: string) =>
      Effect.gen(function* () {
        const index = yield* Ref.get(tagIndex)
        const componentNames = HashMap.get(index, tag)

        return yield* Option.match(componentNames, {
          onNone: () => Effect.succeed([] as ReadonlyArray<ComponentMetadata>),
          onSome: (names) =>
            Effect.gen(function* () {
              const reg = yield* Ref.get(registry)
              const components: ComponentMetadata[] = []

              for (const name of names) {
                const meta = HashMap.get(reg, name)
                if (Option.isSome(meta)) {
                  components.push(meta.value)
                }
              }

              return components
            }),
        })
      })

    // Validate component data using @effect/schema with type safety
    const validate = <T extends ComponentName>(name: T, data: unknown) =>
      Effect.gen(function* () {
        yield* Ref.update(validationStats, (stats) => ({
          ...stats,
          totalValidations: stats.totalValidations + 1,
        }))

        const metadata = yield* get(name)

        // If no schema, use basic unknown validation
        if (!metadata.schema) {
          const basicSchema = S.Union(
            S.Record(S.String, S.Union(S.String, S.Number, S.Boolean, S.Null)), 
            S.String, 
            S.Number, 
            S.Boolean, 
            S.Null
          )
          
          const parseResult = yield* S.decodeUnknown(basicSchema)(data).pipe(
            Effect.catchAll((parseError) =>
              Effect.gen(function* () {
                yield* Ref.update(validationStats, (stats) => ({
                  ...stats,
                  failures: stats.failures + 1,
                }))
                return yield* Effect.fail(
                  new ComponentValidationError({
                    message: `Basic validation failed for component ${name}`,
                    componentName: name,
                    validationErrors: [S.formatError(parseError)],
                  })
                )
              })
            )
          )
          
          return parseResult
        }

        // Validate against component's schema - safe because we checked metadata.schema exists above
        const validationResult = yield* S.decodeUnknown(metadata.schema)(data).pipe(
          Effect.catchAll((parseError) =>
            Effect.gen(function* () {
              yield* Ref.update(validationStats, (stats) => ({
                ...stats,
                failures: stats.failures + 1,
              }))
              return yield* Effect.fail(
                new ComponentValidationError({
                  message: `Schema validation failed for component ${name}`,
                  componentName: name,
                  validationErrors: [S.formatError(parseError)],
                })
              )
            })
          )
        )

        return validationResult
      })

    // Create default component data with type safety
    const createDefault = <T extends ComponentName>(name: T) =>
      Effect.gen(function* () {
        const metadata = yield* get(name)

        // Create default based on schema or return empty object
        if (!metadata.schema) {
          // Return a typed empty object based on component name
          return {} as ComponentOfName<T>
        }

        // Use schema to generate default value if possible, otherwise empty object
        // For now, return empty object but typed correctly
        return {} as ComponentOfName<T>
      })

    // Clone component data
    const clone = <T extends ComponentData>(name: ComponentName, data: T) =>
      Effect.gen(function* () {
        // Validate the component exists
        yield* get(name)

        // Deep clone the data using structured cloning for better type safety
        return structuredClone(data)
      })

    // Get component dependencies
    const getDependencies = (name: ComponentName) =>
      Effect.gen(function* () {
        const metadata = yield* get(name)
        return metadata.dependencies || []
      })

    // Get statistics
    const getStats = () =>
      Effect.gen(function* () {
        const reg = yield* Ref.get(registry)
        const index = yield* Ref.get(tagIndex)
        const valStats = yield* Ref.get(validationStats)

        const componentsByTag: Record<string, number> = {}
        for (const [tag, names] of HashMap.entries(index)) {
          componentsByTag[tag] = HashSet.size(names)
        }

        return {
          totalComponents: HashMap.size(reg),
          componentsByTag,
          validationStats: valStats,
        }
      })

    // Typed component registration
    const registerTypedComponent = <T>(
      name: ComponentName, 
      schema: S.Schema<T, T, never>, 
      options?: {
        readonly tags?: ReadonlyArray<string>
        readonly version?: number
        readonly dependencies?: ReadonlyArray<ComponentName>
      }
    ) => register({
      name,
      schema,
      tags: options?.tags || [],
      version: options?.version || 1,
      dependencies: options?.dependencies,
    })

    // Typed validation
    const validateTyped = <T>(
      name: ComponentName, 
      data: unknown, 
      schema: S.Schema<T, T, never>
    ) => 
      Effect.gen(function* () {
        yield* Ref.update(validationStats, (stats) => ({
          ...stats,
          totalValidations: stats.totalValidations + 1,
        }))

        const validationResult = yield* S.decodeUnknown(schema)(data).pipe(
          Effect.catchAll((parseError) =>
            Effect.gen(function* () {
              yield* Ref.update(validationStats, (stats) => ({
                ...stats,
                failures: stats.failures + 1,
              }))
              return yield* Effect.fail(
                new ComponentValidationError({
                  message: `Typed validation failed for component ${name}`,
                  componentName: name,
                  validationErrors: [S.formatError(parseError)],
                })
              )
            })
          )
        )

        return validationResult
      })

    return {
      register,
      unregister,
      get,
      list,
      listByTag,
      validate,
      createDefault,
      clone,
      getDependencies,
      getStats,
      registerTypedComponent,
      validateTyped,
    }
  }),
)

// ============================================================================
// Component Pool Service (Object Pooling)
// ============================================================================

export interface ComponentPoolService {
  readonly createPool: <T extends ComponentData>(componentName: ComponentName, factory: () => T, reset: (item: T) => void, maxSize: number) => Effect.Effect<void>

  readonly acquire: <T extends ComponentData>(componentName: ComponentName) => Effect.Effect<T, ComponentError>

  readonly release: <T extends ComponentData>(componentName: ComponentName, item: T) => Effect.Effect<void>

  readonly getPoolStats: (componentName: ComponentName) => Effect.Effect<{
    available: number
    inUse: number
    maxSize: number
  }>

  readonly clearPool: (componentName: ComponentName) => Effect.Effect<void>
}

export const ComponentPoolService = Context.GenericTag<ComponentPoolService>('ComponentPoolService')

export const ComponentPoolServiceLive = Layer.effect(
  ComponentPoolService,
  Effect.gen(function* () {
    const pools = yield* Ref.make(
      HashMap.empty<
        ComponentName,
        {
          factory: () => ComponentData
          reset: (item: ComponentData) => void
          available: ComponentData[]
          inUse: Set<ComponentData>
          maxSize: number
        }
      >(),
    )

    const createPool = <T extends ComponentData>(componentName: ComponentName, factory: () => T, reset: (item: T) => void, maxSize: number) =>
      Effect.gen(function* () {
        const createTypedFactory = (): ComponentData => factory()
        const createTypedReset = (item: ComponentData): void => {
          // Type guard to ensure safe casting
          const isValidComponentData = (data: ComponentData): data is T => {
            return typeof data === 'object' && data !== null
          }
          
          if (isValidComponentData(item)) {
            reset(item)
          }
        }

        yield* Ref.update(pools, (map) =>
          HashMap.set(map, componentName, {
            factory: createTypedFactory,
            reset: createTypedReset,
            available: [],
            inUse: new Set(),
            maxSize,
          }),
        )
      })

    const acquire = <T extends ComponentData>(componentName: ComponentName) =>
      Effect.gen(function* () {
        const poolMap = yield* Ref.get(pools)
        const pool = HashMap.get(poolMap, componentName)

        return yield* Option.match(pool, {
          onNone: () =>
            Effect.fail(
              new ComponentError({
                message: `Pool for component ${componentName} not found`,
                componentName,
              }),
            ),
          onSome: (p) =>
            Effect.gen(function* () {
              let item: ComponentData

              const poppedOption = Option.fromNullable(p.available.pop())
              if (Option.isSome(poppedOption)) {
                item = poppedOption.value
              } else if (p.inUse.size < p.maxSize) {
                item = p.factory()
              } else {
                return yield* Effect.fail(
                  new ComponentError({
                    message: `Pool for component ${componentName} exhausted`,
                    componentName,
                  }),
                )
              }

              p.inUse.add(item)
              return item
            }),
        })
      })

    const release = <T extends ComponentData>(componentName: ComponentName, item: T) =>
      Effect.gen(function* () {
        const poolMap = yield* Ref.get(pools)
        const pool = HashMap.get(poolMap, componentName)

        yield* Option.match(pool, {
          onNone: () => Effect.void,
          onSome: (p) =>
            Effect.sync(() => {
              if (p.inUse.has(item)) {
                p.inUse.delete(item)
                p.reset(item)
                p.available.push(item)
              }
            }),
        })
      })

    const getPoolStats = (componentName: ComponentName) =>
      Effect.gen(function* () {
        const poolMap = yield* Ref.get(pools)
        const pool = HashMap.get(poolMap, componentName)

        return yield* Option.match(pool, {
          onNone: () =>
            Effect.succeed({
              available: 0,
              inUse: 0,
              maxSize: 0,
            }),
          onSome: (p) =>
            Effect.succeed({
              available: p.available.length,
              inUse: p.inUse.size,
              maxSize: p.maxSize,
            }),
        })
      })

    const clearPool = (componentName: ComponentName) =>
      Effect.gen(function* () {
        yield* Ref.update(pools, (map) => HashMap.remove(map, componentName))
      })

    return {
      createPool,
      acquire,
      release,
      getPoolStats,
      clearPool,
    }
  }),
)

// ============================================================================
// Component Builder Pattern
// ============================================================================

// Enhanced type-safe component builder
export const componentBuilder = <T = unknown>(name: ComponentName) => ({
  withSchema: <U>(schema: S.Schema<U, U, never>) => ({
    withTags: (...tags: string[]) => ({
      withDependencies: (...dependencies: ComponentName[]) => ({
        version: (version: number) => ({
          build: (): ComponentMetadata<U> => ({
            name,
            schema,
            tags,
            version,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
          }),
        }),
      }),

      version: (version: number) => ({
        build: (): ComponentMetadata<U> => ({
          name,
          schema,
          tags,
          version,
          dependencies: undefined,
        }),
      }),
    }),
  }),

  withTags: (...tags: string[]) => ({
    version: (version: number) => ({
      build: (): ComponentMetadata<T> => ({
        name,
        schema: undefined,
        tags,
        version,
        dependencies: undefined,
      }),
    }),
  }),
})

// Type-safe helper for creating strongly typed components
export const createTypedComponent = <T>(
  name: ComponentName,
  schema: S.Schema<T, T, never>,
  options?: {
    readonly tags?: ReadonlyArray<string>
    readonly version?: number
    readonly dependencies?: ReadonlyArray<ComponentName>
  }
): ComponentMetadata<T> => ({
  name,
  schema,
  tags: options?.tags || [],
  version: options?.version || 1,
  dependencies: options?.dependencies,
})

// ============================================================================
// Batch Component Operations
// ============================================================================

export const batchRegister = (components: ReadonlyArray<ComponentMetadata>) =>
  Effect.gen(function* () {
    const service = yield* ComponentService
    const results = yield* Effect.forEach(components, (comp) => service.register(comp), { concurrency: 'unbounded' })
    return results
  })

export const validateComponents = (components: ReadonlyArray<{ name: ComponentName; data: unknown }>) =>
  Effect.gen(function* () {
    const service = yield* ComponentService
    const results = yield* Effect.forEach(components, ({ name, data }) => service.validate(name, data), { concurrency: 'unbounded' })
    return results
  })

// ============================================================================
// Component System Layer
// ============================================================================

export const ComponentSystemLive = Layer.merge(ComponentServiceLive, ComponentPoolServiceLive)
