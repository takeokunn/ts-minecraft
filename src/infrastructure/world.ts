import { Archetype } from '@/domain/archetypes'
import { Vector3Float as Vector3 } from '@/domain/common'
import {
  Chunk,
  componentNamesSet,
  type Components,
  ComponentSchemas,
  type ComponentName,
  type ComponentOfName,
} from '@/domain/components'
import { type EntityId, toEntityId } from '@/domain/entity'
import { toChunkIndex } from '@/domain/geometry'
import { type Query } from '@/domain/query'
import { type Voxel } from '@/domain/world'
import { World } from '@/runtime/services'
import { Data, Effect, HashMap, HashSet, Layer, Option, ReadonlyArray, Ref, pipe } from 'effect'
import { ParseError } from 'effect/ParseResult'
import * as S from 'effect/Schema'

// --- Error Types ---
export class EntityNotFoundError extends Data.TaggedError('EntityNotFoundError')<{
  readonly entityId: EntityId
}> {}

export class ComponentNotFoundError extends Data.TaggedError('ComponentNotFoundError')<{
  readonly entityId: EntityId
  readonly componentName: ComponentName
}> {}

export class QuerySingleResultNotFoundError extends Data.TaggedError('QuerySingleResultNotFoundError')<{
  readonly query: Query<ReadonlyArray<ComponentName>>
}> {}

export class ComponentDecodeError extends Data.TaggedError('ComponentDecodeError')<{
  readonly entityId: EntityId
  readonly componentName: ComponentName
  readonly error: ParseError
}> {}

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
        Effect.mapError(() => new ComponentNotFoundError({ entityId, componentName })),
      )

    const updateComponent = <T extends ComponentName>(
      entityId: EntityId,
      componentName: T,
      data: Partial<ComponentOfName<T>>,
    ) =>
      Ref.get(state).pipe(
        Effect.flatMap((s) =>
          HashMap.get(s.components[componentName], entityId).pipe(
            Option.toEffect,
            Effect.mapError(() => new ComponentNotFoundError({ entityId, componentName })),
            Effect.flatMap((current) => {
              const updated = { ...current, ...data }
              return S.decode(ComponentSchemas[componentName])(updated).pipe(
                Effect.mapError((error) => new ComponentDecodeError({ entityId, componentName, error })),
                Effect.flatMap((decoded) => {
                  const newComponentMap = HashMap.set(s.components[componentName], entityId, decoded as any)
                  const newComponents = { ...s.components, [componentName]: newComponentMap }
                  return Ref.set(state, { ...s, components: newComponents })
                }),
              )
            }),
          ),
        ),
        Effect.asVoid,
      )

    const query = <T extends ReadonlyArray<ComponentName>>(query: Query<T>) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const requiredComponents = HashSet.fromIterable(query.components)
          const matchingArchetypes = HashMap.filter(s.archetypes, (_, key) => {
            const archetypeComponents = HashSet.fromIterable(key.split(','))
            return HashSet.isSubset(requiredComponents, archetypeComponents)
          })

          return pipe(
            ReadonlyArray.fromIterable(matchingArchetypes),
            ReadonlyArray.flatMap(([, entitySet]: [string, HashSet.HashSet<EntityId>]) =>
              pipe(
                ReadonlyArray.fromIterable(entitySet),
                ReadonlyArray.filterMap((entityId: EntityId) =>
                  pipe(
                    Option.all(query.components.map((name) => HashMap.get(s.components[name], entityId))),
                    Option.map(
                      (components) => [entityId, components] as [EntityId, Array<Components[T[number]]>],
                    ),
                  ),
                ),
              ),
            ),
          )
        }),
      )

    const queryUnsafe = <T extends ReadonlyArray<ComponentName>>(q: Query<T>) =>
      query(q).pipe(
        Effect.map((results) =>
          results.map(([entityId, components]) => {
            return [entityId, ...components]
          }),
        ),
      )

    const querySingle = <T extends ReadonlyArray<ComponentName>>(q: Query<T>) =>
      query(q).pipe(Effect.map((results) => Option.fromNullable(results[0])))

    const querySingleUnsafe = <T extends ReadonlyArray<ComponentName>>(q: Query<T>) =>
      querySingle(q).pipe(
        Effect.flatten,
        Effect.mapError(() => new QuerySingleResultNotFoundError({ query: q })),
      )

    const querySoA = <T extends ReadonlyArray<ComponentName>>(query: Query<T>) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const requiredComponents = HashSet.fromIterable(query.components)
          const matchingArchetypes = HashMap.filter(s.archetypes, (_, key) => {
            const archetypeComponents = HashSet.fromIterable(key.split(','))
            return HashSet.isSubset(requiredComponents, archetypeComponents)
          })

          const matchingEntities = pipe(
            ReadonlyArray.fromIterable(matchingArchetypes),
            ReadonlyArray.flatMap(([, entitySet]: [string, HashSet.HashSet<EntityId>]) =>
              pipe(
                ReadonlyArray.fromIterable(entitySet),
                ReadonlyArray.filterMap((entityId: EntityId) =>
                  pipe(
                    Option.all(query.components.map((name) => HashMap.get(s.components[name], entityId))),
                    Option.map((components) => ({ entityId, components })),
                  ),
                ),
              ),
            ),
          )

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

    return World.of({
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
    })
  }),
)