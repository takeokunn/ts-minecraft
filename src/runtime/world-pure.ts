import { Data, Effect, HashMap, HashSet, Layer, Option, Record, Ref } from 'effect'
import * as AST from 'effect/SchemaAST'
import { Archetype } from '@/domain/archetypes'
import { BlockType } from '@/domain/block'
import { ComponentName, Components, ComponentSchemas, componentNamesSet } from '@/domain/components'
import { EntityId, toEntityId } from '@/domain/entity'
import { Query } from '@/domain/query'
import { WorldContext } from './context'

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

type AllKeysFromUnion<T> = T extends any ? keyof T : never

export type ComponentSoA<C> = C extends object
  ? {
      readonly [P in AllKeysFromUnion<C>]: Array<Extract<C, { [k in P]?: any }>[P] | undefined>
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

// --- Core Functions ---

export const createInitialWorld = (): World => ({
  nextEntityId: 0,
  entities: HashMap.empty(),
  archetypes: HashMap.empty(),
  components: {
    position: HashMap.empty(),
    velocity: HashMap.empty(),
    player: HashMap.empty(),
    inputState: HashMap.empty(),
    cameraState: HashMap.empty(),
    hotbar: HashMap.empty(),
    target: HashMap.empty(),
    gravity: HashMap.empty(),
    collider: HashMap.empty(),
    renderable: HashMap.empty(),
    instancedMeshRenderable: HashMap.empty(),
    terrainBlock: HashMap.empty(),
    chunk: HashMap.empty(),
    camera: HashMap.empty(),
    targetBlock: HashMap.empty(),
    chunkLoaderState: HashMap.empty(),
  },
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

export const worldLayer = Layer.effect(
  WorldContext,
  Ref.make(createInitialWorld()).pipe(Effect.map((ref) => ({ world: ref }))),
)

export const addArchetype = (archetype: Archetype): Effect.Effect<EntityId, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const entityId = yield* $(
      Ref.modify(world, (w) => [toEntityId(w.nextEntityId), { ...w, nextEntityId: w.nextEntityId + 1 }]),
    )

    const isValidComponentName = (key: string): key is ComponentName => {
      return componentNamesSet.has(key)
    }
    const componentNames = Object.keys(archetype).filter(isValidComponentName)
    const archetypeKey = getArchetypeKey(componentNames)

    yield* $(
      Ref.update(world, (w) => {
        const newEntities = HashMap.set(w.entities, entityId, archetypeKey)

        const currentArchetype = Option.getOrElse(HashMap.get(w.archetypes, archetypeKey), () => HashSet.empty<EntityId>())
        const newArchetypes = HashMap.set(w.archetypes, archetypeKey, HashSet.add(currentArchetype, entityId))

        let newComponents = w.components
        for (const componentName of componentNames) {
          const componentData = archetype[componentName]
          if (componentData) {
            const storage = newComponents[componentName]
            const newStorage = HashMap.set(storage, entityId, componentData)
            newComponents = { ...newComponents, [componentName]: newStorage }
          }
        }

        return {
          ...w,
          entities: newEntities,
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
        const newEntities = HashMap.remove(w.entities, entityId)

        const currentArchetype = Option.getOrElse(HashMap.get(w.archetypes, archetypeKey), () => HashSet.empty<EntityId>())
        const newArchetypes = HashMap.set(w.archetypes, archetypeKey, HashSet.remove(currentArchetype, entityId))

        let newComponents = w.components
        const isValidComponentName = (key: string): key is ComponentName => componentNamesSet.has(key)
        const componentNamesToRemove = archetypeKey.split(',').filter(isValidComponentName)

        for (const componentName of componentNamesToRemove) {
          const storage = newComponents[componentName]
          const newStorage = HashMap.remove(storage, entityId)
          newComponents = { ...newComponents, [componentName]: newStorage }
        }

        return {
          ...w,
          entities: newEntities,
          archetypes: newArchetypes,
          components: newComponents,
        }
      }),
    )
  })

export const getComponent = <T extends ComponentName>(
  entityId: EntityId,
  componentName: T,
): Effect.Effect<Components[T], ComponentNotFoundError, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))
    return yield* $(
      HashMap.get(worldState.components[componentName], entityId),
      Effect.mapError(() => new ComponentNotFoundError({ entityId, componentName })),
    )
  })

