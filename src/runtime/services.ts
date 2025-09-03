import { Chunk } from '@/domain/block'
import { Archetype, Component, ComponentName, ComponentOfName, EntityId } from '@/domain/types'
import { Effect, Option, Queue, Ref, Context } from 'effect'
import * as T from 'three'
import { Voxel, WorldState } from '../domain/world'
import { Query, QueryResult } from '../domain/query'
import { AABB } from '@/domain/geometry'
import { Hotbar } from '@/domain/components'

export type SoAResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: {
    readonly [K in T[number]]: ReadonlyArray<ComponentOfName<K>>
  }
}

export interface World {
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
  ) => Effect.Effect<ReadonlyArray<[EntityId, QueryResult<T>]>>
  readonly querySoA: <T extends ReadonlyArray<ComponentName>>(
    query: Query<T>,
  ) => Effect.Effect<SoAResult<T>>
  readonly queryUnsafe: <T extends ReadonlyArray<ComponentName>>(
    query: Query<T>,
  ) => Effect.Effect<ReadonlyArray<[EntityId, QueryResult<T>]>>
  readonly querySingle: <T extends ReadonlyArray<ComponentName>>(
    query: Query<T>,
  ) => Effect.Effect<[EntityId, QueryResult<T>]>
  readonly querySingleUnsafe: <T extends ReadonlyArray<ComponentName>>(
    query: Query<T>,
  ) => Effect.Effect<[EntityId, QueryResult<T>]>
  readonly getChunk: (chunkX: number, chunkZ: number) => Effect.Effect<Option.Option<Chunk>>
  readonly setChunk: (chunkX: number, chunkZ: number, chunk: Chunk) => Effect.Effect<void>
  readonly getVoxel: (x: number, y: number, z: number) => Effect.Effect<Option.Option<Voxel>>
  readonly setVoxel: (x: number, y: number, z: number, voxel: Voxel) => Effect.Effect<void>
}
export const World = Context.Tag<World>()

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
export interface Renderer {
  readonly renderQueue: Queue.Queue<RenderCommand>
  readonly updateCamera: (position: T.Vector3, rotation: T.Euler) => Effect.Effect<void>
}
export const Renderer = Context.Tag<Renderer>()

export interface InputManager {
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
export const InputManager = Context.Tag<InputManager>()

export interface Raycast {
  readonly raycast: () => Effect.Effect<Option.Option<T.Intersection>>
}
export const Raycast = Context.Tag<Raycast>()

export interface MaterialManager {
  readonly getMaterial: (name: string) => Effect.Effect<T.Material>
}
export const MaterialManager = Context.Tag<MaterialManager>()

import { AABB } from '@/domain/geometry'

export interface SpatialGrid {
  readonly add: (entityId: EntityId, aabb: AABB) => Effect.Effect<void>
  readonly query: (aabb: AABB) => Effect.Effect<ReadonlyArray<EntityId>>
  readonly clear: () => Effect.Effect<void>
}
export const SpatialGrid = Context.Tag<SpatialGrid>()

export interface ComputationWorker {
  readonly postTask: (
    task: {
      type: 'generateChunk'
      chunkX: number
      chunkZ: number
    },
  ) => Effect.Effect<void>
  readonly onMessage: (
    handler: (
      message: {
        type: 'chunkGenerated'
        chunkX: number
        chunkZ: number
        positions: Float32Array
        normals: Float32Array
        uvs: Float32Array
        indices: Uint32Array
        blocks: unknown[]
      },
    ) => Effect.Effect<void>,
  ) => Effect.Effect<void>
}
export const ComputationWorker = Context.Tag<ComputationWorker>()

export interface Clock {
  readonly deltaTime: Ref.Ref<number>
  readonly onFrame: (callback: () => Effect.Effect<void>) => Effect.Effect<void>
}
export const Clock = Context.Tag<Clock>()

export interface Stats {
  readonly begin: Effect.Effect<void>
  readonly end: Effect.Effect<void>
}
export const Stats = Context.Tag<Stats>()

export const DeltaTime = Context.Tag<number>()

export interface UIService {
  readonly updateHotbar: (hotbar: Hotbar) => Effect.Effect<void>
}
export const UIService = Context.Tag<UIService>()
