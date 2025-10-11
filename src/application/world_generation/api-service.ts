import { Context, Effect, Layer } from 'effect'

import type { WorldGenerationCommand, WorldGenerationQuery } from '@/domain/world_generation/types'
import {
  WorldGenerationCommandHandler,
  type WorldGenerationCommandHandlerError,
  type WorldGenerationCommandResult,
  WorldGenerationQueryHandler,
  type WorldGenerationQueryHandlerError,
  type WorldGenerationQueryResult,
} from '@/domain/world_generation/cqrs'

export type WorldGenerationAPIError = WorldGenerationCommandHandlerError | WorldGenerationQueryHandlerError

export interface WorldGenerationAPIService {
  readonly executeCommand: (command: WorldGenerationCommand) => Effect.Effect<WorldGenerationCommandResult, WorldGenerationAPIError>
  readonly executeQuery: (query: WorldGenerationQuery) => Effect.Effect<WorldGenerationQueryResult, WorldGenerationAPIError>
}

export const WorldGenerationAPIService = Context.GenericTag<WorldGenerationAPIService>(
  '@minecraft/application/world_generation/APIService'
)

export const WorldGenerationAPIServiceLive = Layer.effect(
  WorldGenerationAPIService,
  Effect.gen(function* () {
    const commandHandler = yield* WorldGenerationCommandHandler
    const queryHandler = yield* WorldGenerationQueryHandler

    return WorldGenerationAPIService.of({
      executeCommand: (command) => commandHandler.handle(command),
      executeQuery: (query) => queryHandler.execute(query),
    })
  })
)
