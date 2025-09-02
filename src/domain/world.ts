import { Schema as S, Data, Effect, HashMap, HashSet, Layer, Option, Record, Ref } from 'effect'
import * as AST from 'effect/SchemaAST'
import { Archetype } from '@/domain/archetypes'
import { BlockType, PlacedBlock } from '@/domain/block'
import { ComponentName, Components, ComponentSchemas, componentNames, Position } from '@/domain/components'
import { EntityId, toEntityId } from '@/domain/entity'
import { Query } from '@/domain/query'
import { WorldContext } from '@/runtime/context'

// --- Error Types ---

export class EntityNotFoundError extends Data.TaggedError('EntityNotFoundError')<{
  readonly entityId: EntityId
}> {}

export class ComponentNotFoundError extends Data.TaggedError('ComponentNotFoundError')<{
  readonly entityId: EntityId
  readonly componentName: ComponentName
}> {}

// --- Data Types ---

export type ComponentStorage = {
  readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
}

export type ArchetypeStorage = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

export type World = {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: ArchetypeStorage
  readonly components: ComponentStorage
  readonly globalState: {
    readonly scene: 'Title' | 'InGame' | 'Paused'
    readonly seeds: {
      readonly world: number
      readonly biome: number
      readonly trees: number
    }
    readonly amplitude: number
    readonly editedBlocks: {
      readonly placed: Record.ReadonlyRecord<
        string,
        {
          readonly position: { readonly x: number; readonly y: number; readonly z: number }
          readonly blockType: BlockType
        }
      >
      readonly destroyed: HashSet.HashSet<string>
    }
    readonly chunkLoading: {
      readonly lastPlayerChunk: Option.Option<{
        readonly x: number
        readonly z: number
      }>
      readonly loadedChunks: HashMap.HashMap<string, EntityId>
    }
  }
}

export type QueryResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entityId: EntityId
} & {
  readonly [K in T[number]]: Components[K]
}

type AllKeysFromUnion<T> = T extends unknown ? keyof T : never

export type ComponentSoA<C> = C extends object
  ? {
      readonly [P in AllKeysFromUnion<C>]: Array<Extract<C, { readonly [k in P]?: unknown }>[P] | undefined>
    }
  : Array<C | undefined>

export type QuerySoAResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entities: ReadonlyArray<EntityId>
} & {
  readonly [K in T[number]]: ComponentSoA<Components[K]>
}

// --- Helper Functions ---

const getArchetypeKey = (componentNames: ReadonlyArray<ComponentName>): string => {
  return [...componentNames].sort().join(',')
}

const getBlockKey = (position: { readonly x: number; readonly y: number; readonly z: number }) => {
  return `${position.x},${position.y},${position.z}`
}

const isComponentName = (key: string): key is ComponentName => {
  return (componentNames as ReadonlyArray<string>).includes(key)
}

// --- Core Functions ---

export const createInitialWorld = (): World => {
  const components = Object.fromEntries(
    componentNames.map((name) => [name, HashMap.empty()]),
  ) as unknown as ComponentStorage

  return {
    nextEntityId: 0,
    entities: HashMap.empty(),
    archetypes: HashMap.empty(),
    components,
    globalState: {
      scene: 'Title',
      seeds: { world: 1, biome: 2, trees: 3 },
      amplitude: 20,
      editedBlocks: {
        placed: Record.empty(),
        destroyed: HashSet.empty<string>(),
      },
      chunkLoading: {
        lastPlayerChunk: Option.none(),
        loadedChunks: HashMap.empty<string, EntityId>(),
      },
    },
  }
}

export const worldLayer = Layer.effect(WorldContext, Ref.make(createInitialWorld()).pipe(Effect.map((ref) => ({ world: ref }))))

export const addArchetype = (archetype: Archetype): Effect.Effect<EntityId, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const entityId = yield* $(Ref.modify(world, (w) => [toEntityId(w.nextEntityId), { ...w, nextEntityId: w.nextEntityId + 1 }]))

    const componentNames = Object.keys(archetype).filter(isComponentName)
    const archetypeKey = getArchetypeKey(componentNames)

    yield* $(
      Ref.update(world, (w) => {
        const newEntities = HashMap.set(w.entities, entityId, archetypeKey)

        const currentArchetype = Option.getOrElse(HashMap.get(w.archetypes, archetypeKey), () => HashSet.empty<EntityId>())
        const newArchetypes = HashMap.set(w.archetypes, archetypeKey, HashSet.add(currentArchetype, entityId))

        const components = componentNames.reduce(
          (acc, componentName) => {
            const componentData = archetype[componentName]
            if (componentData) {
              const storage = acc[componentName]
              // TODO: Find a type-safe way to update the component storage.
              const newStorage = HashMap.set(storage as any, entityId, componentData)
              return { ...acc, [componentName]: newStorage }
            }
            return acc
          },
          w.components,
        )

        return {
          ...w,
          entities: newEntities,
          archetypes: newArchetypes,
          components,
        }
      }),
    )

    return entityId
  })

