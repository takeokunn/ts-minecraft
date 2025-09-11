import { Archetype } from '@/domain/archetypes'
import { Vector3Float as Vector3 } from '@/core/common'
import {
  Chunk,
  componentNamesSet,
  type Components,
  ComponentSchemas,
  type ComponentName,
  type ComponentOfName,
} from '@/core/components'
import { type EntityId, toEntityId } from '@/domain/entities'
import { toChunkIndex } from '@/domain/geometry'
import { type LegacyQuery, type OptimizedQuery } from '@/core/queries'
import { type Voxel } from '@/domain/world'
import { World } from '@/runtime/services'
import { Effect, HashMap, HashSet, Layer, Option, Ref } from 'effect'
import * as S from "/schema/Schema"

// Import errors from centralized location
import {
  ComponentNotFoundError,
  QuerySingleResultNotFoundError,
  ComponentDecodeError,
} from '@/core/errors'

// --- Data Types ---

export type ComponentStorage = {
  readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
}

export type ArchetypeStorage = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

export interface WorldState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: ArchetypeStorage
  readonly components: ComponentStorage
  readonly chunks: HashMap.HashMap<string, Chunk>
}

// --- Helper Functions ---
const getArchetypeKey = (components: ReadonlyArray<ComponentName>): string => {
  return [...components].sort().join(',')
}

const getChunkKey = (chunkX: number, chunkZ: number) => `${chunkX},${chunkZ}`

