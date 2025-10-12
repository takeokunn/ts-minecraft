import { Context, Data, Effect, Layer, Match, Option } from 'effect'

import { ChunkRepository, type ChunkRepository as ChunkRepositoryService } from '@domain/chunk/repository'
import type { RepositoryError } from '@domain/chunk/repository/types'
import type { ChunkData, ChunkId, ChunkPosition, ChunkQuery, ChunkRegion, ChunkStatistics } from '@domain/chunk/types'
import { ChunkReadModel } from './read_model'

export const ChunkQueryError = Data.taggedEnum<{
  ChunkNotFound: { readonly chunkId?: ChunkId; readonly position?: ChunkPosition }
}>()

export type ChunkQueryError = Data.TaggedEnum.Type<typeof ChunkQueryError>

export type ChunkQueryHandlerError = RepositoryError | ChunkQueryError

export type ChunkQueryResult =
  | { readonly _tag: 'ChunkFound'; readonly chunk: ChunkData }
  | { readonly _tag: 'ChunkList'; readonly chunks: ReadonlyArray<ChunkData> }
  | { readonly _tag: 'ChunkStatistics'; readonly statistics: ChunkStatistics }

export interface ChunkQueryHandler {
  readonly execute: (query: ChunkQuery) => Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError>
}

export const ChunkQueryHandler = Context.GenericTag<ChunkQueryHandler>('@minecraft/domain/chunk/CQRS/QueryHandler')

const ensureChunkById = (
  repository: ChunkRepositoryService,
  readModel: ChunkReadModel,
  chunkId: ChunkId
): Effect.Effect<ChunkData, ChunkQueryHandlerError> =>
  readModel.getById(chunkId).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () =>
          repository.findById(chunkId).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(ChunkQueryError.ChunkNotFound({ chunkId })),
                onSome: (chunk) => readModel.upsert(chunk).pipe(Effect.as(chunk)),
              })
            )
          ),
      })
    )
  )

const ensureChunkByPosition = (
  repository: ChunkRepositoryService,
  readModel: ChunkReadModel,
  position: ChunkPosition
): Effect.Effect<ChunkData, ChunkQueryHandlerError> =>
  readModel.getByPosition(position).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () =>
          repository.findByPosition(position).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(ChunkQueryError.ChunkNotFound({ position })),
                onSome: (chunk) => readModel.upsert(chunk).pipe(Effect.as(chunk)),
              })
            )
          ),
      })
    )
  )

const handleGetChunkById = (
  repository: ChunkRepositoryService,
  readModel: ChunkReadModel,
  chunkId: ChunkId
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  ensureChunkById(repository, readModel, chunkId).pipe(Effect.map((chunk) => ({ _tag: 'ChunkFound', chunk }) as const))

const handleGetChunkByPosition = (
  repository: ChunkRepositoryService,
  readModel: ChunkReadModel,
  position: ChunkPosition
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  ensureChunkByPosition(repository, readModel, position).pipe(
    Effect.map((chunk) => ({ _tag: 'ChunkFound', chunk }) as const)
  )

const handleListChunksInRegion = (
  repository: ChunkRepositoryService,
  readModel: ChunkReadModel,
  region: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> => {
  const chunkRegion: ChunkRegion = {
    minX: region.minX,
    maxX: region.maxX,
    minZ: region.minZ,
    maxZ: region.maxZ,
  }

  return readModel.listRegion(chunkRegion).pipe(
    Effect.flatMap((chunks) =>
      chunks.length > 0
        ? Effect.succeed({ _tag: 'ChunkList', chunks } as const)
        : repository.findByRegion(chunkRegion).pipe(
            Effect.tap((fetched) => Effect.forEach(fetched, readModel.upsert, { concurrency: 'unbounded' })),
            Effect.map((fetched) => ({ _tag: 'ChunkList', chunks: fetched }) as const)
          )
    )
  )
}

const handleGetStatistics = (
  repository: ChunkRepositoryService
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  repository.getStatistics().pipe(Effect.map((statistics) => ({ _tag: 'ChunkStatistics', statistics }) as const))

const executeQuery = (
  repository: ChunkRepositoryService,
  readModel: ChunkReadModel,
  query: ChunkQuery
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  Match.value(query).pipe(
    Match.tag('GetChunkById', (q) => handleGetChunkById(repository, readModel, q.chunkId)),
    Match.tag('GetChunkByPosition', (q) => handleGetChunkByPosition(repository, readModel, q.position)),
    Match.tag('ListChunksInRegion', (q) => handleListChunksInRegion(repository, readModel, q.region)),
    Match.tag('GetChunkStatistics', () => handleGetStatistics(repository)),
    Match.exhaustive
  )

export const ChunkQueryHandlerLive = Layer.effect(
  ChunkQueryHandler,
  Effect.gen(function* () {
    const repository = yield* ChunkRepository
    const readModel = yield* ChunkReadModel

    return ChunkQueryHandler.of({
      execute: (query) => executeQuery(repository, readModel, query),
    })
  })
)
