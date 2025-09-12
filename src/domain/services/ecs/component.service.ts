/**
 * Component Management System (Effect-TS Implementation)
 * Handles component registration, validation, and lifecycle management
 */

import { Effect, Context, Layer, HashMap, HashSet, ReadonlyArray, Option, pipe, Ref, Duration } from 'effect'
import * as S from '@effect/schema/Schema'
import { EntityId, ComponentName, ComponentData } from '@domain/services/ecs/archetype-query.service'

// ============================================================================
// Schema Definitions
// ============================================================================

export const ComponentMetadata = S.Struct({
  name: ComponentName,
  schema: S.optional(S.Schema<unknown, unknown, unknown>), // Schema for validation
  tags: S.Array(S.String),
  version: S.Number,
  dependencies: S.optional(S.Array(ComponentName)),
})
export type ComponentMetadata = S.Schema.Type<typeof ComponentMetadata>

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
  factory: S.optional(S.Function), // Factory function
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

export interface ComponentService {
  readonly register: (metadata: ComponentMetadata) => Effect.Effect<void, ComponentError>

  readonly unregister: (name: ComponentName) => Effect.Effect<void>

  readonly get: (name: ComponentName) => Effect.Effect<ComponentMetadata, ComponentError>

  readonly list: () => Effect.Effect<ReadonlyArray<ComponentMetadata>>

  readonly listByTag: (tag: string) => Effect.Effect<ReadonlyArray<ComponentMetadata>>

  readonly validate: (name: ComponentName, data: unknown) => Effect.Effect<ComponentData, ComponentValidationError>

  readonly createDefault: (name: ComponentName) => Effect.Effect<ComponentData, ComponentError>

  readonly clone: (name: ComponentName, data: ComponentData) => Effect.Effect<ComponentData>

  readonly getDependencies: (name: ComponentName) => Effect.Effect<ReadonlyArray<ComponentName>>

  readonly getStats: () => Effect.Effect<{
    totalComponents: number
    componentsByTag: Record<string, number>
    validationStats: {
      totalValidations: number
      failures: number
    }
  }>
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

    // Get component metadata
    const get = (name: ComponentName) =>
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

    // Validate component data using @effect/schema
    const validate = (name: ComponentName, data: unknown) =>
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
          
          return parseResult as ComponentData
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

        return validationResult as ComponentData
      })

    // Create default component data
    const createDefault = (name: ComponentName) =>
      Effect.gen(function* () {
        const metadata = yield* get(name)

        // Create default based on schema or return empty object
        if (!metadata.schema) {
          const emptyObject: ComponentData = {}
          return emptyObject
        }

        // Use schema to generate default value if possible, otherwise empty object
        const emptyDefault: ComponentData = {}
        return emptyDefault
      })

    // Clone component data
    const clone = (name: ComponentName, data: ComponentData) =>
      Effect.gen(function* () {
        // Validate the component exists
        yield* get(name)

        // Deep clone the data - JSON parse/stringify preserves ComponentData structure
        const clonedData: ComponentData = JSON.parse(JSON.stringify(data))
        return clonedData
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
        yield* Ref.update(pools, (map) =>
          HashMap.set(map, componentName, {
            factory: factory as () => ComponentData,
            reset: reset as (item: ComponentData) => void,
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

              if (p.available.length > 0) {
                const popped = p.available.pop()
                // Safe assertion: we just checked p.available.length > 0
                item = popped as NonNullable<typeof popped>
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
              return item as T
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

export const componentBuilder = (name: ComponentName) => ({
  withSchema: <T>(schema: S.Schema<T, T, never>) => ({
    withTags: (...tags: string[]) => ({
      withDependencies: (...dependencies: ComponentName[]) => ({
        version: (version: number) => ({
          build: (): ComponentMetadata => ({
            name,
            schema: schema as S.Schema<unknown, unknown, unknown>,
            tags,
            version,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
          }),
        }),
      }),

      version: (version: number) => ({
        build: (): ComponentMetadata => ({
          name,
          schema: schema as S.Schema<unknown, unknown, unknown>,
          tags,
          version,
          dependencies: undefined,
        }),
      }),
    }),
  }),

  withTags: (...tags: string[]) => ({
    version: (version: number) => ({
      build: (): ComponentMetadata => ({
        name,
        schema: undefined,
        tags,
        version,
        dependencies: undefined,
      }),
    }),
  }),
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
