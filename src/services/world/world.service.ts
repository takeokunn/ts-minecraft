import { Context, Effect, Option, Ref } from 'effect'
import { Archetype } from '@/domain/archetypes'
import { Chunk, ComponentName, ComponentOfName } from '@/core/components'
import { EntityId } from '@/domain/entity'
import { Query, QueryResult } from '@/domain/query'
import { Voxel, WorldState } from '@/domain/world'

/**
 * Structure-of-Arrays result type for efficient component queries
 */
export type SoAResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: {
    readonly [K in T[number]]: ReadonlyArray<ComponentOfName<K>>
  }
}

/**
 * World Service - Core ECS world management
 * Provides entity and component management operations
 */
export class World extends Context.Tag('World')<
  World,
  {
    // State management
    readonly state: Ref.Ref<WorldState>
    
    // Entity operations
    readonly addArchetype: (archetype: Archetype) => Effect.Effect<EntityId>
    readonly removeEntity: (entityId: EntityId) => Effect.Effect<void>
    
    // Component operations
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
    
    // Query operations
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
    
    // Chunk operations
    readonly getChunk: (chunkX: number, chunkZ: number) => Effect.Effect<Option.Option<Chunk>>
    readonly setChunk: (chunkX: number, chunkZ: number, chunk: Chunk) => Effect.Effect<void>
    
    // Voxel operations
    readonly getVoxel: (x: number, y: number, z: number) => Effect.Effect<Option.Option<Voxel>>
    readonly setVoxel: (x: number, y: number, z: number, voxel: Voxel) => Effect.Effect<void>
  }
>() {}