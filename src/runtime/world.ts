import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import { Archetype } from '@/domain/archetypes'
import { ComponentName, Components, ComponentSchemas } from '@/domain/components'
import { EntityId } from '@/domain/entity'
import { Query } from '@/domain/query'
import {
  addArchetype as addArchetypePure,
  createWorld as createWorldState,
  getComponent as getComponentPure,
  query as queryPure,
  removeEntity as removeEntityPure,
  updateComponent as updateComponentPure,
  World as WorldState,
  QueryResult,
  querySoA as querySoAPure,
  QuerySoAResult,
} from './world-pure'

// Re-export pure types for convenience
export type { World as WorldState, QueryResult, QuerySoAResult } from './world-pure'

// --- Service Definition ---

export interface World {
  readonly state: Ref.Ref<WorldState>
  readonly addArchetype: (archetype: Archetype) => Effect.Effect<EntityId>
  readonly removeEntity: (id: EntityId) => Effect.Effect<void>
  readonly getComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<Option.Option<Components[T]>>
  readonly updateComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, componentData: Components[T]) => Effect.Effect<void>
  readonly query: <T extends ReadonlyArray<ComponentName>>(queryDef: Query) => Effect.Effect<ReadonlyArray<QueryResult<T>>>
  readonly querySoA: <T extends ReadonlyArray<ComponentName>>(queryDef: Query) => Effect.Effect<QuerySoAResult<T>>
  readonly modify: <A>(f: (world: WorldState) => readonly [A, WorldState]) => Effect.Effect<A>
  readonly update: (f: (world: WorldState) => WorldState) => Effect.Effect<void>
}

export const World = Context.GenericTag<World>('app/World')

// --- Live Implementation ---

export const WorldLive = Layer.effect(
  World,
  Effect.gen(function* (_) {
    const worldStateRef = yield* Ref.make(createWorldState())

    const modify = <A>(f: (world: WorldState) => readonly [A, WorldState]) => {
      return Ref.modify(worldStateRef, f)
    }

    const update = (f: (world: WorldState) => WorldState) => {
      return Ref.update(worldStateRef, f)
    }

    const addArchetype = (archetype: Archetype) => modify((world) => addArchetypePure(world, archetype))

    const removeEntity = (id: EntityId) => update((world) => removeEntityPure(world, id))

    const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T) =>
      Effect.map(Ref.get(worldStateRef), (world) => getComponentPure(world, entityId, componentName))

    const updateComponent = <T extends ComponentName>(entityId: EntityId, componentName: T, componentData: Components[T]) =>
      update((world) => updateComponentPure(world, entityId, componentName, componentData))

    const query = <T extends ReadonlyArray<ComponentName>>(queryDef: Query) => Effect.map(Ref.get(worldStateRef), (world) => queryPure<T>(world, queryDef))

    const querySoA = <T extends ReadonlyArray<ComponentName>>(queryDef: Query) =>
      Effect.map(Ref.get(worldStateRef), (world) => querySoAPure<T>(world, queryDef, ComponentSchemas))

    return {
      state: worldStateRef,
      addArchetype,
      removeEntity,
      getComponent,
      updateComponent,
      query,
      querySoA,
      modify,
      update,
    }
  }),
)