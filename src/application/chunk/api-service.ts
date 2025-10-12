import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Clock, Context, Data, Duration, Effect, Layer, Match, Option, Schema } from 'effect'

import type { ChunkData, ChunkPosition } from '@/domain/chunk'
import {
  ChunkCommandHandler,
  ChunkCommandHandlerLive,
  ChunkReadModelLive,
  type ChunkCommandHandlerError,
  type ChunkCommandResult,
  type ChunkQuery,
  ChunkQueryHandler,
  ChunkQueryHandlerLive,
  type ChunkQueryHandlerError,
  type ChunkQueryResult,
} from '@/domain/chunk/cqrs'
import { ChunkCommandSchema, ChunkQuerySchema, type ChunkCommand } from '@/domain/chunk/types'
import {
  ChunkQueryError,
  type ChunkQueryError as ChunkQueryErrorType,
} from '@/domain/chunk/cqrs/query_handler'
import type { ChunkWorkerAdapter } from '@/infrastructure/chunk'
import { ChunkWorkerAdapterError, ChunkWorkerAdapterTag } from '@/infrastructure/chunk'

const defaultActorId = 'chunk-api-service'

const makeRandomId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `chunk-${Date.now()}-${Math.random().toString(16).slice(2)}`

const decodeLoadChunkCommand = (position: ChunkPosition, actorId: string) =>
  Schema.decode(ChunkCommandSchema)({
    _tag: 'LoadChunk',
    commandId: makeRandomId(),
    issuedAt: Date.now(),
    actorId,
    position,
  }).pipe(
    Effect.mapError((error) =>
      ChunkAPIServiceError.InvalidPayload({
        context: 'command',
        reason: TreeFormatter.formatErrorSync(error),
      })
    )
  )

const decodeGetChunkByPositionQuery = (position: ChunkPosition, requesterId: string) =>
  Schema.decode(ChunkQuerySchema)({
    _tag: 'GetChunkByPosition',
    queryId: makeRandomId(),
    requestedAt: Date.now(),
    requesterId,
    position,
  }).pipe(
    Effect.mapError((error) =>
      ChunkAPIServiceError.InvalidPayload({
        context: 'query',
        reason: TreeFormatter.formatErrorSync(error),
      })
    )
  )

const ensureWithinTimeout = (
  startedAt: number,
  timeoutOption: Option.Option<number>,
  positions: ReadonlyArray<ChunkPosition>
): Effect.Effect<void, ChunkAPIServiceError> =>
  Option.match(timeoutOption, {
    onNone: () => Effect.void,
    onSome: (timeoutMs) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) =>
          now - startedAt > timeoutMs
            ? Effect.fail(
                ChunkAPIServiceError.GenerationTimeout({
                  positions,
                  timeoutMs,
                })
              )
            : Effect.void
        )
      ),
  })

const awaitChunkFromReadModel = (
  queryHandler: ChunkQueryHandler,
  position: ChunkPosition,
  context: {
    readonly requesterId: string
    readonly pollIntervalMs: number
    readonly timeoutMs: Option.Option<number>
    readonly startedAt: number
    readonly positions: ReadonlyArray<ChunkPosition>
  }
): Effect.Effect<ChunkData, ChunkAPIError> =>
  Effect.gen(function* () {
    yield* ensureWithinTimeout(context.startedAt, context.timeoutMs, context.positions)

    const query = yield* decodeGetChunkByPositionQuery(position, context.requesterId)
    const result = yield* queryHandler.execute(query).pipe(
      Effect.catchTag(ChunkQueryError.tag, (error) =>
        handleChunkQueryError(queryHandler, error, position, context)
      )
    )

    return yield* Match.value(result).pipe(
      Match.tag('ChunkFound', ({ chunk }) => Effect.succeed(chunk)),
      Match.tag('ChunkList', () =>
        Effect.fail(
          ChunkAPIServiceError.UnexpectedQueryResult({
            queryTag: result._tag,
            expected: 'ChunkFound',
          })
        )
      ),
      Match.tag('ChunkStatistics', () =>
        Effect.fail(
          ChunkAPIServiceError.UnexpectedQueryResult({
            queryTag: result._tag,
            expected: 'ChunkFound',
          })
        )
      ),
      Match.exhaustive
    )
  })

const handleChunkQueryError = (
  queryHandler: ChunkQueryHandler,
  error: ChunkQueryErrorType,
  position: ChunkPosition,
  context: {
    readonly requesterId: string
    readonly pollIntervalMs: number
    readonly timeoutMs: Option.Option<number>
    readonly startedAt: number
    readonly positions: ReadonlyArray<ChunkPosition>
  }
): Effect.Effect<ChunkData, ChunkAPIError> =>
  Match.value(error).pipe(
    Match.tag('ChunkNotFound', () =>
      Effect.gen(function* () {
        yield* Clock.sleep(Duration.millis(context.pollIntervalMs))
        return yield* awaitChunkFromReadModel(
          queryHandler,
          position,
          context
        )
      })
    ),
    Match.orElse(() => Effect.fail(error))
  )

