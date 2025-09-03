import { Archetype } from '@/domain/archetypes'
import { Chunk, ComponentName, ComponentOfName, Hotbar } from '@/domain/components'
import { EntityId } from '@/domain/entity'
import { AABB } from '@/domain/geometry'
import { Query, QueryResult } from '../domain/query'
import { Voxel, WorldState } from '../domain/world'
import { Context, Effect, Option, Queue, Ref, Scope } from 'effect'
import * as T from 'three'
import { IncomingMessage, OutgoingMessage } from '@/workers/messages'

export type SoAResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: {
    readonly [K in T[number]]: ReadonlyArray<ComponentOfName<K>>
  }
}

export class World extends Context.Tag('World')<
  World,
  {
    readonly state: Ref.Ref<WorldState>
    readonly addArchetype: (archetype: Archetype) => Effect.Effect<EntityId>
    readonly removeEntity: (entityId: EntityId) => Effect.Effect<void>
    readonly getComponent: <T extends ComponentName>(
      entityId: EntityId,
      componentName: T,
    ) => Effect.Effect<Option.Option<ComponentOfName<T>>>
    readonly getComponentUnsafe: <T extends ComponentName>(
      entityId: EntityId,
      componentName: T,
    ) => Effect.Effect<ComponentOfName<T>>
    readonly updateComponent: <T extends ComponentName>(
      entityId: EntityId,
      componentName: T,
      data: Partial<Omit<ComponentOfName<T>, 'name'>>,
    ) => Effect.Effect<void>
    readonly query: <T extends ReadonlyArray<ComponentName>>(
      query: Query<T>,
    ) => Effect.Effect<ReadonlyArray<readonly [EntityId, QueryResult<T>]>>
    readonly querySoA: <T extends ReadonlyArray<ComponentName>>(
      query: Query<T>,
    ) => Effect.Effect<SoAResult<T>>
    readonly queryUnsafe: <T extends ReadonlyArray<ComponentName>>(
      query: Query<T>,
    ) => Effect.Effect<ReadonlyArray<readonly [EntityId, ...QueryResult<T>]>>
    readonly querySingle: <T extends ReadonlyArray<ComponentName>>(
      query: Query<T>,
    ) => Effect.Effect<Option.Option<readonly [EntityId, QueryResult<T>]>>
    readonly querySingleUnsafe: <T extends ReadonlyArray<ComponentName>>(
      query: Query<T>,
    ) => Effect.Effect<readonly [EntityId, QueryResult<T>]>
    readonly getChunk: (chunkX: number, chunkZ: number) => Effect.Effect<Option.Option<Chunk>>
    readonly setChunk: (chunkX: number, chunkZ: number, chunk: Chunk) => Effect.Effect<void>
    readonly getVoxel: (x: number, y: number, z: number) => Effect.Effect<Option.Option<Voxel>>
    readonly setVoxel: (x: number, y: number, z: number, voxel: Voxel) => Effect.Effect<void>
  }
>() {}

export type RenderCommand =
  | {
    readonly type: 'ADD_CHUNK'
    readonly chunkX: number
    readonly chunkZ: number
    readonly positions: Float32Array
    readonly normals: Float32Array
    readonly uvs: Float32Array
    readonly indices: Uint32Array
  }
  | {
    readonly type: 'REMOVE_CHUNK'
    readonly chunkX: number
    readonly chunkZ: number
  }
export class Renderer extends Context.Tag('Renderer')<
  Renderer,
  {
    readonly renderQueue: Queue.Queue<RenderCommand>
    readonly updateCamera: (position: T.Vector3, rotation: T.Euler) => Effect.Effect<void>
  }
>() {}

export class InputManager extends Context.Tag('InputManager')<
  InputManager,
  {
    readonly isLocked: Ref.Ref<boolean>
    readonly getState: () => Effect.Effect<{
      readonly forward: boolean
      readonly backward: boolean
      readonly left: boolean
      readonly right: boolean
      readonly jump: boolean
      readonly sprint: boolean
      readonly place: boolean
      readonly destroy: boolean
    }>
    readonly getMouseState: () => Effect.Effect<{
      readonly dx: number
      readonly dy: number
    }>
  }
>() {}

export class Raycast extends Context.Tag('Raycast')<
  Raycast,
  {
    readonly raycast: () => Effect.Effect<Option.Option<T.Intersection>>
  }
>() {}

export class MaterialManager extends Context.Tag('MaterialManager')<
  MaterialManager,
  {
    readonly getMaterial: (name: string) => Effect.Effect<T.Material, unknown>
  }
>() {}

export class SpatialGrid extends Context.Tag('SpatialGrid')<
  SpatialGrid,
  {
    readonly add: (entityId: EntityId, aabb: AABB) => Effect.Effect<void>
    readonly query: (aabb: AABB) => Effect.Effect<ReadonlyArray<EntityId>>
    readonly clear: () => Effect.Effect<void>
  }
>() {}



export class ComputationWorker extends Context.Tag('ComputationWorker')<
  ComputationWorker,
  {
    readonly postTask: (task: IncomingMessage) => Effect.Effect<void>
    readonly onMessage: (
      handler: (message: OutgoingMessage) => Effect.Effect<void, never, Scope.Scope>,
    ) => Effect.Effect<void, never, Scope.Scope>
  }
>() {}

export class Clock extends Context.Tag('Clock')<
  Clock,
  {
    readonly deltaTime: Ref.Ref<number>
    readonly onFrame: (callback: () => Effect.Effect<void>) => Effect.Effect<void>
  }
>() {}

export class Stats extends Context.Tag('Stats')<
  Stats,
  {
    readonly begin: Effect.Effect<void>
    readonly end: Effect.Effect<void>
  }
>() {}

export class DeltaTime extends Context.Tag('DeltaTime')<DeltaTime, { readonly value: number }>() {}

export class UIService extends Context.Tag('UIService')<
  UIService,
  {
    readonly updateHotbar: (hotbar: Hotbar) => Effect.Effect<void>
  }
>() {}