// --- Live Implementation ---
export const WorldLive = Layer.effect(
  World,
  Effect.gen(function* (_) {
    const state = yield* _(
      Ref.make<WorldState>({
        nextEntityId: 0,
        entities: HashMap.empty(),
        archetypes: HashMap.empty(),
        components: Object.fromEntries(
          Array.from(componentNamesSet).map((name) => [name, HashMap.empty()]),
        ) as ComponentStorage,
        chunks: HashMap.empty(),
      }),
    )

    const addArchetype = (archetype: Archetype) =>
      Ref.modify(state, (s) => {
        const entityId = toEntityId(s.nextEntityId)
        const componentEntries = Object.entries(archetype) as [ComponentName, Components[ComponentName]][]
        const archetypeKey = getArchetypeKey(componentEntries.map(([name]) => name))

        const newArchetypes = HashMap.has(s.archetypes, archetypeKey)
          ? HashMap.modify(s.archetypes, archetypeKey, (set) => HashSet.add(set, entityId))
          : HashMap.set(s.archetypes, archetypeKey, HashSet.make(entityId))

        const newComponents = componentEntries.reduce((acc, [name, component]) => {
          const componentMap = acc[name]
          return {
            ...acc,
            [name]: HashMap.set(componentMap, entityId, component),
          }
        }, s.components)

        const newState: WorldState = {
          ...s,
          nextEntityId: s.nextEntityId + 1,
          entities: HashMap.set(s.entities, entityId, archetypeKey),
          archetypes: newArchetypes,
          components: newComponents,
        }
        return [entityId, newState]
      })

    const removeEntity = (entityId: EntityId) =>
      Ref.update(state, (s) => {
        const archetypeKeyOpt = HashMap.get(s.entities, entityId)
        if (Option.isNone(archetypeKeyOpt)) {
          return s
        }
        const archetypeKey = archetypeKeyOpt.value

        const newArchetypes = HashMap.modify(s.archetypes, archetypeKey, (set) => HashSet.remove(set, entityId))

        const componentNamesToRemove = archetypeKey.split(',') as ComponentName[]
        const newComponents = componentNamesToRemove.reduce((acc, componentName) => {
          return {
            ...acc,
            [componentName]: HashMap.remove(acc[componentName], entityId),
          }
        }, s.components)

        return {
          ...s,
          entities: HashMap.remove(s.entities, entityId),
          archetypes: newArchetypes,
          components: newComponents,
        }
      })

    const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T) =>
      Ref.get(state).pipe(Effect.map((s) => HashMap.get(s.components[componentName], entityId)))

    const getComponentUnsafe = <T extends ComponentName>(entityId: EntityId, componentName: T) =>
      getComponent(entityId, componentName).pipe(
        Effect.flatten,
        Effect.mapError(() => new ComponentNotFoundError(entityId, componentName)),
      )

    const updateComponent = <T extends ComponentName>(
      entityId: EntityId,
      componentName: T,
      data: Partial<ComponentOfName<T>>,
    ) =>
      Ref.get(state).pipe(
        Effect.flatMap((s) =>
          HashMap.get(s.components[componentName], entityId).pipe(
            Option.match({
              onNone: () => Effect.fail(new ComponentNotFoundError(entityId, componentName)),
              onSome: (current) => {
                const updated = { ...current, ...data }
                return S.decode(ComponentSchemas[componentName])(updated).pipe(
                  Effect.mapError((error) => new ComponentDecodeError(entityId, componentName, error)),
                  Effect.flatMap((decoded) => {
                    const newComponentMap = HashMap.set(s.components[componentName], entityId, decoded as any)
                    const newComponents = { ...s.components, [componentName]: newComponentMap }
                    return Ref.set(state, { ...s, components: newComponents })
                  })
                )
              }
            }),
          ),
        ),
        Effect.asVoid,
      )

    const query = <T extends ReadonlyArray<ComponentName>>(query: LegacyQuery<T> | OptimizedQuery<T>) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const requiredComponents = HashSet.fromIterable(query.components)
          const matchingArchetypes = HashMap.filter(s.archetypes, (_, key) => {
            const archetypeComponents = HashSet.fromIterable(key.split(','))
            return HashSet.isSubset(requiredComponents, archetypeComponents)
          })

          return Array.from(matchingArchetypes).flatMap(([, entitySet]: [string, HashSet.HashSet<EntityId>]) => 
            Array.from(entitySet).map((entityId: EntityId) => {
              const componentOptions = query.components.map((name) => HashMap.get(s.components[name], entityId))
              const allComponents = Option.all(componentOptions)
              return Option.map(allComponents, (components) => [entityId, components] as [EntityId, Array<Components[T[number]]>])
            }).filter(Option.isSome).map(option => option.value)
          ).filter((result): result is [EntityId, Array<Components[T[number]]>] => result !== undefined)
        }),
      )

    const queryUnsafe = <T extends ReadonlyArray<ComponentName>>(q: LegacyQuery<T> | OptimizedQuery<T>) =>
      query(q).pipe(
        Effect.map((results) =>
          results.map(([entityId, components]) => {
            return [entityId, ...components]
          }),
        ),
      )

    const querySingle = <T extends ReadonlyArray<ComponentName>>(q: LegacyQuery<T> | OptimizedQuery<T>) =>
      query(q).pipe(Effect.map((results) => Option.fromNullable(results[0])))

    const querySingleUnsafe = <T extends ReadonlyArray<ComponentName>>(q: LegacyQuery<T> | OptimizedQuery<T>) =>
      querySingle(q).pipe(
        Effect.flatten,
        Effect.mapError(() => new QuerySingleResultNotFoundError({ query: q, resultCount: 0, expectedCount: 1 })),
      )

    const querySoA = <T extends ReadonlyArray<ComponentName>>(query: LegacyQuery<T> | OptimizedQuery<T>) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const requiredComponents = HashSet.fromIterable(query.components)
          const matchingArchetypes = HashMap.filter(s.archetypes, (_, key) => {
            const archetypeComponents = HashSet.fromIterable(key.split(','))
            return HashSet.isSubset(requiredComponents, archetypeComponents)
          })

          const matchingEntities = Array.from(matchingArchetypes).flatMap(([, entitySet]: [string, HashSet.HashSet<EntityId>]) => 
            Array.from(entitySet).map((entityId: EntityId) => {
              const componentOptions = query.components.map((name) => HashMap.get(s.components[name], entityId))
              const allComponents = Option.all(componentOptions)
              return Option.map(allComponents, (components) => ({ entityId, components }))
            }).filter(Option.isSome).map(option => option.value)
          ).filter(result => result !== undefined)

          const entities = matchingEntities.map(({ entityId }) => entityId)
          const components = Object.fromEntries(
            query.components.map((name, i) => [name, matchingEntities.map(({ components }) => components[i])]),
          )

          return {
            entities,
            components: components as { [K in T[number]]: ReadonlyArray<Components[K]> },
          }
        }),
      )

    const getChunk = (chunkX: number, chunkZ: number) =>
      Ref.get(state).pipe(Effect.map((s) => HashMap.get(s.chunks, getChunkKey(chunkX, chunkZ))))

    const setChunk = (chunkX: number, chunkZ: number, chunk: Chunk) =>
      Ref.update(state, (s) => ({
        ...s,
        chunks: HashMap.set(s.chunks, getChunkKey(chunkX, chunkZ), chunk),
      }))

    const getVoxel = (x: number, y: number, z: number) =>
      getChunk(Math.floor(x / 16), Math.floor(z / 16)).pipe(
        Effect.map(
          Option.match({
            onNone: () => Option.none<Voxel>(),
            onSome: (chunk) => {
              const vec: Vector3 = [x, y, z] as unknown as Vector3
              const index = toChunkIndex(vec)
              const blockType = chunk.blocks[index]
              if (blockType === 'air') {
                return Option.none<Voxel>()
              }
              const voxel: Voxel = {
                position: [Math.floor(x), Math.floor(y), Math.floor(z)] as unknown as Vector3,
                blockType: blockType,
              }
              return Option.some(voxel)
            },
          }),
        ),
      )

    const setVoxel = (x: number, y: number, z: number, voxel: Voxel) =>
      getChunk(Math.floor(x / 16), Math.floor(z / 16)).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.void,
            onSome: (chunk) => {
              const vec: Vector3 = [x, y, z] as unknown as Vector3
              const index = toChunkIndex(vec)
              const newBlocks = [...chunk.blocks]
              newBlocks[index] = voxel.blockType
              const newChunk: Chunk = { ...chunk, blocks: newBlocks }
              return setChunk(chunk.chunkX, chunk.chunkZ, newChunk)
            },
          }),
        ),
      )

    return {
      state,
      addArchetype,
      removeEntity,
      getComponent,
      getComponentUnsafe,
      updateComponent,
      query,
      querySoA,
      queryUnsafe,
      querySingle,
      querySingleUnsafe,
      getChunk,
      setChunk,
      getVoxel,
      setVoxel,
    }
  }),
)