export const removeEntity = (entityId: EntityId): Effect.Effect<void, EntityNotFoundError, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))

    const archetypeKey = yield* $(
      HashMap.get(worldState.entities, entityId),
      Effect.mapError(() => new EntityNotFoundError({ entityId })),
    )

    yield* $(
      Ref.update(world, (w) => {
        const newEntities = HashMap.remove(w.entities, entityId)

        const currentArchetype = Option.getOrElse(HashMap.get(w.archetypes, archetypeKey), () => HashSet.empty<EntityId>())
        const newArchetypes = HashMap.set(w.archetypes, archetypeKey, HashSet.remove(currentArchetype, entityId))

        const componentNamesToRemove = archetypeKey.split(',').filter(isComponentName)

        const components = componentNamesToRemove.reduce(
          (acc, componentName) => {
            const storage = acc[componentName]
            const newStorage = HashMap.remove(storage, entityId)
            return { ...acc, [componentName]: newStorage }
          },
          w.components,
        )

        return {
          ...w,
          entities: newEntities,
          archetypes: newArchetypes,
          components,
        }
      }),
    )
  })

export const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<Components[T], ComponentNotFoundError, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))
    return yield* $(
      HashMap.get(worldState.components[componentName], entityId),
      Effect.mapError(() => new ComponentNotFoundError({ entityId, componentName })),
    )
  })

export const getComponentOption = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<Option.Option<Components[T]>, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))
    return HashMap.get(worldState.components[componentName], entityId)
  })

export const updateComponent = <T extends ComponentName>(
  entityId: EntityId,
  componentName: T,
  componentData: Components[T],
): Effect.Effect<void, EntityNotFoundError, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)

    const worldState = yield* $(Ref.get(world))
    const entityExists = HashMap.has(worldState.entities, entityId)

    if (!entityExists) {
      return yield* $(Effect.fail(new EntityNotFoundError({ entityId })))
    }

    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        components: {
          ...w.components,
          [componentName]: HashMap.set(w.components[componentName], entityId, componentData),
        },
      })),
    )
  })

export const query = <T extends ReadonlyArray<ComponentName>>(queryDef: Query): Effect.Effect<ReadonlyArray<QueryResult<T>>, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))
    const requiredComponents = HashSet.fromIterable(queryDef.components)

    const matchingArchetypes = HashMap.filter(worldState.archetypes, (_entities, key) => {
      const archetypeComponents = HashSet.fromIterable(key.split(','))
      return HashSet.isSubset(requiredComponents, archetypeComponents)
    })

    const results: Array<QueryResult<T>> = []
    for (const [, entitySet] of matchingArchetypes) {
      for (const entityId of entitySet) {
        const componentsTupleOption = Option.all(
          queryDef.components.map((componentName) => HashMap.get(worldState.components[componentName], entityId)),
        )

        if (Option.isSome(componentsTupleOption)) {
          const componentsTuple = componentsTupleOption.value
          const components = Object.fromEntries(
            componentsTuple.map((component, i) => [queryDef.components[i]!, component]),
          ) as { [K in T[number]]: Components[K] }

          results.push({ entityId, ...components })
        }
      }
    }
    return results
  })

export const querySoA = <T extends ReadonlyArray<ComponentName>>(queryDef: Query): Effect.Effect<QuerySoAResult<T>, never, WorldContext> =>
  query(queryDef).pipe(
    Effect.map((queryResult) => {
      const entities = queryResult.map((r) => r.entityId)

      const componentSoAs = Object.fromEntries(
        queryDef.components.map((componentName) => {
          const componentSchema = ComponentSchemas[componentName]
          const components = queryResult.map((r) => r[componentName])

          if (!componentSchema || !('ast' in componentSchema)) {
            return [componentName, components]
          }

          const keysSchema = S.keyof(componentSchema as S.Schema<any>)
          if (AST.isUnion(keysSchema.ast)) {
            const allKeys = keysSchema.ast.types.flatMap((ast) => (AST.isLiteral(ast) ? [String(ast.literal)] : []))

            if (allKeys.length > 0) {
              const soaStore = Object.fromEntries(
                allKeys.map((key) => {
                  const values = components.map((c) => (c && typeof c === 'object' && key in c ? c[key as keyof typeof c] : undefined))
                  return [key, values]
                }),
              )
              return [componentName, soaStore]
            }
          }

          return [componentName, components]
        }),
      )

      return {
        entities,
        ...componentSoAs,
      } as QuerySoAResult<T>
    }),
  )

export const recordBlockDestruction = (position: Position): Effect.Effect<void, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const blockKey = getBlockKey(position)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          editedBlocks: {
            placed: Record.remove(w.globalState.editedBlocks.placed, blockKey),
            destroyed: HashSet.add(w.globalState.editedBlocks.destroyed, blockKey),
          },
        },
      })),
    )
  })

export const recordBlockPlacement = (block: PlacedBlock): Effect.Effect<void, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const blockKey = getBlockKey(block.position)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          editedBlocks: {
            placed: Record.set(w.globalState.editedBlocks.placed, blockKey, block),
            destroyed: HashSet.remove(w.globalState.editedBlocks.destroyed, blockKey),
          },
        },
      })),
    )
  })

export const updateLastPlayerChunk = (chunk: { readonly x: number; readonly z: number }): Effect.Effect<void, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          chunkLoading: {
            ...w.globalState.chunkLoading,
            lastPlayerChunk: Option.some(chunk),
          },
        },
      })),
    )
  })

export const getChunkLoadingState = (): Effect.Effect<World['globalState']['chunkLoading'], never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))
    return worldState.globalState.chunkLoading
  })

export const recordLoadedChunk = (chunkX: number, chunkZ: number, entityId: EntityId): Effect.Effect<void, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          chunkLoading: {
            ...w.globalState.chunkLoading,
            loadedChunks: HashMap.set(w.globalState.chunkLoading.loadedChunks, `${chunkX},${chunkZ}`, entityId),
          },
        },
      })),
    )
  })
