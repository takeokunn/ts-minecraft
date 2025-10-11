import { Context, Data, Effect, Layer, Match, Option } from 'effect'

import type { ChunkCommand, ChunkData, ChunkId, ChunkPosition } from '../types'
import { ChunkRepository, type ChunkRepository as ChunkRepositoryService } from '../repository/chunk_repository'
import type { RepositoryError } from '../repository/types'

export const ChunkCommandError = Data.taggedEnum<{
  ChunkNotFound: { readonly chunkId?: ChunkId; readonly position?: ChunkPosition }
}>()

export type ChunkCommandError = Data.TaggedEnum.Type<typeof ChunkCommandError>

export type ChunkCommandHandlerError = RepositoryError | ChunkCommandError

export type ChunkCommandResult =
  | { readonly _tag: 'ChunkLoaded'; readonly chunk: ChunkData }
  | { readonly _tag: 'ChunkSaved'; readonly chunk: ChunkData }
  | { readonly _tag: 'ChunkUnloaded'; readonly chunkId: ChunkId }

export interface ChunkCommandHandler {
  readonly handle: (command: ChunkCommand) => Effect.Effect<ChunkCommandResult, ChunkCommandHandlerError>
}

export const ChunkCommandHandler = Context.GenericTag<ChunkCommandHandler>(
  '@minecraft/domain/chunk/CQRS/CommandHandler'
)

const handleLoadChunk = (
  repository: ChunkRepositoryService,
  position: ChunkPosition
): Effect.Effect<ChunkCommandResult, ChunkCommandHandlerError> =>
  repository.findByPosition(position).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(ChunkCommandError.ChunkNotFound({ position })),
        onSome: (chunk) => Effect.succeed({ _tag: 'ChunkLoaded', chunk } as const),
      })
    )
  )

const handleSaveChunk = (
  repository: ChunkRepositoryService,
  chunk: ChunkData
): Effect.Effect<ChunkCommandResult, ChunkCommandHandlerError> =>
  repository.save(chunk).pipe(Effect.map((saved) => ({ _tag: 'ChunkSaved', chunk: saved } as const)))

const handleUnloadChunk = (
  repository: ChunkRepositoryService,
  chunkId: ChunkId
): Effect.Effect<ChunkCommandResult, ChunkCommandHandlerError> =>
  repository.delete(chunkId).pipe(Effect.map(() => ({ _tag: 'ChunkUnloaded', chunkId } as const)))

const executeCommand = (
  repository: ChunkRepositoryService,
  command: ChunkCommand
): Effect.Effect<ChunkCommandResult, ChunkCommandHandlerError> =>
  Match.value(command).pipe(
    Match.tag('LoadChunk', (cmd) => handleLoadChunk(repository, cmd.position)),
    Match.tag('SaveChunk', (cmd) => handleSaveChunk(repository, cmd.chunk)),
    Match.tag('UnloadChunk', (cmd) => handleUnloadChunk(repository, cmd.chunkId)),
    Match.exhaustive
  )

export const ChunkCommandHandlerLive = Layer.effect(
  ChunkCommandHandler,
  Effect.gen(function* () {
    const repository = yield* ChunkRepository

    return ChunkCommandHandler.of({
      handle: (command) => executeCommand(repository, command),
    })
  })
)
