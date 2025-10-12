import { EventPublisherTag, type WorldGeneratorEvent } from '@/domain/world_generation/aggregate/world_generator/events'
import {
  WorldGenerationCommandHandler,
  WorldGenerationCommandHandlerLive,
  type WorldGenerationCommandHandlerError,
  type WorldGenerationCommandResult,
  WorldGenerationQueryHandler,
  WorldGenerationQueryHandlerLive,
  type WorldGenerationQueryHandlerError,
  type WorldGenerationQueryResult,
  WorldGenerationReadModelLive,
} from '@/domain/world_generation/cqrs'
import type { WorldGenerationCommand, WorldGenerationQuery } from '@/domain/world_generation/types'
import { ErrorCauseSchema, toErrorCause } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Context, Effect, Layer, Schema, Stream } from 'effect'

export const WorldGenerationEventStreamErrorSchema = Schema.TaggedError('WorldGenerationEventStreamError', {
  eventType: Schema.String,
  message: Schema.String,
  cause: ErrorCauseSchema,
})

export type WorldGenerationEventStreamError = Schema.Schema.Type<typeof WorldGenerationEventStreamErrorSchema>

export const WorldGenerationEventStreamError = {
  ...makeErrorFactory(WorldGenerationEventStreamErrorSchema),
  subscriptionFailed: (eventType: WorldGeneratorEvent['eventType'], cause: unknown): WorldGenerationEventStreamError =>
    WorldGenerationEventStreamErrorSchema.make({
      eventType,
      message: `イベントタイプ ${eventType} の購読に失敗しました`,
      cause: toErrorCause(cause) ?? { message: 'Unknown event stream error' },
    }),
  streamingFailed: (eventType: WorldGeneratorEvent['eventType'], cause: unknown): WorldGenerationEventStreamError =>
    WorldGenerationEventStreamErrorSchema.make({
      eventType,
      message: `イベントタイプ ${eventType} のイベントストリーム処理に失敗しました`,
      cause: toErrorCause(cause) ?? { message: 'Unknown event stream error' },
    }),
} as const

export type WorldGenerationAPIError =
  | WorldGenerationCommandHandlerError
  | WorldGenerationQueryHandlerError
  | WorldGenerationEventStreamError

export interface WorldGenerationAPIService {
  readonly executeCommand: (command: WorldGenerationCommand) => Effect.Effect<WorldGenerationCommandResult, WorldGenerationAPIError>
  readonly executeQuery: (query: WorldGenerationQuery) => Effect.Effect<WorldGenerationQueryResult, WorldGenerationAPIError>
  readonly subscribeToEvents: (
    eventType: WorldGeneratorEvent['eventType']
  ) => Effect.Effect<Stream.Stream<WorldGeneratorEvent, WorldGenerationEventStreamError>, WorldGenerationEventStreamError>
}

export const WorldGenerationAPIService = Context.GenericTag<WorldGenerationAPIService>(
  '@minecraft/application/world_generation/APIService'
)

const WorldGenerationAPIServiceLayer = Layer.effect(
  WorldGenerationAPIService,
  Effect.gen(function* () {
    const commandHandler = yield* WorldGenerationCommandHandler
    const queryHandler = yield* WorldGenerationQueryHandler
    const eventPublisher = yield* EventPublisherTag

    const subscribeToEvents: WorldGenerationAPIService['subscribeToEvents'] = (eventType) =>
      Effect.gen(function* () {
        const stream = yield* eventPublisher
          .subscribe(eventType)
          .pipe(Effect.mapError((error) => WorldGenerationEventStreamError.subscriptionFailed(eventType, error)))

        return Stream.mapError(stream, (error) => WorldGenerationEventStreamError.streamingFailed(eventType, error))
      })

    return WorldGenerationAPIService.of({
      executeCommand: (command) => commandHandler.handle(command),
      executeQuery: (query) => queryHandler.execute(query),
      subscribeToEvents,
    })
  })
)

export const WorldGenerationAPIServiceLive = Layer.mergeAll(
  WorldGenerationReadModelLive,
  WorldGenerationCommandHandlerLive,
  WorldGenerationQueryHandlerLive,
  WorldGenerationAPIServiceLayer
)