export const ChunkAPIServiceError = Data.taggedEnum('ChunkAPIServiceError')({
  WorkerUnavailable: Data.struct<{ readonly message: string }>(),
  InvalidPayload: Data.struct<{ readonly context: 'command' | 'query'; readonly reason: string }>(),
  GenerationTimeout: Data.struct<{
    readonly positions: ReadonlyArray<ChunkPosition>
    readonly timeoutMs: number
  }>(),
  UnexpectedQueryResult: Data.struct<{
    readonly queryTag: ChunkQuery['_tag']
    readonly expected: string
  }>(),
})

export type ChunkAPIServiceError = Data.TaggedEnum.Infer<typeof ChunkAPIServiceError>

export type ChunkAPIError =
  | ChunkCommandHandlerError
  | ChunkQueryHandlerError
  | ChunkWorkerAdapterError
  | ChunkAPIServiceError

export interface ChunkGenerationRequestOptions {
  readonly actorId?: string
}

export interface ChunkGenerationWaitOptions {
  readonly requesterId?: string
  readonly pollIntervalMs?: number
  readonly timeoutMs?: number
}

export type ChunkGenerationOptions = ChunkGenerationRequestOptions & ChunkGenerationWaitOptions

export interface ChunkAPIService {
  readonly executeCommand: (command: ChunkCommand) => Effect.Effect<ChunkCommandResult, ChunkAPIError>
  readonly executeQuery: (query: ChunkQuery) => Effect.Effect<ChunkQueryResult, ChunkAPIError>
  readonly requestChunkGeneration: (
    positions: ReadonlyArray<ChunkPosition>,
    options?: ChunkGenerationRequestOptions
  ) => Effect.Effect<void, ChunkAPIError>
  readonly waitForChunks: (
    positions: ReadonlyArray<ChunkPosition>,
    options?: ChunkGenerationWaitOptions
  ) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkAPIError>
  readonly requestAndWaitForChunks: (
    positions: ReadonlyArray<ChunkPosition>,
    options?: ChunkGenerationOptions
  ) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkAPIError>
}

export const ChunkAPIService = Context.GenericTag<ChunkAPIService>('@minecraft/application/chunk/APIService')

const createRequestChunkGeneration = (
  adapterOption: Option.Option<ChunkWorkerAdapter>
) => (positions: ReadonlyArray<ChunkPosition>, options?: ChunkGenerationRequestOptions) =>
  Option.match(adapterOption, {
    onNone: () =>
      Effect.fail(
        ChunkAPIServiceError.WorkerUnavailable({
          message: 'ChunkWorkerAdapterが提供されていません',
        })
      ),
    onSome: (adapter) =>
      positions.length === 0
        ? Effect.void
        : Effect.forEach(
            positions,
            (position) =>
              decodeLoadChunkCommand(position, options?.actorId ?? defaultActorId).pipe(
                Effect.flatMap((command) => adapter.publish(command))
              ),
            { discard: true }
          ),
  })

const createWaitForChunks = (
  queryHandler: ChunkQueryHandler
) => (positions: ReadonlyArray<ChunkPosition>, options?: ChunkGenerationWaitOptions) =>
  positions.length === 0
    ? Effect.succeed([] as const)
    : Effect.gen(function* () {
        const pollIntervalMs = options?.pollIntervalMs ?? 50
        const requesterId = options?.requesterId ?? defaultActorId
        const timeoutOption = Option.fromNullable(options?.timeoutMs)
        const startedAt = yield* Clock.currentTimeMillis

        return yield* Effect.forEach(
          positions,
          (position) =>
            awaitChunkFromReadModel(queryHandler, position, {
              pollIntervalMs,
              requesterId,
              timeoutMs: timeoutOption,
              startedAt,
              positions,
            }),
          { discard: false }
        )
      })

const ChunkAPIServiceLayer = Layer.effect(
  ChunkAPIService,
  Effect.gen(function* () {
    const commandHandler = yield* ChunkCommandHandler
    const queryHandler = yield* ChunkQueryHandler
    const adapterOption = yield* Effect.serviceOption(ChunkWorkerAdapterTag)

    const requestChunkGeneration = createRequestChunkGeneration(adapterOption)
    const waitForChunks = createWaitForChunks(queryHandler)

    return ChunkAPIService.of({
      executeCommand: (command) =>
        Option.match(adapterOption, {
          onNone: () => commandHandler.handle(command),
          onSome: (adapter) =>
            adapter.publish(command).pipe(
              Effect.zipRight(commandHandler.handle(command))
            ),
        }),
      executeQuery: (query) => queryHandler.execute(query),
      requestChunkGeneration,
      waitForChunks,
      requestAndWaitForChunks: (positions, options) =>
        requestChunkGeneration(positions, options).pipe(
          Effect.zipRight(waitForChunks(positions, options))
        ),
    })
  })
)

export const ChunkAPIServiceLive = Layer.mergeAll(
  ChunkReadModelLive,
  ChunkCommandHandlerLive,
  ChunkQueryHandlerLive,
  ChunkAPIServiceLayer
)
