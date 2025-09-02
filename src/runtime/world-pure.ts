import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'
import * as ReadonlyRecord from 'effect/Record'
import * as S from 'effect/Schema'
import * as AST from 'effect/SchemaAST'
import { BlockType } from '@/domain/block'
import { Archetype } from '@/domain/archetypes'
import { ComponentName, Components, ComponentSchemas } from '@/domain/components'
import { EntityId, toEntityId } from '@/domain/entity'
import { Query } from '@/domain/query'

// --- Data Types ---

export type ComponentStorage = {
  [K in ComponentName]: Map<EntityId, Components[K]>
}

export type ArchetypeStorage = Map<string, Set<EntityId>>

export type World = {
  readonly nextEntityId: number
  readonly entities: Map<EntityId, string> // Map<EntityId, ArchetypeKey>
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
      readonly placed: ReadonlyRecord.ReadonlyRecord<
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

type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

export type QuerySoAResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entities: ReadonlyArray<EntityId>
} & {
  readonly [K in T[number]]: Components[K] extends object
    ? {
        [P in keyof Components[K]]: Mutable<Array<Components[K][P]>>
      }
    : Array<Components[K]>
}

// --- Helper Functions ---

const getArchetypeKey = (componentNames: ReadonlyArray<ComponentName>): string => {
  return [...componentNames].sort().join(',')
}

// --- Core Functions ---

export const createWorld = (): World => ({
  nextEntityId: 0,
  entities: new Map(),
  archetypes: new Map(),
  components: {
    position: new Map(),
    velocity: new Map(),
    player: new Map(),
    inputState: new Map(),
    cameraState: new Map(),
    hotbar: new Map(),
    target: new Map(),
    gravity: new Map(),
    collider: new Map(),
    renderable: new Map(),
    instancedMeshRenderable: new Map(),
    terrainBlock: new Map(),
    chunk: new Map(),
    camera: new Map(),
    targetBlock: new Map(),
    chunkLoaderState: new Map(),
  },
  globalState: {
    scene: 'Title',
    seeds: { world: 1, biome: 2, trees: 3 },
    amplitude: 20,
    editedBlocks: {
      placed: ReadonlyRecord.empty(),
      destroyed: HashSet.empty<string>(),
    },
    chunkLoading: {
      lastPlayerChunk: Option.none(),
      loadedChunks: HashMap.empty<string, EntityId>(),
    },
  },
})

export const addArchetype = (world: World, archetype: Archetype): readonly [EntityId, World] => {
  const entityId = toEntityId(world.nextEntityId)
  const componentNames = Object.keys(archetype) as ComponentName[]
  const archetypeKey = getArchetypeKey(componentNames)

  const newEntities = new Map(world.entities).set(entityId, archetypeKey)
  const newArchetypes = new Map(world.archetypes)
  if (!newArchetypes.has(archetypeKey)) {
    newArchetypes.set(archetypeKey, new Set())
  }
  newArchetypes.get(archetypeKey)!.add(entityId)

  const newComponents = { ...world.components }
  for (const componentName of componentNames) {
    const componentData = archetype[componentName]!
    const newComponentMap = new Map(world.components[componentName])
    newComponentMap.set(entityId, componentData)
    ;(newComponents as any)[componentName] = newComponentMap
  }

  const newWorld: World = {
    ...world,
    nextEntityId: world.nextEntityId + 1,
    entities: newEntities,
    archetypes: newArchetypes,
    components: newComponents,
  }

  return [entityId, newWorld]
}

export const removeEntity = (world: World, entityId: EntityId): World => {
  const archetypeKey = world.entities.get(entityId)
  if (!archetypeKey) {
    return world
  }

  const newEntities = new Map(world.entities)
  newEntities.delete(entityId)

  const newArchetypes = new Map(world.archetypes)
  const archetypeEntities = new Set(newArchetypes.get(archetypeKey)!)
  archetypeEntities.delete(entityId)
  newArchetypes.set(archetypeKey, archetypeEntities)

  const newComponents = { ...world.components }
  for (const componentName of Object.keys(newComponents) as ComponentName[]) {
    const newComponentMap = new Map(newComponents[componentName])
    if (newComponentMap.has(entityId)) {
      newComponentMap.delete(entityId)
      ;(newComponents as any)[componentName] = newComponentMap
    }
  }

  return {
    ...world,
    entities: newEntities,
    archetypes: newArchetypes,
    components: newComponents,
  }
}

export const getComponent = <T extends ComponentName>(world: World, entityId: EntityId, componentName: T): Option.Option<Components[T]> => {
  return Option.fromNullable(world.components[componentName].get(entityId) as Components[T])
}

export const updateComponent = <T extends ComponentName>(world: World, entityId: EntityId, componentName: T, componentData: Components[T]): World => {
  const newComponents = { ...world.components }
  const newComponentMap = new Map(world.components[componentName])
  newComponentMap.set(entityId, componentData)
  ;(newComponents as any)[componentName] = newComponentMap

  return {
    ...world,
    components: newComponents,
  }
}

export const query = <T extends ReadonlyArray<ComponentName>>(world: World, queryDef: Query): ReadonlyArray<QueryResult<T>> => {
  const requiredComponents = new Set(queryDef.components)
  const results: QueryResult<T>[] = []

  // Find all archetypes that have at least the required components
  const matchingArchetypes: Set<EntityId>[] = []
  for (const [archetypeKey, entities] of world.archetypes.entries()) {
    const archetypeComponents = new Set(archetypeKey.split(','))
    let match = true
    for (const req of requiredComponents) {
      if (!archetypeComponents.has(req)) {
        match = false
        break
      }
    }
    if (match) {
      matchingArchetypes.push(entities)
    }
  }

  for (const entities of matchingArchetypes) {
    for (const entityId of entities) {
      const result: Partial<QueryResult<T>> = { entityId } as any
      let allComponentsFound = true
      for (const componentName of queryDef.components) {
        const component = getComponent(world, entityId, componentName)
        if (Option.isSome(component)) {
          ;(result as any)[componentName] = component.value
        } else {
          allComponentsFound = false
          break
        }
      }
      if (allComponentsFound) {
        results.push(result as QueryResult<T>)
      }
    }
  }
  return results
}

export const querySoA = <T extends ReadonlyArray<ComponentName>>(world: World, queryDef: Query): QuerySoAResult<T> => {
  const queryResult = query(world, queryDef)
  const entities = queryResult.map((r) => r.entityId)

  const result: Mutable<QuerySoAResult<T>> = {
    entities,
  } as any

  for (const componentName of queryDef.components) {
    const componentSchema = ComponentSchemas[componentName]
    const ast = S.isSchema(componentSchema) ? componentSchema.ast : undefined
    const typeLiteral = ast && AST.isTransformation(ast) ? ast.from : ast

    if (typeLiteral && AST.isTypeLiteral(typeLiteral)) {
      const props = AST.getPropertySignatures(typeLiteral)
      const propKeys = props.map((p) => String(p.name))

      const soaStore: any = {}
      for (const key of propKeys) {
        soaStore[key] = queryResult.map((r) => (r as any)[componentName][key])
      }
      ;(result as any)[componentName] = soaStore
    } else {
      ;(result as any)[componentName] = queryResult.map((r) => (r as any)[componentName])
    }
  }

  return result as QuerySoAResult<T>
}