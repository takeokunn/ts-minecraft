import * as ReadonlyArray from 'effect/Array'
import { pipe } from 'effect/Function'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'
import * as Order from 'effect/Order'
import * as ReadonlyRecord from 'effect/Record'
import { Archetype } from '@/domain/archetypes'
import { PlacedBlock } from '@/domain/block'
import { componentNames, ComponentName, Components } from '@/domain/components'
import { EntityId, toEntityId, fromEntityId } from '@/domain/entity'
import { Query } from '@/domain/query'

// --- Types ---

export type World = {
  readonly nextEntityId: EntityId
  readonly entities: HashSet.HashSet<EntityId>
  readonly components: {
    readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
  }
  readonly globalState: {
    readonly scene: 'Title' | 'InGame' | 'Paused'
    readonly seeds: {
      readonly world: number
      readonly biome: number
      readonly trees: number
    }
    readonly amplitude: number
    readonly editedBlocks: {
      readonly placed: ReadonlyRecord.ReadonlyRecord<string, PlacedBlock>
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

// --- World Creation ---

export const createWorld = (): World => {
  const components = Object.fromEntries(componentNames.map((name) => [name, HashMap.empty<EntityId, any>()])) as unknown as World['components']

  return {
    nextEntityId: toEntityId(0),
    entities: HashSet.empty<EntityId>(),
    components,
    globalState: {
      scene: 'Title',
      seeds: { world: 1, biome: 2, trees: 3 },
      amplitude: 20,
      editedBlocks: {
        placed: {},
        destroyed: HashSet.empty<string>(),
      },
      chunkLoading: {
        lastPlayerChunk: Option.none(),
        loadedChunks: HashMap.empty<string, EntityId>(),
      },
    },
  }
}

// --- Entity & Component Operations (Purely Functional) ---

export const addArchetype = (world: World, archetype: Archetype): readonly [World, EntityId] => {
  const entityId = world.nextEntityId

  const newEntities = HashSet.add(world.entities, entityId)

  const newComponents = pipe(
    Object.entries(archetype),
    ReadonlyArray.reduce(world.components, (acc: World['components'], [key, data]) => {
      const componentName = key as ComponentName
      if (data) {
        const map = acc[componentName]
        // This cast is safe because the key corresponds to the data type.
        const newMap = HashMap.set(map, entityId, data as any)
        return { ...acc, [componentName]: newMap }
      }
      return acc
    }),
  )

  return [
    {
      ...world,
      nextEntityId: toEntityId(fromEntityId(entityId) + 1),
      entities: newEntities,
      components: newComponents,
    },
    entityId,
  ] as const
}

export const removeEntity = (world: World, id: EntityId): World => {
  if (!HashSet.has(world.entities, id)) {
    return world
  }

  const newEntities = HashSet.remove(world.entities, id)

  const newComponents = pipe(
    componentNames,
    ReadonlyArray.reduce(world.components, (acc, name) => {
      if (HashMap.has(acc[name], id)) {
        const newMap = HashMap.remove(acc[name], id)
        return { ...acc, [name]: newMap }
      }
      return acc
    }),
  )

  return {
    ...world,
    entities: newEntities,
    components: newComponents,
  }
}

export const getComponent = <T extends ComponentName>(world: World, entityId: EntityId, componentName: T): Option.Option<Components[T]> => {
  // This cast is safe due to the structure of the components map.
  return HashMap.get(world.components[componentName], entityId) as Option.Option<Components[T]>
}

export const updateComponent = <T extends ComponentName>(world: World, entityId: EntityId, componentName: T, componentData: Components[T]): World => {
  if (!HashSet.has(world.entities, entityId)) {
    return world
  }

  const newComponentMap = HashMap.set(world.components[componentName], entityId, componentData)

  return {
    ...world,
    components: {
      ...world.components,
      [componentName]: newComponentMap,
    },
  }
}

// --- Querying ---

export type QueryResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entityId: EntityId
} & {
  readonly [K in T[number]]: Components[K]
}

export function query<T extends ReadonlyArray<ComponentName>>(world: World, queryDef: Query): ReadonlyArray<QueryResult<T>> {
  const { components: queryComponents } = queryDef

  if (queryComponents.length === 0) {
    return pipe(
      world.entities,
      HashSet.values,
      ReadonlyArray.fromIterable,
      ReadonlyArray.map((entityId) => ({ entityId }) as unknown as QueryResult<T>),
    )
  }

  const componentNameOrder = pipe(
    Order.string,
    Order.mapInput((name: ComponentName) => name),
  )
  const componentSizeOrder = pipe(
    Order.number,
    Order.mapInput((name: ComponentName) => HashMap.size(world.components[name])),
  )

  const sortedComponents = pipe(queryComponents, ReadonlyArray.sortBy(componentNameOrder, componentSizeOrder))

  const smallestMap = world.components[sortedComponents[0]!]
  const otherKeys = ReadonlyArray.tail(sortedComponents)

  const results: QueryResult<T>[] = []

  for (const [entityId] of smallestMap) {
    const hasAllComponents = pipe(
      otherKeys,
      Option.map((keys) => ReadonlyArray.every(keys, (key) => HashMap.has(world.components[key], entityId))),
      Option.getOrElse(() => true),
    )

    if (hasAllComponents) {
      const result = { entityId } as any
      let allComponentsFound = true
      for (const key of queryComponents) {
        const component = HashMap.get(world.components[key], entityId)
        if (Option.isSome(component)) {
          result[key] = component.value
        } else {
          allComponentsFound = false
          break
        }
      }
      if (allComponentsFound) {
        results.push(result)
      }
    }
  }

  return results
}
