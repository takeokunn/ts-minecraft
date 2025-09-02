import { Schema as S, Data, Effect, HashMap, HashSet, Layer, Option, Record, Ref, ParseResult } from 'effect'
import * as AST from 'effect/SchemaAST'
import { Archetype } from '@/domain/archetypes'
import { BlockType, PlacedBlock } from '@/domain/block'
import { ComponentName, Components, ComponentSchemas, componentNames, componentNamesSet, Position } from '@/domain/components'
import { EntityId, toEntityId } from '@/domain/entity'
import { Query } from '@/domain/query'
import { WorldContext } from '@/runtime/context'
import { CHUNK_SIZE } from './world-constants'

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
  nextEntityId: number
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
  return componentNamesSet.has(key)
}

// --- Core Functions ---

export const createInitialWorld = (): World => ({
  nextEntityId: 0,
  entities: HashMap.empty(),
  archetypes: HashMap.empty(),
  components: Object.fromEntries(
    componentNames.map((name) => [name, HashMap.empty()]),
  ) as ComponentStorage,
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
})

export const worldLayer = Layer.effect(WorldContext, Ref.make(createInitialWorld()).pipe(Effect.map((ref) => ({ world: ref }))))

export const addArchetype = (archetype: Archetype): Effect.Effect<EntityId, ParseResult.ParseError, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)

    const nextId = yield* $(Ref.get(world).pipe(Effect.map((w) => w.nextEntityId)))
    const entityId = yield* $(toEntityId(nextId))

    const componentNames = Object.keys(archetype).filter(isComponentName)
    const archetypeKey = getArchetypeKey(componentNames)

    yield* $(
      Ref.update(world, (w) => {
        const newArchetypes = HashMap.has(w.archetypes, archetypeKey)
          ? HashMap.modify(w.archetypes, archetypeKey, (set) => HashSet.add(set, entityId))
          : HashMap.set(w.archetypes, archetypeKey, HashSet.make(entityId))

        let newComponents = w.components
        for (const [componentName, componentData] of Object.entries(archetype)) {
          if (isComponentName(componentName) && componentData) {
            newComponents = {
              ...newComponents,
              [componentName]: HashMap.set(newComponents[componentName], entityId, componentData),
            }
          }
        }

        return {
          ...w,
          nextEntityId: w.nextEntityId + 1,
          entities: HashMap.set(w.entities, entityId, archetypeKey),
          archetypes: newArchetypes,
          components: newComponents,
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
        const newArchetypes = HashMap.modify(w.archetypes, archetypeKey, (set) => HashSet.remove(set, entityId))

        let newComponents = w.components
        const componentNamesToRemove = archetypeKey.split(',').filter(isComponentName)
        for (const componentName of componentNamesToRemove) {
          newComponents = {
            ...newComponents,
            [componentName]: HashMap.remove(newComponents[componentName], entityId),
          }
        }

        return {
          ...w,
          entities: HashMap.remove(w.entities, entityId),
          archetypes: newArchetypes,
          components: newComponents,
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
            componentsTuple.map((component, index) => [queryDef.components[index], component]),
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

          if (!S.isSchema(componentSchema) || !AST.isTypeLiteral(componentSchema.ast)) {
            return [componentName, components]
          }

          const propertySignatures = componentSchema.ast.propertySignatures
          const allKeys = propertySignatures.map((ps) => String(ps.name))

          if (allKeys.length > 0) {
            const soaStore: Record<string, unknown[]> = {}
            for (const key of allKeys) {
              soaStore[key] = []
            }

            for (const c of components) {
              for (const key of allKeys) {
                const value = Record.get(c as Record<string, unknown>, key)
                soaStore[key]?.push(Option.getOrUndefined(value))
              }
            }
            return [componentName, soaStore]
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
            ...w.globalState.editedBlocks,
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
            ...w.globalState.editedBlocks,
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

export const removeLoadedChunk = (chunkX: number, chunkZ: number): Effect.Effect<void, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    yield* $(
      Ref.update(world, (w) => ({
        ...w,
        globalState: {
          ...w.globalState,
          chunkLoading: {
            ...w.globalState.chunkLoading,
            loadedChunks: HashMap.remove(w.globalState.chunkLoading.loadedChunks, `${chunkX},${chunkZ}`),
          },
        },
      })),
    )
  })

export const getVoxel = (pos: {
  readonly x: number
  readonly y: number
  readonly z: number
}): Effect.Effect<BlockType, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))

    const chunkX = Math.floor(pos.x / CHUNK_SIZE)
    const chunkZ = Math.floor(pos.z / CHUNK_SIZE)

    const chunkEntityId = Option.fromNullable(
      worldState.globalState.chunkLoading.loadedChunks.get(`${chunkX},${chunkZ}`),
    )
    if (Option.isNone(chunkEntityId)) {
      return 'air'
    }

    const chunkOption = yield* $(
      getComponent(chunkEntityId.value, 'chunk'),
      Effect.map(Option.some),
      Effect.catchAll(() => Effect.succeed(Option.none())),
    )
    if (Option.isNone(chunkOption)) {
      return 'air'
    }

    const chunk = chunkOption.value
    const x = pos.x - chunkX * CHUNK_SIZE
    const y = pos.y
    const z = pos.z - chunkZ * CHUNK_SIZE

    return chunk.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] ?? 'air'
  })
