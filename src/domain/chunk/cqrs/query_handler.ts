import { Context, Data, Effect, Layer, Match, Option } from 'effect'

import type { ChunkData, ChunkId, ChunkPosition, ChunkQuery } from '../types'
import {
  ChunkRepository,
  type ChunkRepository as ChunkRepositoryService,
  type ChunkRegion,
  type ChunkStatistics,
} from '../repository/chunk_repository/interface'
import type { RepositoryError } from '../repository/types'

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

export const ChunkQueryHandler = Context.GenericTag<ChunkQueryHandler>(
  '@minecraft/domain/chunk/CQRS/QueryHandler'
)

const ensureChunkById = (
  repository: ChunkRepositoryService,
  chunkId: ChunkId
): Effect.Effect<ChunkData, ChunkQueryHandlerError> =>
  repository.findById(chunkId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(ChunkQueryError.ChunkNotFound({ chunkId })),
        onSome: Effect.succeed,
      })
    )
  )

const ensureChunkByPosition = (
  repository: ChunkRepositoryService,
  position: ChunkPosition
): Effect.Effect<ChunkData, ChunkQueryHandlerError> =>
  repository.findByPosition(position).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(ChunkQueryError.ChunkNotFound({ position })),
        onSome: Effect.succeed,
      })
    )
  )

const handleGetChunkById = (
  repository: ChunkRepositoryService,
  chunkId: ChunkId
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  ensureChunkById(repository, chunkId).pipe(
    Effect.map((chunk) => ({ _tag: 'ChunkFound', chunk } as const))
  )

const handleGetChunkByPosition = (
  repository: ChunkRepositoryService,
  position: ChunkPosition
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  ensureChunkByPosition(repository, position).pipe(
    Effect.map((chunk) => ({ _tag: 'ChunkFound', chunk } as const))
  )

const handleListChunksInRegion = (
  repository: ChunkRepositoryService,
  region: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> => {
  const chunkRegion: ChunkRegion = {
    minX: region.minX,
    maxX: region.maxX,
    minZ: region.minZ,
    maxZ: region.maxZ,
  }

  return repository.findByRegion(chunkRegion).pipe(
    Effect.map((chunks) => ({ _tag: 'ChunkList', chunks } as const))
  )
}

const handleGetStatistics = (
  repository: ChunkRepositoryService
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  repository.getStatistics().pipe(Effect.map((statistics) => ({ _tag: 'ChunkStatistics', statistics } as const)))

const executeQuery = (
  repository: ChunkRepositoryService,
  query: ChunkQuery
): Effect.Effect<ChunkQueryResult, ChunkQueryHandlerError> =>
  Match.value(query).pipe(
    Match.tag('GetChunkById', (q) => handleGetChunkById(repository, q.chunkId)),
    Match.tag('GetChunkByPosition', (q) => handleGetChunkByPosition(repository, q.position)),
    Match.tag('ListChunksInRegion', (q) => handleListChunksInRegion(repository, q.region)),
    Match.tag('GetChunkStatistics', () => handleGetStatistics(repository)),
    Match.exhaustive
  )

export const ChunkQueryHandlerLive = Layer.effect(
  ChunkQueryHandler,
  Effect.gen(function* () {
    const repository = yield* ChunkRepository

    return ChunkQueryHandler.of({
      execute: (query) => executeQuery(repository, query),
    })
  })
)
