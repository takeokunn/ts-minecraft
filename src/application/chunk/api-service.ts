import { Context, Effect, Layer } from 'effect'

import type { ChunkCommand, ChunkQuery } from '@/domain/chunk/types'
import {
  ChunkCommandHandler,
  type ChunkCommandHandlerError,
  type ChunkCommandResult,
  ChunkQueryHandler,
  type ChunkQueryHandlerError,
  type ChunkQueryResult,
} from '@/domain/chunk/cqrs'

export type ChunkAPIError = ChunkCommandHandlerError | ChunkQueryHandlerError

export interface ChunkAPIService {
  readonly executeCommand: (command: ChunkCommand) => Effect.Effect<ChunkCommandResult, ChunkAPIError>
  readonly executeQuery: (query: ChunkQuery) => Effect.Effect<ChunkQueryResult, ChunkAPIError>
}

export const ChunkAPIService = Context.GenericTag<ChunkAPIService>('@minecraft/application/chunk/APIService')

export const ChunkAPIServiceLive = Layer.effect(
  ChunkAPIService,
  Effect.gen(function* () {
    const commandHandler = yield* ChunkCommandHandler
    const queryHandler = yield* ChunkQueryHandler

    return ChunkAPIService.of({
      executeCommand: (command) => commandHandler.handle(command),
      executeQuery: (query) => queryHandler.execute(query),
    })
  })
)
