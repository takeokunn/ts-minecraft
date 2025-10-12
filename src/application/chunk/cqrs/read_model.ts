import { Context, Effect, HashMap, Layer, Option, Stream, SubscriptionRef, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'

import type { ChunkData, ChunkPosition, ChunkRegion } from '@domain/chunk/types'
import { getChunkHash, type ChunkHash } from '@domain/chunk/value_object'
import { makeUnsafeChunkId, type ChunkId } from '@domain/shared/entities/chunk_id'

interface ChunkReadModelState {
  readonly byId: HashMap.HashMap<ChunkId, ChunkData>
  readonly indexByHash: HashMap.HashMap<ChunkHash, ChunkId>
}

const makeInitialState = (): ChunkReadModelState => ({
  byId: HashMap.empty<ChunkId, ChunkData>(),
  indexByHash: HashMap.empty<ChunkHash, ChunkId>(),
})

const resolveChunkId = (chunk: ChunkData): ChunkId =>
  makeUnsafeChunkId((chunk.id ?? getChunkHash(chunk.position)) as string)

const withResolvedId = (chunk: ChunkData, chunkId: ChunkId): ChunkData =>
  chunk.id ? chunk : ({ ...chunk, id: chunkId } as ChunkData)

export interface ChunkReadModel {
  readonly upsert: (chunk: ChunkData) => Effect.Effect<void>
  readonly remove: (chunkId: ChunkId) => Effect.Effect<void>
  readonly getById: (chunkId: ChunkId) => Effect.Effect<Option.Option<ChunkData>>
  readonly getByPosition: (position: ChunkPosition) => Effect.Effect<Option.Option<ChunkData>>
  readonly listRegion: (region: ChunkRegion) => Effect.Effect<ReadonlyArray.ReadonlyArray<ChunkData>>
  readonly chunkStream: Stream.Stream<ReadonlyArray.ReadonlyArray<ChunkData>>
}

export const ChunkReadModel = Context.GenericTag<ChunkReadModel>('@minecraft/domain/chunk/CQRS/ReadModel')

export const ChunkReadModelLive = Layer.effect(
  ChunkReadModel,
  Effect.gen(function* () {
    const subscription = yield* SubscriptionRef.make<ChunkReadModelState>(makeInitialState())

    const upsert: ChunkReadModel['upsert'] = (chunk) =>
      SubscriptionRef.update(subscription, (state) => {
        const chunkId = resolveChunkId(chunk)
        const enriched = withResolvedId(chunk, chunkId)
        const hash = getChunkHash(enriched.position)

        return {
          byId: HashMap.set(state.byId, chunkId, enriched),
          indexByHash: HashMap.set(state.indexByHash, hash, chunkId),
        }
      })

    const remove: ChunkReadModel['remove'] = (chunkId) =>
      SubscriptionRef.update(subscription, (state) => {
        const existing = HashMap.get(state.byId, chunkId)
        const nextById = HashMap.remove(state.byId, chunkId)
        const nextIndex = Option.match(existing, {
          onNone: () => state.indexByHash,
          onSome: (chunk) => HashMap.remove(state.indexByHash, getChunkHash(chunk.position)),
        })

        return { byId: nextById, indexByHash: nextIndex }
      })

    const getById: ChunkReadModel['getById'] = (chunkId) =>
      SubscriptionRef.get(subscription).pipe(Effect.map((state) => HashMap.get(state.byId, chunkId)))

    const getByPosition: ChunkReadModel['getByPosition'] = (position) =>
      SubscriptionRef.get(subscription).pipe(
        Effect.map((state) =>
          pipe(
            HashMap.get(state.indexByHash, getChunkHash(position)),
            Option.flatMap((id) => HashMap.get(state.byId, id))
          )
        )
      )

    const listRegion: ChunkReadModel['listRegion'] = (region) =>
      SubscriptionRef.get(subscription).pipe(
        Effect.map((state) =>
          ReadonlyArray.fromIterable(
            ReadonlyArray.filter(
              ReadonlyArray.fromIterable(HashMap.values(state.byId)),
              (chunk) =>
                chunk.position.x >= region.minX &&
                chunk.position.x <= region.maxX &&
                chunk.position.z >= region.minZ &&
                chunk.position.z <= region.maxZ
            )
          )
        )
      )

    const chunkStream: ChunkReadModel['chunkStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => ReadonlyArray.fromIterable(HashMap.values(state.byId)))
    )

    return ChunkReadModel.of({
      upsert,
      remove,
      getById,
      getByPosition,
      listRegion,
      chunkStream,
    })
  })
)
