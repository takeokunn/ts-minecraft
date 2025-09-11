import { Effect, Ref, HashMap, Option, Context, Layer } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import { Entity } from '../services/entity.service'
import { EntityId } from '../value-objects/entity-id.vo'
import { Chunk } from '../entities/chunk.entity'
import { ChunkCoordinate } from '../value-objects/coordinates/chunk-coordinate.vo'

/**
 * World State Interface
 * Represents the complete state of the world including entities and chunks
 */
export interface WorldState {
  readonly _tag: 'WorldState'
  readonly entities: HashMap.HashMap<EntityId, Entity>
  readonly chunks: HashMap.HashMap<string, Chunk>
  readonly timestamp: number
}

/**
 * Factory function to create an empty WorldState
 */
export const makeEmptyWorldState = (): WorldState => ({
  _tag: 'WorldState',
  entities: HashMap.empty(),
  chunks: HashMap.empty(),
  timestamp: Date.now()
})

/**
 * World Service Interface
 * Provides methods for managing world state including entities and chunks
 */
export const WorldService = Context.GenericTag<{
  readonly addEntity: (entity: Entity) => Effect.Effect<void>
  readonly getEntity: (id: EntityId) => Effect.Effect<Option.Option<Entity>>
  readonly removeEntity: (id: EntityId) => Effect.Effect<void>
  readonly queryEntities: (predicate: (entity: Entity) => boolean) => Effect.Effect<ReadonlyArray<Entity>>
  readonly addChunk: (chunk: Chunk) => Effect.Effect<void>
  readonly getChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<Chunk>>
  readonly removeChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void>
  readonly updateWorldState: (updater: (state: WorldState) => WorldState) => Effect.Effect<void>
  readonly getWorldState: () => Effect.Effect<WorldState>
}>('WorldService')

/**
 * World Service Live Implementation
 * Provides a concrete implementation of WorldService using Effect-TS patterns
 */
export const WorldServiceLive = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(makeEmptyWorldState())
    
    return WorldService.of({
      addEntity: (entity) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          entities: HashMap.set(state.entities, entity.id, entity),
          timestamp: Date.now()
        })),
      
      getEntity: (id) =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => HashMap.get(state.entities, id))
        ),
      
      removeEntity: (id) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          entities: HashMap.remove(state.entities, id),
          timestamp: Date.now()
        })),
      
      queryEntities: (predicate) =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => {
            const entities = HashMap.values(state.entities)
            return ReadonlyArray.fromIterable(entities).pipe(
              ReadonlyArray.filter(predicate)
            )
          })
        ),
      
      addChunk: (chunk) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          chunks: HashMap.set(state.chunks, `${chunk.coordinate.x},${chunk.coordinate.z}`, chunk),
          timestamp: Date.now()
        })),
      
      getChunk: (coordinate) =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => HashMap.get(state.chunks, `${coordinate.x},${coordinate.z}`))
        ),
      
      removeChunk: (coordinate) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          chunks: HashMap.remove(state.chunks, `${coordinate.x},${coordinate.z}`),
          timestamp: Date.now()
        })),
      
      updateWorldState: (updater) =>
        Ref.update(stateRef, (state) => {
          const updatedState = updater(state)
          return {
            ...updatedState,
            timestamp: Date.now()
          }
        }),
      
      getWorldState: () =>
        Ref.get(stateRef)
    })
  })
)