export const getComponentOption = <T extends ComponentName>(
  entityId: EntityId,
  componentName: T,
): Effect.Effect<Option.Option<Components[T]>, never, WorldContext> =>
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

    yield* $(
      Ref.get(world),
      Effect.flatMap((w) => HashMap.has(w.entities, entityId)),
      Effect.filterOrFail(
        (exists) => exists,
        () => new EntityNotFoundError({ entityId }),
      ),
    )

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

export const query = <T extends ReadonlyArray<ComponentName>>(
  queryDef: Query,
): Effect.Effect<ReadonlyArray<QueryResult<T>>, never, WorldContext> =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const worldState = yield* $(Ref.get(world))
    const requiredComponents = HashSet.fromIterable(queryDef.components)

    const matchingArchetypes = HashMap.filter(worldState.archetypes, (_entities, key) => {
      const archetypeComponents = HashSet.fromIterable(key.split(','))
      return HashSet.isSubset(requiredComponents, archetypeComponents)
    })

    return yield* $(
      HashMap.values(matchingArchetypes),
      Effect.reduce(
        [] as QueryResult<T>[],
        (acc, entitySet) =>
          Effect.reduce(entitySet, acc, (innerAcc, entityId) => {
            const componentsRecord = queryDef.components.reduce(
              (record, componentName) => {
                record[componentName] = HashMap.get(worldState.components[componentName], entityId)
                return record
              },
              {} as Record<T[number], Option.Option<Components[T[number]]>>,
            )

            return Option.all(componentsRecord).pipe(
              Option.map((components) => [...innerAcc, { entityId, ...components } as QueryResult<T>]),
              Option.getOrElse(() => innerAcc),
              Effect.succeed,
            )
          }),
      ),
    )
  })

export const querySoA = <T extends ReadonlyArray<ComponentName>>(
  queryDef: Query,
): Effect.Effect<QuerySoAResult<T>, never, WorldContext> =>
  query(queryDef).pipe(
    Effect.map((queryResult) => {
      const entities = queryResult.map((r) => r.entityId)

      const result: {
        entities: ReadonlyArray<EntityId>
        [key: string]: unknown
      } = { entities }

      for (const componentName of queryDef.components) {
        const componentSchema = ComponentSchemas[componentName]
        let ast = componentSchema?.ast

        // Handle S.Class, etc., to get to the core definition
        while (ast && AST.isTransformation(ast)) {
          ast = ast.from
        }

        const components = queryResult.map((r) => r[componentName])

        const getKeysFromAst = (node: AST.AST): Set<string> => {
          const keys = new Set<string>()
          let current = node
          while (current && AST.isTransformation(current)) {
            current = current.from
          }
          if (AST.isTypeLiteral(current)) {
            current.propertySignatures.forEach((ps) => keys.add(String(ps.name)))
          } else if (AST.isUnion(current)) {
            current.types.forEach((t) => getKeysFromAst(t).forEach((k) => keys.add(k)))
          }
          return keys
        }

        if (ast) {
          const allKeys = getKeysFromAst(ast)
          if (allKeys.size > 0) {
            const soaStore: { [key: string]: unknown[] } = {}
            for (const key of allKeys) {
              soaStore[key] = components.map((c) =>
                c && typeof c === 'object' && key in c ? (c as Record<string, unknown>)[key] : undefined,
              )
            }
            result[componentName] = soaStore
          } else {
            // Handle non-structured components (e.g., primitives)
            result[componentName] = components
          }
        } else {
          // Fallback for empty results or schemas without AST
          result[componentName] = components
        }
      }

      return result as QuerySoAResult<T>
    }),
  )